// Modele 3D de teren REAL (GLB, comprimate meshopt) pentru locurile de aterizare:
// public/3d-models/terrain/<id>/close-*.glb (~1 km, ortofoto NAC la rezoluție nativă), near-*.glb (~5 km, DTM 2 m),
// far.glb (DTM regional),
// build.json (proveniență). Originea: punctul de aterizare; x = est, y = sus, z = sud; include curbura Lunii.
import * as THREE from 'three';
import { groundTex } from '../shared/bodies';
import type { Quality } from '../shared/quality';

export interface SiteBuild {
  site_h_m: number;
  close: { step_m: number; x: [number, number]; z: [number, number]; ortho: { product: string; resolution_m: number } };
  near: { tif: string; dtm_res_m: number; step_m: number; half_m: number; ortho: { product: string; resolution_m: number; x0: number; x1: number; z0: number; z1: number } };
  far: { tif: string; dtm_res_m: number; step_m: number; x: [number, number]; z: [number, number]; ortho?: string };
}

export interface SiteTerrain {
  close: THREE.Object3D;
  near: THREE.Object3D;
  far: THREE.Object3D;
  build: SiteBuild;
  /** înălțimea solului (m) sub un punct (x, z), din raycast pe placa apropiată */
  heightAt: (x: number, z: number) => number;
}

const cache = new Map<string, Promise<SiteTerrain | null>>();

async function loadGlb(url: string): Promise<THREE.Object3D> {
  const [{ GLTFLoader }, { MeshoptDecoder }] = await Promise.all([import('three/addons/loaders/GLTFLoader.js'), import('three/addons/libs/meshopt_decoder.module.js')]);
  const l = new GLTFLoader();
  l.setMeshoptDecoder(MeshoptDecoder);
  return (await l.loadAsync(url)).scene;
}

/** Detaliu de regolit la scară mică (în coordonate de lume), peste culoarea de bază; fără repetiție vizibilă (două scări). */
function addRegolithDetail(mat: THREE.MeshStandardMaterial, detail: THREE.Texture, strength: number) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.detailMap = { value: detail };
    sh.uniforms.detailStrength = { value: strength };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWorldP;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWorldP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D detailMap;\nuniform float detailStrength;\nvarying vec3 vWorldP;')
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
  float d1 = texture2D(detailMap, vWorldP.xz / 3.1).r;
  float d2 = texture2D(detailMap, vWorldP.xz / 41.0 + 0.37).r;
  float fade = 1.0 - smoothstep(60.0, 900.0, length(vWorldP.xz - cameraPosition.xz));
  float dm = mix(1.0, (0.45 + 1.1 * d1) * (0.8 + 0.4 * d2), detailStrength * (0.35 + 0.65 * fade));
  diffuseColor.rgb *= dm;`,
      );
  };
}

export function loadSiteTerrain(id: string, quality: Quality): Promise<SiteTerrain | null> {
  const key = `${id}|${quality}`;
  let p = cache.get(key);
  if (!p) {
    p = (async () => {
      const base = `/3d-models/terrain/${id}`;
      const br = await fetch(`${base}/build.json`);
      if (!br.ok || !(br.headers.get('content-type') ?? '').includes('json')) return null;
      const build = (await br.json()) as SiteBuild;
      const [close, near, far] = await Promise.all([loadGlb(`${base}/close-${quality}.glb`), loadGlb(`${base}/near-${quality}.glb`), loadGlb(`${base}/far-${quality}.glb`)]);
      const detail = groundTex('diff');
      const imaged = (root: THREE.Object3D, detailStrength: number) =>
        root.traverse((o) => {
          const m = o as THREE.Mesh;
          if (!m.isMesh) return;
          const src = m.material as THREE.MeshStandardMaterial;
          // micro-relief: harta de normale a solului lunar scanat, repetată la ~3 m în coordonatele plăcii
          if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
          const g = m.geometry.boundingBox!;
          const span = Math.max(g.max.x - g.min.x, g.max.z - g.min.z);
          const mat = new THREE.MeshStandardMaterial({ map: src.map, normalMap: groundTex('normal', span / 3.1), normalScale: new THREE.Vector2(0.9, 0.9), color: 0xffffff, roughness: 1, metalness: 0 });
          if (mat.map) {
            mat.map.colorSpace = THREE.SRGBColorSpace;
            mat.map.anisotropy = 16; // limitat automat la maximul plăcii grafice
            mat.map.minFilter = THREE.LinearMipmapLinearFilter;
          }
          addRegolithDetail(mat, detail, detailStrength);
          src.dispose();
          m.material = mat;
          m.receiveShadow = true;
          m.castShadow = true;
        });
      imaged(close, 0.45);
      imaged(near, 0.55);
      far.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        const src = m.material as THREE.MeshStandardMaterial;
        // imaginea NAC regională (mozaic ortofoto), dacă placa o are
        const mat = new THREE.MeshStandardMaterial({ map: src.map ?? null, color: src.map ? 0xffffff : 0x9a9a9c, roughness: 1, metalness: 0 });
        if (mat.map) {
          mat.map.colorSpace = THREE.SRGBColorSpace;
          mat.map.anisotropy = 16;
        }
        src.dispose();
        addRegolithDetail(mat, detail, src.map ? 0.35 : 0.8);
        m.material = mat;
        m.receiveShadow = true;
        m.castShadow = true;
      });
      close.updateMatrixWorld(true);
      near.updateMatrixWorld(true);
      const ray = new THREE.Raycaster();
      const down = new THREE.Vector3(0, -1, 0);
      const heightAt = (x: number, z: number) => {
        ray.set(new THREE.Vector3(x, 5000, z), down);
        const hit = ray.intersectObject(close, true)[0] ?? ray.intersectObject(near, true)[0];
        return hit ? hit.point.y : 0;
      };
      return { close, near, far, build, heightAt };
    })().catch((e) => {
      cache.delete(key);
      throw e;
    });
    cache.set(key, p);
  }
  return p;
}
