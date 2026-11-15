// Utilitare comune pentru scenele three.js.
import * as THREE from 'three';

export function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

export const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Generator pseudo-aleator determinist (pentru texturi ilustrative reproductibile). */
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Textură ILUSTRATIVĂ de tip lunar (zgomot + cratere), nu o hartă reală. */
export function moonTexture(size = 1024, seed = 7): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size / 2;
  const g = c.getContext('2d')!;
  const r = rng(seed);
  g.fillStyle = '#8d8d8f';
  g.fillRect(0, 0, c.width, c.height);
  // pete întunecate mari (tip „mare”)
  for (let i = 0; i < 14; i++) {
    const x = r() * c.width;
    const y = c.height * (0.25 + r() * 0.5);
    const rad = 30 + r() * 120;
    const grd = g.createRadialGradient(x, y, 0, x, y, rad);
    grd.addColorStop(0, 'rgba(70,70,74,0.55)');
    grd.addColorStop(1, 'rgba(70,70,74,0)');
    g.fillStyle = grd;
    g.beginPath();
    g.arc(x, y, rad, 0, Math.PI * 2);
    g.fill();
  }
  // cratere
  for (let i = 0; i < 900; i++) {
    const x = r() * c.width;
    const y = r() * c.height;
    const rad = Math.pow(r(), 3) * 18 + 1;
    g.fillStyle = `rgba(40,40,44,${0.18 + r() * 0.2})`;
    g.beginPath();
    g.arc(x, y, rad, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = `rgba(210,210,214,${0.15 + r() * 0.2})`;
    g.lineWidth = Math.max(1, rad * 0.25);
    g.beginPath();
    g.arc(x - rad * 0.15, y - rad * 0.15, rad, Math.PI * 0.9, Math.PI * 1.9);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

/** Textură ILUSTRATIVĂ pentru Pământ (oceane + pete de uscat + nori), nu o hartă reală. */
export function earthTexture(size = 512, seed = 3): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size / 2;
  const g = c.getContext('2d')!;
  const r = rng(seed);
  g.fillStyle = '#1d4f8f';
  g.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < 40; i++) {
    const x = r() * c.width;
    const y = c.height * (0.15 + r() * 0.7);
    const rad = 10 + r() * 45;
    g.fillStyle = r() > 0.4 ? 'rgba(74,125,70,0.85)' : 'rgba(150,130,90,0.8)';
    g.beginPath();
    g.ellipse(x, y, rad * 1.6, rad, r() * Math.PI, 0, Math.PI * 2);
    g.fill();
  }
  for (let i = 0; i < 60; i++) {
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.beginPath();
    g.ellipse(r() * c.width, r() * c.height, 20 + r() * 40, 4 + r() * 6, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = 'rgba(240,245,250,0.9)';
  g.fillRect(0, 0, c.width, c.height * 0.05);
  g.fillRect(0, c.height * 0.95, c.width, c.height * 0.05);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Textură radială pentru strălucirea Soarelui. */
export function glowTexture(inner = 'rgba(255,240,200,1)', outer = 'rgba(255,200,80,0)'): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, inner);
  grd.addColorStop(0.2, inner);
  grd.addColorStop(1, outer);
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function starField(count: number, radius: number, seed = 11): THREE.Points {
  const r = rng(seed);
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const u = r() * 2 - 1;
    const th = r() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    pos.set([radius * s * Math.cos(th), radius * u, radius * s * Math.sin(th)], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xcfd8e6, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.8 }));
}

/** Eliberează geometrii, materiale și texturi dintr-o scenă. */
export function disposeScene(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    m.geometry?.dispose?.();
    const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
    for (const mat of mats) {
      for (const v of Object.values(mat)) if (v instanceof THREE.Texture && !v.userData.shared) v.dispose();
      const u = (mat as THREE.ShaderMaterial).uniforms;
      if (u) for (const x of Object.values(u)) if (x.value instanceof THREE.Texture && !x.value.userData.shared) x.value.dispose();
      mat.dispose();
    }
  });
}

export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
/** Slow start and a long, soft arrival: for camera flights that should feel weighty. */
export const easeInOutQuart = (t: number) => (t < 0.5 ? 8 * t ** 4 : 1 - (-2 * t + 2) ** 4 / 2);
export const easeOutQuint = (t: number) => 1 - (1 - t) ** 5;

/**
 * Animație pe durata `ms`: apelează step(k) cu k ∈ [0, 1] (după easing), apoi done().
 * Cu „reduced motion” sare direct la final. Întoarce o funcție de anulare.
 */
export function animate(ms: number, step: (k: number) => void, done?: () => void, ease: (t: number) => number = easeInOutCubic): () => void {
  if (prefersReducedMotion() || ms <= 0) {
    step(1);
    done?.();
    return () => undefined;
  }
  const t0 = performance.now();
  let raf = 0;
  let stopped = false;
  let finished = false;
  const finish = () => {
    if (finished || stopped) return;
    finished = true;
    step(1);
    done?.();
  };
  const tick = () => {
    if (stopped || finished) return;
    const t = Math.min(1, (performance.now() - t0) / ms);
    if (t < 1) {
      step(ease(t));
      raf = requestAnimationFrame(tick);
    } else finish();
  };
  raf = requestAnimationFrame(tick);
  // siguranță: dacă browserul nu desenează cadre (filă ascunsă), animația se încheie oricum
  const guard = window.setTimeout(finish, ms + 400);
  return () => {
    stopped = true;
    cancelAnimationFrame(raf);
    window.clearTimeout(guard);
  };
}

/**
 * Proiecție echirectangulară calculată per pixel din poziția pe sferă (lat/lon), nu din UV-urile
 * interpolate ale plaselor: elimină „steaua” de la poli (triunghiurile UV-sferei converg acolo).
 * Convenție: longitudinea 0 pe +X, 90° E pe −Z, nordul pe +Y. flipV: textura încărcată cu flipY.
 */
export function latLonMapping(mat: THREE.MeshStandardMaterial, flipV: boolean) {
  if (mat.map) {
    mat.map.wrapS = THREE.RepeatWrapping;
    mat.map.needsUpdate = true;
  }
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.flipV = { value: flipV ? 1 : 0 };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObjPos;\nvarying vec3 vSphN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObjPos = position;\nvSphN = normalize(normalMatrix * normalize(position));');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float flipV;\nvarying vec3 vObjPos;\nvarying vec3 vSphN;')
      // lângă poli, triunghiurile UV-sferei sunt foarte subțiri și dau dungi de umbrire: folosește normala sferei
      .replace(
        '#include <normal_fragment_begin>',
        '#include <normal_fragment_begin>\n  float polar = smoothstep(0.90, 0.975, abs(normalize(vObjPos).y));\n  normal = normalize(mix(normal, normalize(vSphN), polar));',
      )
      .replace(
      '#include <map_fragment>',
      `#ifdef USE_MAP
  vec3 pn = normalize(vObjPos);
  float lonA = atan(-pn.z, pn.x) / (2.0 * PI);
  float lat = asin(clamp(pn.y, -1.0, 1.0)) / PI;
  float uA = 0.5 + lonA;
  float uB = fract(uA + 0.5) - 0.5;
  // fără cusătură la ±180°: alege varianta de u cu derivata mai mică (metoda Tarini)
  float u = fwidth(uA) <= fwidth(uB) + 1e-6 ? uA : uB;
  float v = flipV > 0.5 ? 0.5 + lat : 0.5 - lat;
  // gradienți corecți pentru mipmap: pe orizontală, longitudinea se „strânge” cu cos(lat) spre poli
  float cl = max(cos(lat * PI), 0.002);
  vec2 gx = vec2(dFdx(u) * cl, dFdx(v));
  vec2 gy = vec2(dFdy(u) * cl, dFdy(v));
  vec4 sampledDiffuseColor = textureGrad(map, vec2(u, v), gx, gy);
  diffuseColor *= sampledDiffuseColor;
#endif`,
    );
  };
  mat.needsUpdate = true;
}
