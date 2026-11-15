// Roci lunare scanate 3D (Poly Haven, colecția „Moon”, CC0), pregătite în Blender: 7 variante,
// ~2 500 de fețe fiecare, texturi 1k (culoare, normale, rugozitate), comprimate meshopt.
// Așezarea lor este ILUSTRATIVĂ: pe terenul real, ortofoto arată doar blocurile mai mari de ~1 m.
import * as THREE from 'three';
import { rng } from '../shared/three-utils';

export const ROCKS_URL = '/3d-models/rocks.glb';

let variants: Promise<THREE.Mesh[]> | null = null;

function loadVariants(): Promise<THREE.Mesh[]> {
  variants ??= (async () => {
    const [{ GLTFLoader }, { MeshoptDecoder }] = await Promise.all([import('three/addons/loaders/GLTFLoader.js'), import('three/addons/libs/meshopt_decoder.module.js')]);
    const l = new GLTFLoader();
    l.setMeshoptDecoder(MeshoptDecoder);
    const g = await l.loadAsync(ROCKS_URL);
    const out: THREE.Mesh[] = [];
    g.scene.updateMatrixWorld(true);
    g.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const geo = m.geometry.clone().applyMatrix4(m.matrixWorld);
      const src = m.material as THREE.MeshStandardMaterial;
      const mat = new THREE.MeshStandardMaterial({ map: src.map, normalMap: src.normalMap, roughness: 1, metalness: 0, color: 0xc4c4c6 });
      if (mat.map) mat.map.anisotropy = 8;
      const mesh = new THREE.Mesh(geo, mat);
      mesh.userData.shared = true;
      out.push(mesh);
    });
    return out;
  })().catch((e) => {
    variants = null;
    throw e;
  });
  return variants;
}

export async function preloadRocks(): Promise<void> {
  await loadVariants();
}

export interface ScatterOpts {
  count: number;
  /** raza maximă (m) în jurul observatorului */
  radius: number;
  seed: number;
  /** înălțimea terenului la (x, z) */
  height: (x: number, z: number) => number;
  /** dimensiunea maximă a unei roci (m) */
  maxSize?: number;
}

/** Roci instanțiate (câte un InstancedMesh pe variantă), parțial îngropate, cu umbre. */
export async function scatterRocks(o: ScatterOpts): Promise<THREE.Group> {
  const vs = await loadVariants();
  const r = rng(o.seed);
  const group = new THREE.Group();
  const per = vs.map(() => [] as THREE.Matrix4[]);
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  for (let i = 0; i < o.count; i++) {
    // mai dese aproape de observator, rare la distanță
    const d = 2.5 + Math.pow(r(), 1.7) * o.radius;
    const a = r() * Math.PI * 2;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    // distribuție de mărimi: multe pietricele, puțini bolovani
    const s = 0.06 + Math.pow(r(), 5) * (o.maxSize ?? 1.6) * (d < 12 ? 0.5 : 1);
    q.setFromEuler(e.set((r() - 0.5) * 0.5, r() * Math.PI * 2, (r() - 0.5) * 0.5));
    const y = o.height(x, z) - s * (0.12 + r() * 0.18);
    per[Math.floor(r() * vs.length)].push(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(s, s * (0.8 + r() * 0.4), s)));
  }
  vs.forEach((v, k) => {
    if (!per[k].length) return;
    const im = new THREE.InstancedMesh(v.geometry, v.material, per[k].length);
    per[k].forEach((m, i) => im.setMatrixAt(i, m));
    im.castShadow = true;
    im.receiveShadow = true;
    im.userData.shared = true;
    group.add(im);
  });
  return group;
}
