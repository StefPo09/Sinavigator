'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import type { LandingSite } from '@/lib/data/landingSites';
import type { Direction3 } from '@/lib/logic/bundleEphemeris';
import type { Quality } from '../shared/quality';
import { starBackground, tex, TEX } from '../shared/bodies';
import { animate, disposeScene, easeOutCubic, latLonMapping, prefersReducedMotion } from '../shared/three-utils';
import { loadMoonModel, moonLoadPct, progressListeners } from '../shared/moonModel';

/** Starea modelului 3D al Lunii (GLB din public/3d-models). */
export type MoonModelState = { state: 'loading'; pct: number | null } | { state: 'loaded' } | { state: 'missing' } | { state: 'error' } | { state: 'skipped' };

/** Raza reliefului (în unitățile scenei) în direcția dată: vârful modelului cel mai apropiat ca direcție. */
function terrainRadii(root: THREE.Object3D, dirs: THREE.Vector3[]): number[] {
  const best = dirs.map(() => ({ dot: -2, r: 1 }));
  const v = new THREE.Vector3();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const pos = m.geometry.attributes.position as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    const k = root.scale.x;
    for (let i = 0; i < arr.length; i += 3) {
      v.set(arr[i], arr[i + 1], arr[i + 2]);
      const len = v.length();
      for (let j = 0; j < dirs.length; j++) {
        const d = (v.x * dirs[j].x + v.y * dirs[j].y + v.z * dirs[j].z) / len;
        if (d > best[j].dot) best[j] = { dot: d, r: len * k };
      }
    }
  });
  return best.map((b) => b.r);
}

interface Props {
  onFail: () => void;
  onModel: (s: MoonModelState) => void;
  landing: LandingSite[];
  landingId: string | null;
  sunDirection: Direction3 | null;
  onLanding: (id: string) => void;
  quality: Quality;
  /** intrare: din spațiu („far”), de la suprafața locului („site”) sau fără animație */
  intro: 'far' | 'site' | 'none';
  /** locul spre care se face zborul (și din care pornește intrarea „site”) */
  focus: { latDeg: number; lonDeg: number } | null;
  /** pornește zborul spre `focus`; la sosire apelează onArrive */
  flyToFocus: boolean;
  onArrive: () => void;
}

const RAD = Math.PI / 180;
/** lat/lon selenografice (lon spre est) → punct pe sfera unitate (polul nord = +Y). */
function surface(latDeg: number, lonDeg: number, r = 1): THREE.Vector3 {
  const la = latDeg * RAD;
  const lo = lonDeg * RAD;
  return new THREE.Vector3(r * Math.cos(la) * Math.cos(lo), r * Math.sin(la), -r * Math.cos(la) * Math.sin(lo));
}

const NEAR_SIDE = new THREE.Vector3(3.45, 0.12, 0); // longitudinea 0°, fața vizibilă de pe Pământ

export default function MoonGlobe({ onFail, onModel, landing, landingId, sunDirection, onLanding, quality, intro, focus, flyToFocus, onArrive }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<{
    select: (id: string | null) => void;
    fly: (lat: number, lon: number, done: () => void) => void;
    illuminate: (direction: Direction3 | null) => void;
  } | null>(null);
  const arriveRef = useRef(onArrive);
  useEffect(() => {
    arriveRef.current = onArrive;
  }, [onArrive]);
  const focusRef = useRef(focus);
  useEffect(() => {
    focusRef.current = focus;
  }, [focus]);
  const modelRef = useRef(onModel);
  const landingRef = useRef(onLanding);
  useEffect(() => {
    modelRef.current = onModel;
    landingRef.current = onLanding;
  }, [onModel, onLanding]);

  useEffect(() => {
    const el = host.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: quality === 'high' });
    } catch {
      onFail();
      return;
    }
    renderer.setPixelRatio(Math.min(quality === 'high' ? 2 : 1, window.devicePixelRatio));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.setAttribute('aria-hidden', 'true');
    el.appendChild(renderer.domElement);
    const labels = new CSS2DRenderer();
    labels.domElement.className = 's3-labels';
    el.appendChild(labels.domElement);

    const scene = new THREE.Scene();
    scene.background = starBackground();
    scene.backgroundIntensity = 0.3;
    const camera = new THREE.PerspectiveCamera(40, 1, 0.005, 200);
    // pe ecrane înguste (portret) păstrăm același câmp vizual pe orizontală, ca globul să încapă
    const baseFov = () => (camera.aspect < 1 ? (2 * Math.atan(Math.tan(20 * RAD) / camera.aspect)) / RAD : 40);
    camera.position.copy(NEAR_SIDE);
    const controls = new OrbitControls(camera, labels.domElement);
    controls.enableDamping = !prefersReducedMotion();
    controls.enablePan = false;
    controls.minDistance = 1.55;
    controls.maxDistance = 6;
    controls.rotateSpeed = 0.6;
    controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE;

    const moonMat = new THREE.MeshStandardMaterial({ map: tex(TEX.moon).clone(), roughness: 1 });
    moonMat.map!.userData.shared = false;
    latLonMapping(moonMat, true);
    const moon = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 96), moonMat);
    // se afișează doar modelul LRO detaliat; sfera rămâne invizibilă (selecție prin clic) și apare doar dacă modelul lipsește
    moonMat.visible = false;
    scene.add(moon);
    const ambient = new THREE.AmbientLight(0xffffff, sunDirection ? 0.2 : 0.75);
    scene.add(ambient);
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    const illuminate = (direction: Direction3 | null) => {
      key.visible = direction != null;
      ambient.intensity = direction ? 0.2 : 0.75;
      if (direction) key.position.set(direction.x * 5, direction.y * 5, direction.z * 5);
    };
    scene.add(key, key.target, camera);
    illuminate(sunDirection);

    type Marker = { dot: THREE.Mesh; ring: THREE.Mesh; label: CSS2DObject; normal: THREE.Vector3 };
    const markers = new Map<string, Marker>();
    for (const site of landing) {
      const n = surface(site.latDeg, site.lonDeg);
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.0065, 16, 8), new THREE.MeshBasicMaterial({ color: 0xeef1ec }));
      dot.position.copy(n.clone().multiplyScalar(1.004));
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.0115, 0.0128, 64), new THREE.MeshBasicMaterial({ color: 0xd8f479, side: THREE.DoubleSide, transparent: true, opacity: 0.95 }));
      ring.position.copy(n.clone().multiplyScalar(1.005));
      ring.lookAt(n.clone().multiplyScalar(2));
      ring.visible = false;
      const right = Math.abs(site.lonDeg) >= 15;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `globe-label ${right ? 'side-r' : 'side-l'}`;
      b.textContent = site.name;
      b.tabIndex = -1; // comenzile echivalente din bara laterală și panou sunt accesibile din tastatură
      b.addEventListener('pointerdown', (event) => event.stopPropagation());
      b.addEventListener('click', () => {
        if (controls.enabled) landingRef.current(site.id);
      });
      const label = new CSS2DObject(b);
      label.center.set(right ? 0 : 1, 0.5);
      label.position.copy(n.clone().multiplyScalar(1.006));
      scene.add(dot, ring, label);
      markers.set(site.id, { dot, ring, label, normal: n });
    }

    // modelul LRO detaliat (GLB) se încarcă la intrare; markerele apar după ce stau pe relieful lui
    let model: THREE.Object3D | null = null;
    let ready = false;
    let disposed = false;
    const onProgress = (pct: number | null) => !disposed && modelRef.current({ state: 'loading', pct });
    progressListeners.add(onProgress);
    modelRef.current({ state: 'loading', pct: moonLoadPct() });
    const showFallback = (state: 'missing' | 'error') => {
      moonMat.visible = true;
      ready = true;
      modelRef.current({ state });
    };
    loadMoonModel()
      .then((root) => {
        if (disposed) return;
        if (!root) return showFallback('missing');
        model = root;
        scene.add(root);
        const list = [...markers.values()];
        const radii = terrainRadii(root, list.map((m) => m.normal));
        list.forEach((m, i) => {
          m.dot.position.copy(m.normal.clone().multiplyScalar(radii[i] + 0.002));
          m.ring.position.copy(m.normal.clone().multiplyScalar(radii[i] + 0.0025));
          m.label.position.copy(m.normal.clone().multiplyScalar(radii[i] + 0.003));
        });
        ready = true;
        modelRef.current({ state: 'loaded' });
      })
      .catch(() => !disposed && showFallback('error'));

    let selected: string | null = null;
    const select = (key: string | null) => {
      selected = key;
      for (const [k, m] of markers) m.label.element.classList.toggle('on', k === key);
    };
    // ── zboruri de cameră ──
    let stopFlight: (() => void) | undefined;
    const smooth = (x: number) => {
      const t = Math.min(1, Math.max(0, x));
      return t * t * (3 - 2 * t);
    };
    const linear = (t: number) => t;
    /** Așezare din tablou: Luna umple deja cadrul; camera se rotește ușor spre fața vizibilă și se stabilizează. */
    const settle = (ms: number) => {
      stopFlight?.();
      controls.enabled = false;
      const from = NEAR_SIDE.clone().multiplyScalar(1.22).applyAxisAngle(new THREE.Vector3(0, 1, 0), -0.42);
      const q1 = new THREE.Quaternion().setFromUnitVectors(from.clone().normalize(), NEAR_SIDE.clone().normalize());
      const q = new THREE.Quaternion();
      const id = new THREE.Quaternion();
      const base = from.clone().normalize();
      const d0 = from.length();
      const d1 = NEAR_SIDE.length();
      stopFlight = animate(ms, (t) => {
        q.slerpQuaternions(id, q1, t);
        camera.position.copy(base).applyQuaternion(q).multiplyScalar(d0 + (d1 - d0) * t);
        camera.up.set(0, 1, 0).applyAxisAngle(camera.position.clone().normalize(), -0.06 * (1 - t));
        camera.lookAt(0, 0, 0);
      }, () => {
        camera.up.set(0, 1, 0);
        controls.enabled = true;
      }, easeOutCubic);
    };
    /**
     * Coborâre spre un loc: (1) arc pe deasupra globului până deasupra sitului, (2) apropiere razantă,
     * (3) privirea se ridică de la centrul Lunii spre orizontul curbat din față. Inversată = întoarcerea.
     */
    const descend = (n: THREE.Vector3, reverse: boolean, ms: number, done?: () => void) => {
      stopFlight?.();
      controls.enabled = false;
      const far = reverse ? NEAR_SIDE.clone() : camera.position.clone();
      const base = far.clone().normalize();
      const d0 = far.length();
      const q1 = new THREE.Quaternion().setFromUnitVectors(base, n);
      const q = new THREE.Quaternion();
      const id = new THREE.Quaternion();
      // privirea finală: spre nordul local (tangent la suprafață), cu orizontul Lunii în cadru
      let north = new THREE.Vector3(0, 1, 0).addScaledVector(n, -n.y);
      if (north.lengthSq() < 1e-6) north = new THREE.Vector3(1, 0, 0);
      north.normalize();
      const horizon = n.clone().addScaledVector(north, 0.32);
      const target = new THREE.Vector3();
      const fov0 = baseFov();
      const SPLIT = 0.6;
      stopFlight = animate(ms, (t) => {
        const k = reverse ? 1 - t : t;
        const a = smooth(k / SPLIT);
        q.slerpQuaternions(id, q1, a);
        const low = smooth((k - SPLIT) / (1 - SPLIT));
        const dist = k < SPLIT ? d0 + (1.62 - d0) * a : 1.62 + (1.045 - 1.62) * low;
        camera.position.copy(base).applyQuaternion(q).multiplyScalar(dist);
        const h = smooth((k - 0.5) / 0.5);
        target.set(0, 0, 0).lerp(horizon, h);
        camera.up.set(0, 1, 0).lerp(n, h).normalize();
        camera.lookAt(target);
        camera.fov = fov0 * (1 - 0.18 * h);
        camera.updateProjectionMatrix();
      }, () => {
        if (reverse) {
          camera.up.set(0, 1, 0);
          camera.fov = baseFov();
          camera.updateProjectionMatrix();
          camera.lookAt(0, 0, 0);
          controls.enabled = true;
        }
        done?.();
      }, linear);
    };
    const fly = (lat: number, lon: number, done: () => void) => descend(surface(lat, lon), false, 2600, done);
    api.current = { select, fly, illuminate };
    select(landingId);
    if (intro === 'far') settle(1500);
    else if (intro === 'site' && focusRef.current) descend(surface(focusRef.current.latDeg, focusRef.current.lonDeg), true, 2200);

    // clic pe glob: alege cel mai apropiat punct (în limita a ~4° de arc)
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let down: { id: number; x: number; y: number } | null = null;
    const onDown = (e: PointerEvent) => {
      const isSurface = e.target === labels.domElement;
      down = controls.enabled && isSurface && e.isPrimary && e.button === 0
        ? { id: e.pointerId, x: e.clientX, y: e.clientY }
        : null;
      if (down) el.focus({ preventScroll: true });
    };
    const onUp = (e: PointerEvent) => {
      const start = down;
      down = null;
      if (!controls.enabled || !start || e.pointerId !== start.id || Math.hypot(e.clientX - start.x, e.clientY - start.y) > 5) return;
      const r = labels.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObject(moon, false)[0];
      if (!hit) return;
      const p = hit.point.clone().normalize();
      let best: string | null = null;
      let bestAng = 4 * RAD;
      for (const [k, m] of markers) {
        const a = p.angleTo(m.normal);
        if (a < bestAng) {
          bestAng = a;
          best = k;
        }
      }
      if (best) landingRef.current(best);
    };
    const onCancel = () => { down = null; };
    const spherical = new THREE.Spherical();
    const onKeyDown = (e: KeyboardEvent) => {
      if (!controls.enabled || e.target !== el || e.ctrlKey || e.metaKey || e.altKey) return;
      spherical.setFromVector3(camera.position);
      const step = 8 * RAD;
      switch (e.key) {
        case 'ArrowLeft': spherical.theta -= step; break;
        case 'ArrowRight': spherical.theta += step; break;
        case 'ArrowUp': spherical.phi -= step; break;
        case 'ArrowDown': spherical.phi += step; break;
        case '+':
        case '=': spherical.radius /= 1.2; break;
        case '-': spherical.radius *= 1.2; break;
        default: return;
      }
      e.preventDefault();
      camera.position.setFromSpherical(spherical.makeSafe());
      controls.update();
    };
    labels.domElement.addEventListener('pointerdown', onDown);
    labels.domElement.addEventListener('pointerup', onUp);
    labels.domElement.addEventListener('pointercancel', onCancel);
    el.addEventListener('keydown', onKeyDown);

    const resize = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      renderer.setSize(w, h);
      labels.setSize(w, h);
      camera.aspect = w / Math.max(1, h);
      camera.fov = baseFov();
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (controls.enabled) controls.update();
      // markerele păstrează aceeași mărime pe ecran la orice zoom; dispar în coborâre și până se încarcă relieful
      const camDist = camera.position.length();
      const k = THREE.MathUtils.clamp((camDist - 1) / (NEAR_SIDE.length() - 1), 0.05, 1.6);
      for (const [id, m] of markers) {
        const facing = m.normal.dot(camera.position) > m.dot.position.length();
        const show = ready && camDist > 1.45;
        m.dot.visible = show;
        m.dot.scale.setScalar(k * (id === selected ? 1.3 : 1));
        m.ring.visible = show && id === selected;
        m.ring.scale.setScalar(k);
        m.label.visible = show && facing;
      }
      renderer.render(scene, camera);
      labels.render(scene, camera);
    };
    loop();

    return () => {
      disposed = true;
      progressListeners.delete(onProgress);
      cancelAnimationFrame(raf);
      ro.disconnect();
      stopFlight?.();
      controls.dispose();
      labels.domElement.removeEventListener('pointerdown', onDown);
      labels.domElement.removeEventListener('pointerup', onUp);
      labels.domElement.removeEventListener('pointercancel', onCancel);
      el.removeEventListener('keydown', onKeyDown);
      if (model) scene.remove(model); // modelul din cache nu se eliberează: se refolosește
      disposeScene(scene);
      renderer.dispose();
      el.innerHTML = '';
      api.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [landing, quality]);

  useEffect(() => api.current?.select(landingId), [landingId]);
  useEffect(() => api.current?.illuminate(sunDirection), [sunDirection]);
  useEffect(() => {
    const f = focusRef.current;
    if (flyToFocus && f) api.current?.fly(f.latDeg, f.lonDeg, () => arriveRef.current());
  }, [flyToFocus, quality]);

  return <div ref={host} className="s3-host moon-globe" tabIndex={0} role="group" aria-label="Interactive lunar globe. Rotate with the arrow keys; use plus or minus to zoom." />;
}
