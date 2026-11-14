'use client';

import {useEffect, useRef} from 'react';
import * as THREE from 'three';
import type {HorizonProfile} from '@/lib/data/types';
import type {Model, VisState} from '@/lib/logic/derive';
import {makeEarth, makeSun} from '../shared/bodies';
import {disposeScene, prefersReducedMotion} from '../shared/three-utils';
import type {Quality} from '../shared/quality';
import type {SiteTerrain} from './siteTerrain';
import {scatterRocks} from './rocks';
import {buildGround, EYE, horizonRing} from './terrain';

export interface SkyState {
  sunAz: number;
  sunEl: number | null;
  earthAz: number;
  earthEl: number | null;
  sunState: VisState;
  earthState: VisState;
}

export interface SurfaceHandle {
  lookAt: (azDeg: number, elDeg: number) => void;
  reset: () => void;
  enterVR: () => Promise<void>;
}

interface Props {
  sky: SkyState;
  profile: HorizonProfile | undefined;
  model: Model;
  seed: number;
  /** model GLB opțional din public/3d-models (afișat doar dacă fișierul există) */
  modelUrl: string | null;
  onHeading: (azDeg: number, pitchDeg: number) => void;
  onFail: () => void;
  onModel: (status: 'none' | 'loaded' | 'error') => void;
  /** primește comenzile imperative pentru butoanele din HUD (null la demontare) */
  onReady: (h: SurfaceHandle | null) => void;
  /** Called after the first frame with a sized viewport has been rendered. */
  onFirstFrame: () => void;
  /** teren real 3D (LROC NAC DTM, GLB) pentru locurile de aterizare; altfel teren procedural */
  real: SiteTerrain | null;
  quality: Quality;
}

const RAD = Math.PI / 180;
const SKY_R = 3000;
/** Mărirea aparentă a Soarelui și a Pământului (declarată în interfață). */
export const SUN_ENLARGE = 2;
export const EARTH_ENLARGE = 3;

/** Direcție din azimut (0 = nord, 90 = est) și elevație: nord = −Z, est = +X, sus = +Y. */
export function dirFrom(azDeg: number, elDeg: number): THREE.Vector3 {
  const a = azDeg * RAD;
  const e = elDeg * RAD;
  return new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e));
}

export default function SurfaceScene({ sky, profile, model, seed, modelUrl, onHeading, onFail, onModel, onReady, onFirstFrame, real, quality }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<{ setSky: (s: SkyState) => void; lookAt: (az: number, el: number) => void; reset: () => void; enterVR: () => Promise<void> } | null>(null);
  const headingRef = useRef(onHeading);
  const modelRef = useRef(onModel);
  useEffect(() => {
    headingRef.current = onHeading;
    modelRef.current = onModel;
  }, [onHeading, onModel]);

  useEffect(() => {
    onReady({
      lookAt: (az, el) => api.current?.lookAt(az, el),
      reset: () => api.current?.reset(),
      enterVR: () => api.current?.enterVR() ?? Promise.resolve(),
    });
    return () => onReady(null);
  }, [onReady]);

  useEffect(() => {
    const el = host.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: quality === 'high', powerPreference: quality === 'high' ? 'high-performance' : 'low-power' });
    } catch {
      onFail();
      return;
    }
    renderer.setPixelRatio(Math.min(quality === 'high' ? 2 : 1, window.devicePixelRatio));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = quality === 'high';
    // scena e statică: umbrele se recalculează doar când se mută Soarele
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.xr.enabled = true;
    renderer.domElement.tabIndex = 0;
    renderer.domElement.setAttribute('aria-label', 'Vedere de pe suprafață. Săgețile rotesc privirea, + și − schimbă zoomul.');
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000); // cer fără atmosferă; stelele nu se văd la expunerea de zi
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, real ? 60000 : 8000);
    camera.position.set(0, EYE, 0);
    const rig = new THREE.Group(); // pentru VR
    rig.add(camera);
    scene.add(rig);

    let heightFn: (x: number, z: number) => number;
    if (real) {
      // teren real 3D: relieful LROC NAC DTM + ortofoto NAC; observatorul stă în punctul de aterizare
      scene.add(real.close, real.near, real.far);
      camera.position.y = real.heightAt(0, 0) + EYE;
      heightFn = real.heightAt;
    } else {
      const ground = buildGround(seed, quality);
      scene.add(ground.mesh);
      heightFn = ground.height;
    }
    // roci lunare scanate 3D (ilustrative), încărcate asincron
    let rocks: THREE.Group | null = null;
    let alive = true;
    scatterRocks({ count: quality === 'high' ? (real ? 260 : 420) : 90, radius: real ? 110 : 160, seed, height: heightFn, maxSize: real ? 1.2 : 1.6 })
      .then((g) => {
        if (!alive) return;
        rocks = g;
        scene.add(g);
        renderer.shadowMap.needsUpdate = true;
      })
      .catch(() => undefined);
    const ring = !real && model === 'terrain' ? horizonRing(profile) : null;
    if (ring) scene.add(ring);

    // Soarele: disc + strălucire; lumina direcțională vine din direcția calculată
    const skyR = real ? 40_000 : SKY_R; // corpurile cerești dincolo de cel mai îndepărtat teren
    const sunGroup = makeSun(skyR * Math.tan(0.267 * SUN_ENLARGE * RAD), { textured: false, glow: 9 });
    scene.add(sunGroup);
    const sunLight = new THREE.DirectionalLight(0xfff6e8, 3.4);
    sunLight.castShadow = quality === 'high';
    sunLight.shadow.mapSize.set(2048, 2048);
    const sc = sunLight.shadow.camera;
    // teren real: umbre pe ~5 km (craterele și versanții își aruncă umbra); procedural: detaliu fin aproape
    const SH = real ? 2500 : 70;
    sc.left = sc.bottom = -SH;
    sc.right = sc.top = SH;
    sc.near = 1;
    sc.far = real ? 12000 : 1200;
    if (real) sunLight.shadow.mapSize.set(3072, 3072);
    sunLight.shadow.bias = -0.0004;
    sunLight.shadow.normalBias = 0.02;
    scene.add(sunLight, sunLight.target);
    // lumină de umplere ILUSTRATIVĂ (pentru lizibilitate; nu este un rezultat calculat)
    const fill = new THREE.HemisphereLight(0xa9b3c4, 0x6a6a6e, 0.9);
    scene.add(fill);
    // lumina Pământului (reală): noaptea, Pământul aflat sus pe cer luminează slab terenul, în albastru
    const earthshine = new THREE.DirectionalLight(0xa9c2ff, 0);
    scene.add(earthshine, earthshine.target);

    // Pământul: sferă iluminată de aceeași lumină solară → faza este coerentă cu direcția Soarelui
    const earthBody = makeEarth(skyR * Math.tan(0.95 * EARTH_ENLARGE * RAD));
    const earth = earthBody.group;
    scene.add(earth);

    let yaw = 0; // azimutul privirii, grade
    let pitch = 8;
    let target: { yaw: number; pitch: number } | null = null;
    const applyView = () => {
      camera.lookAt(camera.position.clone().add(dirFrom(yaw, pitch)));
      headingRef.current(((yaw % 360) + 360) % 360, pitch);
    };

    const setSky = (s: SkyState) => {
      sunGroup.visible = s.sunEl != null;
      if (s.sunEl != null) {
        const d = dirFrom(s.sunAz, s.sunEl);
        sunGroup.position.copy(d.clone().multiplyScalar(skyR));
        sunGroup.lookAt(0, EYE, 0);
        sunLight.position.copy(d.clone().multiplyScalar(real ? 6000 : 600));
        earthBody.setSunDir(d);
        renderer.shadowMap.needsUpdate = true;
        // Soarele ascuns de orizont nu mai luminează direct terenul
        sunLight.intensity = s.sunState === 'vis' ? 3.4 : 0.0;
        fill.intensity = s.sunState === 'vis' ? 0.9 : 0.06;
      } else sunLight.intensity = 0;
      earth.visible = s.earthEl != null;
      if (s.earthEl != null && s.sunEl != null) {
        const e = dirFrom(s.earthAz, s.earthEl);
        const sd = dirFrom(s.sunAz, s.sunEl);
        // fracția iluminată a Pământului văzută de pe Lună: plin când Soarele e opus Pământului pe cer
        const lit = (1 - e.dot(sd)) / 2;
        earthshine.position.copy(e.multiplyScalar(600));
        // amplificată ca pentru ochiul adaptat la întuneric (fizic: ~1/10 000 din lumina zilei)
        earthshine.intensity = s.sunState === 'vis' || s.earthEl <= 0 ? 0 : 0.35 + 1.4 * lit;
      } else earthshine.intensity = 0;
      if (s.earthEl != null) earth.position.copy(dirFrom(s.earthAz, s.earthEl).multiplyScalar(skyR));
    };
    const lookAt = (az: number, elv: number) => {
      const t = { yaw: az, pitch: Math.max(-20, Math.min(70, elv)) };
      // drumul cel mai scurt pe azimut
      const d = ((t.yaw - yaw + 540) % 360) - 180;
      t.yaw = yaw + d;
      if (prefersReducedMotion()) {
        yaw = t.yaw;
        pitch = t.pitch;
        applyView();
      } else target = t;
    };
    const reset = () => {
      camera.fov = 60;
      camera.updateProjectionMatrix();
      lookAt(0, 8);
    };
    const enterVR = async () => {
      const xr = (navigator as Navigator & { xr?: { requestSession: (m: string, o: object) => Promise<XRSession> } }).xr;
      if (!xr) return;
      const session = await xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor'] });
      await renderer.xr.setSession(session);
    };
    api.current = { setSky, lookAt, reset, enterVR };
    setSky(sky);
    applyView();

    // model GLB opțional (exportat din Blender în public/3d-models)
    let cancelled = false;
    if (modelUrl) {
      fetch(modelUrl, { method: 'HEAD' })
        .then(async (r) => {
          if (!r.ok || cancelled) return modelRef.current('none');
          const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
          new GLTFLoader().load(
            modelUrl,
            (g) => {
              if (cancelled) return;
              g.scene.position.set(0, 0, -9);
              scene.add(g.scene);
              modelRef.current('loaded');
            },
            undefined,
            () => modelRef.current('error'),
          );
        })
        .catch(() => modelRef.current('none'));
    } else modelRef.current('none');

    // control: tragere = rotirea privirii, rotiță = zoom (FOV), săgeți / + − din tastatură
    let drag: { x: number; y: number; yaw: number; pitch: number } | null = null;
    const cv = renderer.domElement;
    const onDown = (e: PointerEvent) => {
      drag = { x: e.clientX, y: e.clientY, yaw, pitch };
      target = null;
      cv.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!drag) return;
      const k = camera.fov / Math.max(1, cv.clientHeight);
      yaw = drag.yaw - (e.clientX - drag.x) * k;
      pitch = Math.max(-20, Math.min(70, drag.pitch + (e.clientY - drag.y) * k));
      applyView();
    };
    const onUp = () => (drag = null);
    const zoom = (f: number) => {
      camera.fov = Math.max(15, Math.min(90, camera.fov * f));
      camera.updateProjectionMatrix();
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoom(e.deltaY > 0 ? 1.08 : 1 / 1.08);
    };
    const onKey = (e: KeyboardEvent) => {
      const step = e.shiftKey ? 15 : 5;
      if (e.key === 'ArrowLeft') yaw -= step;
      else if (e.key === 'ArrowRight') yaw += step;
      else if (e.key === 'ArrowUp') pitch = Math.min(70, pitch + step);
      else if (e.key === 'ArrowDown') pitch = Math.max(-20, pitch - step);
      else if (e.key === '+' || e.key === '=') zoom(1 / 1.15);
      else if (e.key === '-') zoom(1.15);
      else return;
      e.preventDefault();
      target = null;
      applyView();
    };
    cv.addEventListener('pointerdown', onDown);
    cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerup', onUp);
    cv.addEventListener('pointercancel', onUp);
    cv.addEventListener('wheel', onWheel, { passive: false });
    cv.addEventListener('keydown', onKey);

    const resize = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    let firstFrame = true;
    renderer.setAnimationLoop(() => {
      if (target) {
        yaw += (target.yaw - yaw) * 0.12;
        pitch += (target.pitch - pitch) * 0.12;
        if (Math.abs(target.yaw - yaw) < 0.05 && Math.abs(target.pitch - pitch) < 0.05) target = null;
        applyView();
      }
      renderer.render(scene, camera);
      if (firstFrame && cv.width > 0 && cv.height > 0 && !renderer.getContext().isContextLost()) {
        firstFrame = false;
        onFirstFrame();
      }
    });

    return () => {
      cancelled = true;
      renderer.setAnimationLoop(null);
      ro.disconnect();
      cv.removeEventListener('pointerdown', onDown);
      cv.removeEventListener('pointermove', onMove);
      cv.removeEventListener('pointerup', onUp);
      cv.removeEventListener('pointercancel', onUp);
      cv.removeEventListener('wheel', onWheel);
      cv.removeEventListener('keydown', onKey);
      alive = false;
      if (rocks) scene.remove(rocks); // geometria rocilor este partajată
      if (real) scene.remove(real.close, real.near, real.far); // terenul din cache se refolosește
      disposeScene(scene);
      renderer.dispose();
      el.innerHTML = '';
      api.current = null;
    };
    // scena se reconstruiește doar când se schimbă zona, profilul sau modelul de orizont
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, profile, model, modelUrl, real, quality]);

  useEffect(() => api.current?.setSky(sky), [sky]);

  return <div ref={host} className="s3-host surface-host" />;
}
