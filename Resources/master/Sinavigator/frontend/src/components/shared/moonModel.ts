// Modelul LRO al Lunii (GLB, culoare + topografie), încărcat o singură dată pe sesiune.
// Folosit de globul din perspectiva Lună; tabloul Sistem îl preîncarcă, ca globul să fie gata la sosire.
import * as THREE from 'three';
import { latLonMapping } from './three-utils';

/** Modelul NASA LRO (culoare 8k + topografie) exportat din Blender; 81 505 784 bytes pe disc. */
export const MOON_MODEL_URL = '/3d-models/moon.glb';
/** Raza medie a sferei din GLB (măsurată); modelul se scalează la raza 1. */
const MODEL_MEAN_RADIUS = 0.983;

let moonModel: Promise<THREE.Object3D | null> | null = null;
let lastPct: number | null = null;
export const progressListeners = new Set<(pct: number | null) => void>();
/** Ultimul procent cunoscut (bytes primiți / total), pentru un ecran care se abonează în timpul încărcării. */
export const moonLoadPct = () => lastPct;

export function loadMoonModel(): Promise<THREE.Object3D | null> {
  moonModel ??= (async () => {
    const head = await fetch(MOON_MODEL_URL, { method: 'HEAD' }).catch(() => null);
    if (!head || !head.ok) return null;
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    const gltf = await new GLTFLoader().loadAsync(MOON_MODEL_URL, (e) => {
      lastPct = e.lengthComputable && e.total ? Math.round((e.loaded / e.total) * 100) : null;
      for (const f of progressListeners) f(lastPct);
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
