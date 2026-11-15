'use client';

// Tabloul Soare – Pământ – Lună: compoziție schematică (nu la scară). Soarele luminează din stânga;
// Luna se află pe orbita ei în jurul Pământului la elongația calculată pentru momentul analizat,
// deci faza și poziția ei se schimbă cu timeline-ul. Luna este clicabilă: contur la hover,
// apropiere cinematică la clic.
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { moonGeocentric, sunGeocentric } from '@/lib/logic/ephemeris';
import { earthRotationAngle, makeEarth, makeSun, starBackground, tex, TEX } from '../shared/bodies';
import { loadMoonModel } from '../shared/moonModel';
import { animate, disposeScene, easeOutCubic, prefersReducedMotion } from '../shared/three-utils';

interface Props {
  timeMs: number;
  resetToken: number;
  onSelectMoon: () => void;
  onFail: () => void;
  /** pornește apropierea de Lună; la final apelează onArrive */
  flyToMoon: boolean;
  onArrive: () => void;
  /** la intrare, camera pornește lângă Lună și se retrage (întoarcere din perspectiva Lunii) */
  introFromMoon: boolean;
}

const RAD = Math.PI / 180;
/** Compoziția: Soarele parțial în afara cadrului, Pământul în centru, Luna pe o orbită schematică. */
const SUN = new THREE.Vector3(-25.5, 1.5, 3);
const SUN_R = 11.5;
const EARTH = new THREE.Vector3(3, 0, 0);
const EARTH_R = 5;
const MOON_R = 1.45;
const ORBIT_R = 12.5;
const CAM_HOME = new THREE.Vector3(2.5, 4.2, 36);
const TARGET_HOME = new THREE.Vector3(1.5, 0, 0);
const FOV_HOME = 38;
/** Direcția luminii: dinspre Soare, dar ușor spre privitor, ca în ilustrațiile de manual (schematic). */
const LIGHT_DIR = new THREE.Vector3(-1, 0.12, 0.62).normalize();

/** Poziția schematică a Lunii: elongația reală față de Soare, pe o orbită comprimată în jurul Pământului. */
function moonPos(ms: number, out = new THREE.Vector3()): THREE.Vector3 {
  const m = moonGeocentric(ms);
  const s = sunGeocentric(ms);
  const elong = (m.lonDeg - s.lonDeg) * RAD; // 0 = Lună nouă (între Pământ și Soare)
  const toSun = SUN.clone().sub(EARTH).setY(0).normalize();
  // rotire spre est (sens trigonometric văzut de la nord, +Y)
  const dir = toSun.applyAxisAngle(new THREE.Vector3(0, 1, 0), -elong);
  return out.copy(EARTH).addScaledVector(dir, ORBIT_R).setY(Math.sin(m.latDeg * RAD) * ORBIT_R * 1.6);
}

function label(text: string, cls: string): CSS2DObject {
  const el = document.createElement('div');
  el.className = `s3-label ${cls}`;
  el.textContent = text;
  return new CSS2DObject(el);
}

export default function SystemScene({ timeMs, resetToken, onSelectMoon, onFail, flyToMoon, onArrive, introFromMoon }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<{ update: (ms: number) => void; reset: () => void; flyToMoon: (done: () => void) => void } | null>(null);
  const arriveRef = useRef(onArrive);
  const selectRef = useRef(onSelectMoon);
  useEffect(() => {
    arriveRef.current = onArrive;
    selectRef.current = onSelectMoon;
  }, [onArrive, onSelectMoon]);

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
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    el.appendChild(renderer.domElement);
    renderer.domElement.setAttribute('aria-hidden', 'true');
    const labels = new CSS2DRenderer();
    labels.domElement.className = 's3-labels';
    el.appendChild(labels.domElement);

    const scene = new THREE.Scene();
    scene.background = starBackground();
    scene.backgroundIntensity = 0.28;
    const camera = new THREE.PerspectiveCamera(FOV_HOME, 1, 0.05, 2000);
    // pe ecrane mai înguste decât 16:10 păstrăm lățimea tabloului (Soare – Pământ – Lună încap orizontal)
    const baseFov = () => {
      const wide = 1.6;
      if (camera.aspect >= wide) return FOV_HOME;
      return (2 * Math.atan((Math.tan((FOV_HOME / 2) * RAD) * wide) / camera.aspect)) / RAD;
    };
    const controls = new OrbitControls(camera, labels.domElement);
    controls.enableDamping = !prefersReducedMotion();
    controls.enablePan = false;
    controls.minDistance = 14;
    controls.maxDistance = 60;
    // tabloul rămâne compus: rotire limitată în jurul vederii frontale
    controls.minAzimuthAngle = -40 * RAD;
    controls.maxAzimuthAngle = 40 * RAD;
    controls.minPolarAngle = 55 * RAD;
    controls.maxPolarAngle = 105 * RAD;
    controls.rotateSpeed = 0.5;

    // Soarele: disc texturat + strălucire; lumina vine din direcția lui
    const sun = makeSun(SUN_R, { textured: true, glow: 1.75 });
    sun.position.copy(SUN);
    scene.add(sun);
    const key = new THREE.DirectionalLight(0xfff2df, 3.1);
    key.position.copy(EARTH).addScaledVector(LIGHT_DIR, 40);
    key.target.position.copy(EARTH);
    scene.add(key, key.target, new THREE.AmbientLight(0x6a7896, 0.09));

    const earth = makeEarth(EARTH_R);
    earth.group.position.copy(EARTH);
    earth.setSunDir(LIGHT_DIR.clone());
    scene.add(earth.group);

    // orbita schematică a Lunii (cerc subțire)
    const orbitPts: THREE.Vector3[] = [];
    for (let i = 0; i <= 160; i++) {
      const a = (i / 160) * Math.PI * 2;
      orbitPts.push(new THREE.Vector3(EARTH.x + Math.cos(a) * ORBIT_R, 0, EARTH.z + Math.sin(a) * ORBIT_R));
    }
    const orbit = new THREE.Line(new THREE.BufferGeometry().setFromPoints(orbitPts), new THREE.LineBasicMaterial({ color: 0xc9ced8, transparent: true, opacity: 0.18 }));
    scene.add(orbit);

    const moon = new THREE.Mesh(new THREE.SphereGeometry(MOON_R, 64, 32), new THREE.MeshStandardMaterial({ map: tex(TEX.moon), roughness: 1, metalness: 0 }));
    scene.add(moon);
    // contur la hover: „coajă” inversată, puțin mai mare, în culoarea de accent
    const outline = new THREE.Mesh(
      new THREE.SphereGeometry(MOON_R * 1.13, 48, 24),
      new THREE.MeshBasicMaterial({ color: 0xd8f479, side: THREE.BackSide, transparent: true, opacity: 0.95, depthWrite: false }),
    );
    outline.visible = false;
    moon.add(outline);

    const sunLabel = label('Sun', 'lb-sun');
    sunLabel.position.set(SUN.x + SUN_R * 0.62, SUN.y + SUN_R * 0.82, SUN.z + 2);
    const earthLabel = label('Earth', 'lb-earth');
    earthLabel.position.set(0, EARTH_R + 1.1, 0);
    earth.group.add(earthLabel);
    const moonLabel = label('Moon', 'lb-moon');
    moonLabel.position.set(0, MOON_R + 1, 0);
    moon.add(moonLabel);
    scene.add(sunLabel);

    const update = (ms: number) => {
      moonPos(ms, moon.position);
      earth.setSpin(earthRotationAngle(ms));
      moon.rotation.y = Math.atan2(EARTH.x - moon.position.x, EARTH.z - moon.position.z) + Math.PI / 2; // fața vizibilă spre Pământ
    };
    const home = () => {
      camera.position.copy(CAM_HOME);
      controls.target.copy(TARGET_HOME);
      camera.fov = baseFov();
      camera.updateProjectionMatrix();
      controls.update();
    };
    let busy = false;
    let stop: (() => void) | undefined;
    const reset = () => {
      if (busy) return;
      const p0 = camera.position.clone();
      const t0 = controls.target.clone();
      stop?.();
      stop = animate(700, (k) => {
        camera.position.lerpVectors(p0, CAM_HOME, k);
        controls.target.lerpVectors(t0, TARGET_HOME, k);
        camera.lookAt(controls.target);
      });
    };

    /**
     * Apropierea cinematică: camera pleacă pe o curbă (nu în linie dreaptă) care trece pe lângă Pământ,
     * se înclină ușor în viraj, iar privirea „caută” Luna înaintea corpului camerei. Soarele se estompează,
     * câmpul vizual se strânge, iar la final expunerea crește: Luna luminată umple cadrul.
     */
    const fly = (done: () => void) => {
      if (busy) return;
      busy = true;
      stop?.();
      controls.enabled = false;
      outline.visible = false;
      el.classList.remove('is-hover');
      const mw = moon.position.clone();
      const p0 = camera.position.clone();
      const t0 = controls.target.clone();
      const fov0 = camera.fov;
      const exp0 = renderer.toneMappingExposure;
      const from = p0.clone().sub(mw).normalize().lerp(LIGHT_DIR, 0.35).normalize();
      const p1 = mw.clone().addScaledVector(from, MOON_R * 4.1);
      // punctul de control: în fața Pământului, deasupra planului orbitei → arc amplu, cu paralaxă
      const ctrl = EARTH.clone().addScaledVector(p0.clone().sub(EARTH).normalize(), EARTH_R * 3.2).add(new THREE.Vector3(0, 4.5, 0));
      const curve = new THREE.QuadraticBezierCurve3(p0, ctrl, p1);
      const look = new THREE.Vector3();
      const fwd = new THREE.Vector3();
      const glow = sun.children.filter((c) => c instanceof THREE.Sprite) as THREE.Sprite[];
      const glow0 = glow.map((g) => g.material.opacity);
      const smooth = (x: number) => {
        const t = Math.min(1, Math.max(0, x));
        return t * t * (3 - 2 * t);
      };
      stop = animate(
        1900,
        (k) => {
          curve.getPoint(k, camera.position);
          // privirea se mută spre Lună mai devreme decât camera (anticipare)
          look.lerpVectors(t0, mw, smooth(k * 1.6));
          camera.up.set(0, 1, 0);
          camera.lookAt(look);
          // înclinare în viraj: maximă la mijlocul curbei
          fwd.subVectors(look, camera.position).normalize();
          camera.up.applyAxisAngle(fwd, -0.14 * Math.sin(Math.PI * k));
          camera.lookAt(look);
          camera.fov = fov0 + (32 - fov0) * smooth(k);
          camera.updateProjectionMatrix();
          renderer.toneMappingExposure = exp0 * (1 + 0.55 * smooth((k - 0.7) / 0.3));
          glow.forEach((g, i) => (g.material.opacity = glow0[i] * (1 - 0.7 * smooth(k * 1.3))));
          sunLabel.visible = earthLabel.visible = moonLabel.visible = k < 0.12;
          orbit.material.opacity = 0.18 * (1 - smooth(k * 2));
        },
        () => {
          busy = false;
          done();
        },
        (t) => t,
      );
    };
    api.current = { update, reset, flyToMoon: fly };
    update(timeMs);
    home();

    if (introFromMoon) {
      // întoarcere: pornește aproape de Lună și se retrage la tablou
      const mw = moon.position.clone();
      const pStart = mw.clone().addScaledVector(CAM_HOME.clone().sub(mw).normalize(), MOON_R * 4.1);
      camera.position.copy(pStart);
      controls.target.copy(mw);
      camera.fov = 34;
      camera.lookAt(mw);
      controls.enabled = false;
      busy = true;
      const back = new THREE.QuadraticBezierCurve3(pStart, mw.clone().lerp(CAM_HOME, 0.5).add(new THREE.Vector3(0, 6, 4)), CAM_HOME.clone());
      const exp0 = renderer.toneMappingExposure;
      stop = animate(
        1700,
        (k) => {
          back.getPoint(k, camera.position);
          controls.target.lerpVectors(mw, TARGET_HOME, k);
          camera.lookAt(controls.target);
          camera.fov = 34 + (baseFov() - 34) * k;
          camera.updateProjectionMatrix();
          renderer.toneMappingExposure = exp0 * (1.4 - 0.4 * k);
        },
        () => {
          controls.enabled = true;
          busy = false;
        },
        easeOutCubic,
      );
    }

    // Luna: hover → contur + cursor; clic (nu tragere) → apropiere
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const hitMoon = (e: PointerEvent) => {
      const r = labels.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      // țintă generoasă pentru degete și mouse: puțin peste conturul vizibil
      return ray.ray.distanceToPoint(moon.position) < MOON_R * (e.pointerType === 'touch' ? 2.4 : 1.35);
    };
    let down: { x: number; y: number; id: number } | null = null;
    const setHover = (on: boolean) => {
      outline.visible = on && !busy;
      el.classList.toggle('is-hover', on && !busy);
      moonLabel.element.textContent = on && !busy ? 'Moon · click to fly there' : 'Moon';
    };
    const onMove = (e: PointerEvent) => {
      if (down || e.pointerType === 'touch') return;
      setHover(hitMoon(e));
    };
    const onLeave = () => setHover(false);
    const onDown = (e: PointerEvent) => (down = e.isPrimary && e.button === 0 ? { x: e.clientX, y: e.clientY, id: e.pointerId } : null);
    const onUp = (e: PointerEvent) => {
      const start = down;
      down = null;
      if (busy || !start || start.id !== e.pointerId || Math.hypot(e.clientX - start.x, e.clientY - start.y) > 6) return;
      if (hitMoon(e)) selectRef.current();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.target !== el || busy) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectRef.current();
      }
    };
    labels.domElement.addEventListener('pointermove', onMove);
    labels.domElement.addEventListener('pointerleave', onLeave);
    labels.domElement.addEventListener('pointerdown', onDown);
    labels.domElement.addEventListener('pointerup', onUp);
    el.addEventListener('keydown', onKey);
    el.addEventListener('focus', () => setHover(true));
    el.addEventListener('blur', () => setHover(false));

    const resize = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      renderer.setSize(w, h);
      labels.setSize(w, h);
      camera.aspect = w / Math.max(1, h);
      if (!busy) camera.fov = baseFov();
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    // preîncarcă relieful LRO pentru perspectiva Lună, după ce tabloul este afișat
    const idle = window.setTimeout(() => void loadMoonModel().catch(() => undefined), 1200);

    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (controls.enabled) controls.update();
      renderer.render(scene, camera);
      labels.render(scene, camera);
    };
    loop();

    return () => {
      window.clearTimeout(idle);
      cancelAnimationFrame(raf);
      stop?.();
      ro.disconnect();
      controls.dispose();
      labels.domElement.removeEventListener('pointermove', onMove);
      labels.domElement.removeEventListener('pointerleave', onLeave);
      labels.domElement.removeEventListener('pointerdown', onDown);
      labels.domElement.removeEventListener('pointerup', onUp);
      el.removeEventListener('keydown', onKey);
      disposeScene(scene);
      renderer.dispose();
      el.innerHTML = '';
      api.current = null;
    };
    // scena se construiește o singură dată; timpul și comenzile se aplică prin api
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => api.current?.update(timeMs), [timeMs]);
  useEffect(() => {
    if (flyToMoon) api.current?.flyToMoon(() => arriveRef.current());
  }, [flyToMoon]);
  useEffect(() => {
    if (resetToken) api.current?.reset();
  }, [resetToken]);

  return (
    <div
      ref={host}
      className="s3-host system-tableau"
      tabIndex={0}
      role="button"
      aria-label="Schematic picture of the Sun, Earth and Moon. Press Enter or click the Moon to fly to it."
    />
  );
}
