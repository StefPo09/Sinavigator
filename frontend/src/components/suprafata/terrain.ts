// Teren ILUSTRATIV pentru perspectiva „Suprafață”.
// Regulă de onestitate: terenul procedural rămâne mereu sub orizontul analizat (≤ −0,15° văzut de
// la ochiul observatorului), deci nu poate ascunde Soarele sau Pământul în mod fals. Orizontul real
// îndepărtat este dat doar de inelul construit din profilul de orizont din date.
import * as THREE from 'three';
import type { HorizonProfile } from '@/lib/data/types';
import { groundTex } from '../shared/bodies';
import { rng } from '../shared/three-utils';

const RAD = Math.PI / 180;
export const EYE = 1.7;
export const HORIZON_R = 1500;
const MAX_R = 1450;
const TILE_M = 3.1; // dimensiunea plăcii de textură scanate (Poly Haven „Moon 01”), în metri

/** Zgomot valoric 2D neted, determinist. */
function makeNoise(seed: number) {
  const r = rng(seed);
  const perm = new Uint8Array(512);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const val = Array.from({ length: 256 }, () => r() * 2 - 1);
  const s = (t: number) => t * t * (3 - 2 * t);
  const at = (x: number, y: number) => val[perm[(x & 255) + perm[y & 255]]];
  const n2 = (x: number, y: number) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const u = s(x - xi);
    const v = s(y - yi);
    const a = at(xi, yi) + (at(xi + 1, yi) - at(xi, yi)) * u;
    const b = at(xi, yi + 1) + (at(xi + 1, yi + 1) - at(xi, yi + 1)) * u;
    return a + (b - a) * v;
  };
  return (x: number, y: number, oct = 5) => {
    let sum = 0;
    let amp = 1;
    let f = 1;
    for (let o = 0; o < oct; o++) {
      sum += amp * n2(x * f, y * f);
      amp *= 0.5;
      f *= 2.03;
    }
    return sum;
  };
}

export function buildGround(seed: number, quality: 'high' | 'low' = 'high'): { mesh: THREE.Mesh; height: (x: number, z: number) => number } {
  const noise = makeNoise(seed);
  const r = rng(seed + 1);
  const craters = Array.from({ length: 220 }, () => {
    const d = 6 + Math.pow(r(), 0.7) * 1300;
    const a = r() * Math.PI * 2;
    return { x: Math.cos(a) * d, z: Math.sin(a) * d, rad: 1.5 + Math.pow(r(), 2.8) * 80 };
  });
  const raw = (x: number, z: number) => {
    let h = 9 * noise(x / 420, z / 420, 4) + 1.4 * noise(x / 60, z / 60, 4) + 0.18 * noise(x / 6, z / 6, 3);
    for (const c of craters) {
      const d = Math.hypot(x - c.x, z - c.z) / c.rad;
      if (d < 1.5) h += d < 1 ? -c.rad * 0.2 * (1 - d * d) : c.rad * 0.06 * Math.cos(((d - 1) / 0.5) * (Math.PI / 2));
    }
    return h;
  };
  const h0 = raw(0, 0);
  const height = (x: number, z: number) => {
    const dist = Math.hypot(x, z);
    let h = (raw(x, z) - h0) * Math.min(1, 0.25 + dist / 60);
    // sub orizontul analizat: unghiul de elevație văzut din ochi ≤ −0,15°
    if (dist > 8) h = Math.min(h, EYE + dist * Math.tan(-0.15 * RAD));
    return h;
  };

  // rețea polară: detaliu mare lângă observator, rar la distanță
  const SEG = quality === 'high' ? 320 : 128;
  const radii: number[] = [0];
  for (let rr = 0.4; rr < MAX_R; rr *= quality === 'high' ? 1.035 : 1.08) radii.push(rr);
  radii.push(MAX_R);
  const pos: number[] = [];
  const uv: number[] = [];
  for (const rr of radii)
    for (let i = 0; i <= SEG; i++) {
      const a = (i / SEG) * Math.PI * 2;
      const x = Math.cos(a) * rr;
      const z = Math.sin(a) * rr;
      pos.push(x, height(x, z), z);
      uv.push(x / TILE_M, z / TILE_M);
    }
  const idx: number[] = [];
  for (let k = 0; k < radii.length - 1; k++)
    for (let i = 0; i < SEG; i++) {
      const a = k * (SEG + 1) + i;
      const b = a + SEG + 1;
      idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    map: groundTex('diff'),
    normalMap: groundTex('normal'),
    normalScale: new THREE.Vector2(1, 1),
    color: 0xe4e4e4,
    roughness: 1,
    metalness: 0,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return { mesh, height };
}

/** Inelul orizontului îndepărtat: înălțimea urmează profilul de orizont din date (null = sector fără date). */
export function horizonRing(p: HorizonProfile | undefined): THREE.Mesh | null {
  if (!p || !p.elevDeg.some((v) => v != null)) return null;
  const n = p.elevDeg.length;
  const verts: number[] = [];
  const uvs: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= n; i++) {
    const az = (i % n) * p.stepDeg * RAD;
    const el = p.elevDeg[i % n] ?? 0;
    const x = Math.sin(az) * HORIZON_R;
    const z = -Math.cos(az) * HORIZON_R;
    const top = EYE + HORIZON_R * Math.tan(Math.max(-2, el) * RAD);
    verts.push(x, -80, z, x, top, z);
    const u = (i / n) * (2 * Math.PI * HORIZON_R) / 40;
    uvs.push(u, 0, u, Math.max(0.2, (top + 80) / 40));
  }
  for (let i = 0; i < n; i++) {
    if (p.elevDeg[i] == null || p.elevDeg[(i + 1) % n] == null) continue; // sectoarele fără date rămân goale
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: groundTex('diff'), color: 0xa9a9a9, roughness: 1, side: THREE.DoubleSide }));
}
