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

/** Starea modelului 3D al Lunii (GLB din public/3d-models). */
export type MoonModelState = { state: 'loading'; pct: number | null } | { state: 'loaded' } | { state: 'missing' } | { state: 'error' } | { state: 'skipped' };

/** Modelul NASA LRO (culoare 8k + topografie) exportat din Blender; ~78 MB (2 M vârfuri). */
export const MOON_MODEL_URL = '/3d-models/moon.glb';
/** Raza medie a sferei din GLB (măsurată); modelul se scalează la raza 1. */
const MODEL_MEAN_RADIUS = 0.983;

// Modelul se încarcă o singură dată pe sesiune și se refolosește la revenirea în perspectivă.
let moonModel: Promise<THREE.Object3D | null> | null = null;
const progressListeners = new Set<(pct: number | null) => void>();
function loadMoonModel(): Promise<THREE.Object3D | null> {
  moonModel ??= (async () => {
    const head = await fetch(MOON_MODEL_URL, { method: 'HEAD' }).catch(() => null);
    if (!head || !head.ok) return null;
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    const gltf = await new GLTFLoader().loadAsync(MOON_MODEL_URL, (e) => {
      const pct = e.lengthComputable && e.total ? Math.round((e.loaded / e.total) * 100) : null;
      for (const f of progressListeners) f(pct);
    });
    const root = gltf.scene;
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) latLonMapping(m.material as THREE.MeshStandardMaterial, false);
    });
    root.scale.setScalar(1 / MODEL_MEAN_RADIUS);
    root.updateMatrixWorld(true);
    return root;
  })().catch((e) => {
    moonModel = null;
    throw e;
  });
  return moonModel;
}

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
    const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 200);
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
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.009, 16, 8), new THREE.MeshBasicMaterial({ color: 0x79bfff }));
      dot.position.copy(n.clone().multiplyScalar(1.004));
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.014, 0.0165, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }));
      ring.position.copy(n.clone().multiplyScalar(1.005));
      ring.lookAt(n.clone().multiplyScalar(2));
      ring.visible = false;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 's3-label lb-landing';
      b.textContent = site.name;
      b.tabIndex = -1; // comenzile echivalente din bara laterală și panou sunt accesibile din tastatură
      b.addEventListener('pointerdown', (event) => event.stopPropagation());
      b.addEventListener('click', () => {
        if (controls.enabled) landingRef.current(site.id);
      });
      const label = new CSS2DObject(b);
      label.center.set(Math.abs(site.lonDeg) < 15 ? 1.12 : -0.12, 0.5);
      label.position.copy(n.clone().multiplyScalar(1.03));
      scene.add(dot, ring, label);
      markers.set(site.id, { dot, ring, label, normal: n });
    }
    let selected = landingId;

    // modelul GLB real înlocuiește sfera ilustrativă când e disponibil; sfera rămâne invizibilă pentru selectarea prin clic
    let disposed = false;
    let model: THREE.Object3D | null = null;
    const onProgress = (pct: number | null) => modelRef.current({ state: 'loading', pct });
    progressListeners.add(onProgress);
    modelRef.current(quality === 'low' ? { state: 'skipped' } : { state: 'loading', pct: null });
    (quality === 'low' ? Promise.resolve(null) : loadMoonModel())
      .then((root) => {
        if (disposed) return;
        if (!root) return quality === 'low' ? undefined : modelRef.current({ state: 'missing' });
        model = root;
        scene.add(root);
        (moon.material as THREE.MeshStandardMaterial).visible = false;
        // punctele stau pe relieful modelului, nu pe sfera de rază 1
        const list = [...markers.values()];
        const radii = terrainRadii(root, list.map((m) => m.normal));
        list.forEach((m, i) => {
          m.dot.position.copy(m.normal.clone().multiplyScalar(radii[i] + 0.004));
          m.ring.position.copy(m.normal.clone().multiplyScalar(radii[i] + 0.005));
          m.label.position.copy(m.normal.clone().multiplyScalar(radii[i] + 0.03));
        });
        modelRef.current({ state: 'loaded' });
      })
      .catch(() => !disposed && modelRef.current({ state: 'error' }));

    const select = (key: string | null) => {
      selected = key;
      for (const [k, m] of markers) {
        const on = k === key;
        m.ring.visible = on;
        m.dot.scale.setScalar(on ? 1.35 : 1);
        m.label.element.classList.toggle('on', on);
      }
    };
    // drum de cameră între două puncte în jurul globului: direcția se rotește pe arc, distanța se interpolează
    let stopFlight: (() => void) | undefined;
    const flyPath = (from: THREE.Vector3, to: THREE.Vector3, ms: number, done?: () => void, ease?: (t: number) => number) => {
      stopFlight?.();
      const d0 = from.length();
      const d1 = to.length();
      const q0 = new THREE.Quaternion();
      const q1 = new THREE.Quaternion().setFromUnitVectors(from.clone().normalize(), to.clone().normalize());
      const q = new THREE.Quaternion();
      const base = from.clone().normalize();
      controls.enabled = false;
      stopFlight = animate(ms, (k) => {
        q.slerpQuaternions(q0, q1, Math.min(1, k * 1.15));
        camera.position.copy(base).applyQuaternion(q).multiplyScalar(d0 + (d1 - d0) * k);
        camera.lookAt(0, 0, 0);
      }, () => {
        controls.enabled = true;
        done?.();
      }, ease);
    };
    const fly = (lat: number, lon: number, done: () => void) => flyPath(camera.position.clone(), surface(lat, lon, 1.03), 2000, done);
    api.current = { select, fly, illuminate };
    select(landingId);
    // animația de intrare
    if (intro === 'far') flyPath(NEAR_SIDE.clone().multiplyScalar(9), NEAR_SIDE, 2200, undefined, easeOutCubic);
    else if (intro === 'site' && focusRef.current) flyPath(surface(focusRef.current.latDeg, focusRef.current.lonDeg, 1.03), NEAR_SIDE, 2200, undefined, easeOutCubic);

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
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    const reduced = prefersReducedMotion();
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (controls.enabled) controls.update();
      for (const m of markers.values()) m.label.visible = m.normal.dot(camera.position) > m.dot.position.length();
      const sel = selected != null ? markers.get(selected) : null;
      if (sel && !reduced) {
        const k = 1 + 0.18 * Math.sin(performance.now() / 380);
        sel.ring.scale.setScalar(k);
        (sel.ring.material as THREE.MeshBasicMaterial).opacity = 0.55 + 0.35 * (1 - (k - 0.82) / 0.36);
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

  return <div ref={host} className="s3-host moon-globe" tabIndex={0} role="group" aria-label="Glob lunar interactiv. Rotește cu săgețile și folosește plus sau minus pentru zoom." />;
}
