'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { moonGeocentric, sunGeocentric, toScene } from '@/lib/logic/ephemeris';
import type { Coverage } from '@/lib/logic/timeline';
import { SCALE } from './scale';
import { earthRotationAngle, makeEarth, makeSun, starBackground, tex, TEX } from '../shared/bodies';
import { animate, disposeScene, easeOutCubic, prefersReducedMotion } from '../shared/three-utils';

interface Props {
  timeMs: number;
  cov: Coverage;
  follow: boolean;
  resetToken: number;
  moonSelected: boolean;
  onSelectMoon: () => void;
  onFail: () => void;
  /** pornește zborul camerei până la Lună; la sosire apelează onArrive */
  flyToMoon: boolean;
  onArrive: () => void;
  /** la intrare, camera pornește de lângă Lună și se retrage (întoarcere din perspectiva Lunii) */
  introFromMoon: boolean;
}

const DAY = 86_400_000;

function earthPos(ms: number): THREE.Vector3 {
  const s = sunGeocentric(ms);
  return new THREE.Vector3(...toScene({ lonDeg: s.lonDeg + 180, latDeg: 0 }, (SCALE.earthOrbit * s.distKm) / 149_597_870.7));
}
function moonOffset(ms: number): THREE.Vector3 {
  const m = moonGeocentric(ms);
  return new THREE.Vector3(...toScene(m, (SCALE.moonOrbit * m.distKm) / 384_400));
}

function at<T extends THREE.Object3D>(o: T, x: number, y: number, z: number): T {
  o.position.set(x, y, z);
  return o;
}

function label(text: string, cls: string, onClick?: () => void): CSS2DObject {
  const el = document.createElement(onClick ? 'button' : 'div');
  el.className = `s3-label ${cls}`;
  el.textContent = text;
  if (onClick) {
    (el as HTMLButtonElement).type = 'button';
    el.addEventListener('click', onClick);
  }
  return new CSS2DObject(el);
}

export default function SystemScene({ timeMs, cov, follow, resetToken, moonSelected, onSelectMoon, onFail, flyToMoon, onArrive, introFromMoon }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<{ update: (ms: number) => void; reset: () => void; setFollow: (f: boolean) => void; setSelected: (s: boolean) => void; flyToMoon: (done: () => void) => void } | null>(null);
  const arriveRef = useRef(onArrive);
  useEffect(() => {
    arriveRef.current = onArrive;
  }, [onArrive]);
  const selectRef = useRef(onSelectMoon);
  useEffect(() => {
    selectRef.current = onSelectMoon;
  }, [onSelectMoon]);

  useEffect(() => {
    const el = host.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      onFail();
      return;
    }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(renderer.domElement);
    renderer.domElement.setAttribute('aria-hidden', 'true');
    const labels = new CSS2DRenderer();
    labels.domElement.className = 's3-labels';
    el.appendChild(labels.domElement);

    const scene = new THREE.Scene();
    scene.background = starBackground();
    scene.backgroundIntensity = 0.35;
    const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 3000);
    camera.position.set(0, 42, 62);
    const controls = new OrbitControls(camera, labels.domElement);
    controls.enableDamping = !prefersReducedMotion();
    controls.minDistance = 3;
    controls.maxDistance = 250;

    // Soarele: sursă de lumină reală a scenei (iluminează Pământul și Luna → faze corecte geometric)
    const sun = makeSun(SCALE.sunR, { textured: true, glow: 4.5 });
    scene.add(sun);
    scene.add(new THREE.PointLight(0xffffff, 3.2, 0, 0));
    scene.add(new THREE.AmbientLight(0x5a6680, 0.12));
    sun.add(at(label('Soare', 'lb-sun'), 0, SCALE.sunR + 1.5, 0));

    // Orbita Pământului (un an din modelul analitic) și arcul acoperit de date
    const yearPts: THREE.Vector3[] = [];
    for (let i = 0; i <= 366; i++) yearPts.push(earthPos(cov.startMs + i * DAY));
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(yearPts), new THREE.LineBasicMaterial({ color: 0x79bfff, transparent: true, opacity: 0.45 })));
    const covPts: THREE.Vector3[] = [];
    for (let t = cov.startMs; t <= cov.endMs; t += DAY / 8) covPts.push(earthPos(t));
    const covArc = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(covPts), 64, 0.09, 8), new THREE.MeshBasicMaterial({ color: 0x5fd3a0, transparent: true, opacity: 0.85 }));
    scene.add(covArc);
    const covLabel = label('interval cu date', 'lb-cov');
    covLabel.position.copy(covPts[Math.floor(covPts.length / 2)]).add(new THREE.Vector3(0, -1.6, 0));
    scene.add(covLabel);

    // Pământul + orbita Lunii, într-un grup care urmează Pământul
    const earthGroup = new THREE.Group();
    scene.add(earthGroup);
    const earth = makeEarth(SCALE.earthR);
    earthGroup.add(earth.group);
    earthGroup.add(at(label('Pământ', 'lb-earth'), 0, SCALE.earthR + 1, 0));
    const moonOrbitGeo = new THREE.BufferGeometry();
    const moonOrbit = new THREE.Line(moonOrbitGeo, new THREE.LineBasicMaterial({ color: 0xc9ced8, transparent: true, opacity: 0.55 }));
    earthGroup.add(moonOrbit);

    const moonMat = new THREE.MeshStandardMaterial({ map: tex(TEX.moon), roughness: 1 });
    const moon = new THREE.Mesh(new THREE.SphereGeometry(SCALE.moonR, 32, 16), moonMat);
    earthGroup.add(moon);
    const ring = new THREE.Mesh(new THREE.RingGeometry(SCALE.moonR * 1.6, SCALE.moonR * 1.85, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }));
    ring.visible = false;
    moon.add(ring);
    const moonLabel = label('Lună · zboară spre ea', 'lb-moon', () => selectRef.current());
    moonLabel.position.set(0, SCALE.moonR + 0.9, 0);
    moon.add(moonLabel);

    let following = follow;
    const update = (ms: number) => {
      const ep = earthPos(ms);
      earthGroup.position.copy(ep);
      earth.setSunDir(ep.clone().negate());
      earth.setSpin(earthRotationAngle(ms));
      moon.position.copy(moonOffset(ms));
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 120; i++) pts.push(moonOffset(ms + (i / 120) * 27.3217 * DAY));
      moonOrbitGeo.setFromPoints(pts);
      if (following) {
        const d = camera.position.clone().sub(controls.target);
        controls.target.copy(ep);
        camera.position.copy(ep).add(d);
      }
    };
    // vederea implicită: Pământul și Luna în prim-plan, Soarele în spatele lor
    const reset = () => {
      const ep = earthGroup.position.clone();
      const out = ep.clone().normalize();
      if (following) {
        controls.target.copy(ep);
        // dinspre Soare, oblic: se văd partea luminată, terminatorul și orbita Lunii
        const side = new THREE.Vector3().crossVectors(out, new THREE.Vector3(0, 1, 0)).normalize();
        camera.position.copy(ep).add(out.clone().multiplyScalar(-9)).add(side.multiplyScalar(8)).add(new THREE.Vector3(0, 5, 0));
      } else {
        // din lateral: Soarele în cadru, Pământul și Luna pe jumătate luminate
        const side = new THREE.Vector3().crossVectors(out, new THREE.Vector3(0, 1, 0)).normalize();
        const tgt = ep.clone().multiplyScalar(0.5);
        controls.target.copy(tgt);
        camera.position.copy(tgt).add(side.multiplyScalar(56)).add(new THREE.Vector3(0, 10, 0));
      }
    };
    api.current = {
      update,
      reset,
      setFollow: (f) => {
        following = f;
        reset();
      },
      flyToMoon: (done) => {
        // zbor cinematic: camera se apropie de Lună până o umple cadrul
        const moonW = moon.getWorldPosition(new THREE.Vector3());
        const p0 = camera.position.clone();
        const t0 = controls.target.clone();
        const dir = p0.clone().sub(moonW).normalize();
        const p1 = moonW.clone().add(dir.multiplyScalar(SCALE.moonR * 2.2));
        controls.enabled = false;
        animate(1700, (k) => {
          camera.position.lerpVectors(p0, p1, k);
          controls.target.lerpVectors(t0, moonW, Math.min(1, k * 1.6));
        }, done);
      },
      setSelected: (s) => {
        ring.visible = s;
      },
    };
    update(timeMs);
    reset();
    if (introFromMoon) {
      // întoarcere: pornește lângă Lună și se retrage la vederea implicită
      const moonW = moon.getWorldPosition(new THREE.Vector3());
      const pEnd = camera.position.clone();
      const tEnd = controls.target.clone();
      const pStart = moonW.clone().add(pEnd.clone().sub(moonW).normalize().multiplyScalar(SCALE.moonR * 2.2));
      controls.enabled = false;
      animate(1800, (k) => {
        camera.position.lerpVectors(pStart, pEnd, k);
        controls.target.lerpVectors(moonW, tEnd, k);
      }, () => (controls.enabled = true), easeOutCubic);
    }

    // selectarea Lunii prin clic pe sferă
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let down: { x: number; y: number } | null = null;
    const onDown = (e: PointerEvent) => (down = { x: e.clientX, y: e.clientY });
    const onUp = (e: PointerEvent) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
      const r = labels.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      // țintă de clic generoasă: Luna este mică pe ecran
      const hit = ray.intersectObject(moon, false).length > 0 || ray.ray.distanceToPoint(moon.getWorldPosition(new THREE.Vector3())) < SCALE.moonR * 2.5;
      if (hit) selectRef.current();
    };
    labels.domElement.addEventListener('pointerdown', onDown);
    labels.domElement.addEventListener('pointerup', onUp);

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

    // etichete fără suprapuneri: când Luna e prea aproape de Pământ pe ecran, se afișează o singură etichetă
    const earthLabelEl = earthGroup.children.find((c) => c instanceof CSS2DObject) as CSS2DObject;
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const declutter = () => {
      const h = el.clientHeight / 2;
      earthGroup.getWorldPosition(a).project(camera);
      moon.getWorldPosition(b).project(camera);
      const close = Math.hypot((a.x - b.x) * (el.clientWidth / 2), (a.y - b.y) * h) < 70;
      moonLabel.visible = !close;
      earthLabelEl.element.textContent = close ? 'Pământ și Lună' : 'Pământ';
      b.copy(covLabel.position).project(camera);
      covLabel.visible = Math.hypot((a.x - b.x) * (el.clientWidth / 2), (a.y - b.y) * h) > 60;
    };

    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      controls.update();
      declutter();
      renderer.render(scene, camera);
      labels.render(scene, camera);
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      labels.domElement.removeEventListener('pointerdown', onDown);
      labels.domElement.removeEventListener('pointerup', onUp);
      disposeScene(scene);
      renderer.dispose();
      el.innerHTML = '';
      api.current = null;
    };
    // scena se construiește o singură dată; timpul și opțiunile se aplică prin api
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cov.startMs, cov.endMs]);

  useEffect(() => api.current?.update(timeMs), [timeMs]);
  useEffect(() => api.current?.setFollow(follow), [follow]);
  useEffect(() => api.current?.setSelected(moonSelected), [moonSelected]);
  useEffect(() => {
    if (flyToMoon) api.current?.flyToMoon(() => arriveRef.current());
  }, [flyToMoon]);
  useEffect(() => {
    if (resetToken) api.current?.reset();
  }, [resetToken]);

  return <div ref={host} className="s3-host" role="img" aria-label="Scenă 3D schematică: Soarele, Pământul cu orbita lui și Luna cu orbita ei. Valorile sunt în panoul lateral." />;
}
