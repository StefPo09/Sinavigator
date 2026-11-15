// Presentation preload: fetches and decodes every heavy asset in advance (Moon relief, both Apollo
// terrain sets, rocks, sky and planet textures), so the cinematics run without waiting on the network.
import { loadMoonModel, progressListeners } from './moonModel';
import { TEX } from './bodies';
import type { Quality } from './quality';
import { preloadRocks } from '../suprafata/rocks';
import { loadSiteTerrain } from '../suprafata/siteTerrain';

export interface PreloadStatus {
  done: number;
  total: number;
  label: string;
  /** Moon model bytes, 0–100, while downloading */
  moonPct: number | null;
}

export async function preloadAll(sites: string[], quality: Quality, onStatus: (s: PreloadStatus) => void): Promise<{ failed: string[] }> {
  const tasks: [string, () => Promise<unknown>][] = [
    ['Moon relief (LRO, 81.5 MB)', async () => {
      if (!(await loadMoonModel())) throw new Error('Moon model is unavailable');
    }],
    ...sites.map((id): [string, () => Promise<unknown>] => [
      `Terrain ${id.replace('apollo', 'Apollo ')}`,
      async () => {
        if (!(await loadSiteTerrain(id, quality))) throw new Error(`Terrain data for ${id} is unavailable`);
      },
    ]),
    ['Rocks', () => preloadRocks()],
    ['Sky and planet textures', () => Promise.all(Object.values(TEX).map(async (url) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Could not load ${url}: ${response.status}`);
      return response.blob();
    }))],
  ];
  let done = 0;
  let moonPct: number | null = null;
  let label = tasks[0][0];
  const emit = () => onStatus({ done, total: tasks.length, label, moonPct });
  const onMoon = (p: number | null) => {
    moonPct = p;
    emit();
  };
  progressListeners.add(onMoon);
  const failed: string[] = [];
  try {
    // one at a time: the Moon first (the largest), then the terrain sets
    for (const [name, run] of tasks) {
      label = name;
      emit();
      try {
        await run();
      } catch {
        failed.push(name);
      }
      done++;
      emit();
    }
  } finally {
    progressListeners.delete(onMoon);
  }
  return { failed };
}
