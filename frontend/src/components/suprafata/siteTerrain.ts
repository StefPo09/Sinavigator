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

/** Download progress (0–100, bytes of the three tiles) per site and quality, for loading screens. */
const progress = new Map<string, number>();
const progressSubs = new Set<() => void>();
export const terrainPct = (id: string, quality: Quality) => progress.get(`${id}|${quality}`) ?? null;
export function onTerrainProgress(f: () => void) {
  progressSubs.add(f);
  return () => {
    progressSubs.delete(f);
  };
}

/** One download per tile file, shared by the early prefetch and the loader; `got` counts bytes received. */
interface Download {
  bytes: Promise<ArrayBuffer>;
  /** uncompressed size from HEAD (compressed responses carry none), 0 if unknown */
  size: Promise<number>;
  got: number;
}
const downloads = new Map<string, Download>();
const byteSubs = new Set<() => void>();

function download(url: string): Download {
  let d = downloads.get(url);
  if (!d) {
    // the size is asked first: queued behind large downloads, a HEAD would answer too late
    const size = fetch(url, { method: 'HEAD' })
      .then((r) => Number(r.headers.get('content-length')) || 0)
      .catch(() => 0);
    const entry: Download = { got: 0, size, bytes: Promise.resolve(new ArrayBuffer(0)) };
    entry.bytes = (async () => {
      await size;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
      const reader = res.body?.getReader();
      if (!reader) return res.arrayBuffer();
      const chunks: Uint8Array[] = [];
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        entry.got += value.byteLength;
        for (const f of byteSubs) f();
      }
      const out = new Uint8Array(entry.got);
      let at = 0;
      for (const c of chunks) {
        out.set(c, at);
        at += c.byteLength;
      }
      return out.buffer;
    })();
    entry.bytes.catch(() => downloads.delete(url));
    downloads.set(url, entry);
    d = entry;
  }
  return d;
}

const tileUrls = (id: string, quality: Quality) => ['close', 'near', 'far'].map((n) => `/3d-models/terrain/${id}/${n}-${quality}.glb`);

/**
 * Starts downloading a site's terrain tiles without parsing them (parsing is the heavy part),
 * so a camera flight can run while the bytes arrive. The loader later reuses the same download.
 */
export function prefetchSiteTerrain(id: string, quality: Quality) {
  for (const u of tileUrls(id, quality)) void download(u).bytes.catch(() => undefined);
}

async function parseGlb(url: string): Promise<THREE.Object3D> {
  const [{ GLTFLoader }, { MeshoptDecoder }] = await Promise.all([import('three/addons/loaders/GLTFLoader.js'), import('three/addons/libs/meshopt_decoder.module.js')]);
  const l = new GLTFLoader();
  l.setMeshoptDecoder(MeshoptDecoder);
  const data = await download(url).bytes;
  return (await l.parseAsync(data, url.slice(0, url.lastIndexOf('/') + 1))).scene;
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
      const urls = tileUrls(id, quality);
      // uncompressed sizes: the same unit as the decompressed bytes counted while downloading
      const sizes = await Promise.all(urls.map((u) => download(u).size));
      const emit = () => {
        if (!sizes.every((s) => s > 0)) return;
        const got = urls.reduce((a, u, i) => a + Math.min(download(u).got, sizes[i]), 0);
        progress.set(key, Math.min(100, Math.round((100 * got) / sizes.reduce((a, b) => a + b))));
        for (const f of progressSubs) f();
      };
      byteSubs.add(emit);
      emit();
      let tiles: THREE.Object3D[];
      try {
        tiles = await Promise.all(urls.map(parseGlb));
      } finally {
        byteSubs.delete(emit);
      }
      const [close, near, far] = tiles;
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
