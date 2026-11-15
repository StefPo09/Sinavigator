import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { Mesh, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { LANDING_SITES } from '../../src/lib/data/landingSites.ts';
import { validateBundle } from '../../src/lib/data/validate.ts';

const startMs = Date.UTC(2026, 10, 27);
const durationH = 72;
const offsets = [0, 24, 72];
const stepMin = 10;
const stepMs = stepMin * 60_000;
const hour = 3_600_000;
const stopMs = startMs + (offsets.at(-1) + durationH) * hour;
const eyeM = 2;
const radiusM = 5_000;
const trek = 'https://trek.nasa.gov/moon/';
const coordinateSource = 'https://lroc.im-ldi.com/data/support/downloads/2016_LROC_Coordinates_of_Human_Features.pdf';
const horizons = 'https://ssd.jpl.nasa.gov/api/horizons.api';
const root = new URL('../../public/', import.meta.url);

const utc = (ms) => new Date(ms).toISOString();
const horizonDate = (ms) => utc(ms).slice(0, 16).replace('T', ' ');
const deg = (radians) => radians * 180 / Math.PI;
const round = (value) => Math.round(value * 1_000_000) / 1_000_000;

function observerSeries(site, heightM, command) {
  const query = new URLSearchParams({
    format: 'json',
    COMMAND: `'${command}'`,
    CENTER: "'coord@301'",
    COORD_TYPE: "'GEODETIC'",
    SITE_COORD: `'${site.lonDeg},${site.latDeg},${(heightM + eyeM) / 1000}'`,
    EPHEM_TYPE: "'OBSERVER'",
    START_TIME: `'${horizonDate(startMs)}'`,
    STOP_TIME: `'${horizonDate(stopMs)}'`,
    STEP_SIZE: `'${stepMin} m'`,
    QUANTITIES: "'4'",
    CSV_FORMAT: "'YES'",
    ANG_FORMAT: "'DEG'",
    EXTRA_PREC: "'YES'",
  });

  // Request serially to satisfy the Horizons API fair-use policy.
  const { result, error } = JSON.parse(execFileSync('curl', [
    '-fsS', '--max-time', '45', `${horizons}?${query}`,
  ], { encoding: 'utf8' }));
  const rows = result?.match(/\$\$SOE\s*([\s\S]*?)\s*\$\$EOE/)?.[1].split(/\r?\n/);
  if (error || !result?.includes('MEAN_ME') || !rows || rows.length !== (stopMs - startMs) / stepMs + 1) {
    throw new Error(`${site.name}/${command}: ${error ?? 'efemeride Horizons incomplete sau cadru lunar neașteptat'}`);
  }

  const series = { azDeg: [], elDeg: [] };
  for (const [index, line] of rows.entries()) {
    const [date, , , az, elevation] = line.split(',').map((value) => value.trim());
    if (Date.parse(`${date} UTC`) !== startMs + index * stepMs || !az || !elevation || !Number.isFinite(Number(az)) || !Number.isFinite(Number(elevation))) {
      throw new Error(`${site.name}/${command}: eșantion invalid la ${date}`);
    }
    series.azDeg.push(round(Number(az)));
    series.elDeg.push(round(Number(elevation)));
  }
  return series;
}

async function terrainGeometry(file) {
  const bytes = await readFile(file);
  const jsonLength = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.toString('utf8', 20, 20 + jsonLength));
  // Keep the meshopt-compressed geometry and remove materials so Node needs no image decoder.
  for (const mesh of json.meshes) {
    for (const primitive of mesh.primitives) delete primitive.material;
  }
  delete json.images;
  delete json.textures;
  delete json.materials;
  const raw = Buffer.from(JSON.stringify(json));
  const paddedLength = Math.ceil(raw.length / 4) * 4;
  const binary = bytes.subarray(20 + jsonLength);
  const glb = Buffer.alloc(20 + paddedLength + binary.length, 0x20);
  bytes.copy(glb, 0, 0, 20);
  glb.writeUInt32LE(glb.length, 8);
  glb.writeUInt32LE(paddedLength, 12);
  raw.copy(glb, 20);
  binary.copy(glb, 20 + paddedLength);
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  return (await loader.parseAsync(glb.buffer, '')).scene;
}

async function localHorizon(site, directory, build) {
  const elevation = Array(360).fill(null);
  const vector = new Vector3();

  // Local mesh coordinates are metres: x east, y up from the site, z south.
  // The three tiles overlap near the site; take the highest sampled terrain angle
  // in each 1° azimuth sector, within the same 5 km radius at both sites.
  for (const tile of ['close', 'near', 'far']) {
    const terrain = await terrainGeometry(new URL(`${tile}-high.glb`, directory));
    terrain.updateMatrixWorld(true);
    terrain.traverse((mesh) => {
      if (!(mesh instanceof Mesh)) return;
      const positions = mesh.geometry.getAttribute('position');
      for (let i = 0; i < positions.count; i++) {
        vector.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld);
        const distance = Math.hypot(vector.x, vector.z);
        if (distance < 1 || distance > radiusM) continue;
        const azimuth = (Math.round(deg(Math.atan2(vector.x, -vector.z))) + 360) % 360;
        const angle = deg(Math.atan2(vector.y - eyeM, distance));
        elevation[azimuth] = Math.max(elevation[azimuth] ?? -90, angle);
      }
    });
  }

  return {
    siteId: site.id,
    stepDeg: 1,
    elevDeg: elevation.map((value) => value == null ? null : round(value)),
    resolutionM: null,
    searchRadiusKm: radiusM / 1000,
    source: `Modelele locale derivate din LROC NAC DTM ${build.near.tif} și ${build.far.tif}, eșantionate pe geometriile GLB simplificate`,
  };
}

const bundle = {
  provenance: 'computed',
  generatedAt: utc(Date.now()),
  note: 'Comparație Apollo 17 (Taurus–Littrow) și Apollo 15 (Hadley–Apennine), cu date NASA/JPL și LROC.',
  rules: { sunMarginDeg: 0, earthMarginDeg: 2 },
  sites: [],
  profiles: [],
  scenarios: [],
  layers: {
    geometry: { source: 'external', product: 'NASA/JPL Horizons DE441', url: 'https://ssd.jpl.nasa.gov/horizons/', description: 'Azimut și elevație aparentă topocentrică pentru centrele Soarelui și Pământului, în cadrul lunar Mean Earth, fără refracție.' },
    terrain: { source: 'computed', product: 'LRO/LROC NAC DTM', url: trek, description: 'Profiluri derivate din modelele locale Apollo 17 și Apollo 15. Maxim pe sectoare de 1° în raza de 5 km.' },
  },
  validation: { status: 'not-validated', summary: 'Sunt verificate acoperirea eșantioanelor Horizons și structura datelor. Ferestrele și profilurile nu au fost validate independent.' },
  assumptions: [
    'Observator la 2 m deasupra terenului modelat.',
    'Profiluri locale din plăci 3D simplificate. Relieful peste 5 km și obstacolele mici pot schimba orizontul real.',
    'Vizibilitate geometrică pentru centrele corpurilor. Marjele sunt setări ale proiectului.',
  ],
};

const compact = (series, offsetH) => {
  const i = (offsetH * hour) / stepMs;
  const end = i + (durationH * hour) / stepMs + 1;
  return { azDeg: series.azDeg.slice(i, end), elDeg: series.elDeg.slice(i, end) };
};

for (const site of LANDING_SITES) {
  const directory = new URL(`3d-models/terrain/${site.id}/`, root);
  const build = JSON.parse(await readFile(new URL('build.json', directory), 'utf8'));
  if (build.lat !== site.latDeg || build.lon !== site.lonDeg) throw new Error(`${site.name}: coordonatele terenului nu corespund`);
  bundle.sites.push({
    id: site.id, name: site.mission, short: site.name, latDeg: site.latDeg, lonDeg: site.lonDeg,
    frame: 'Mean Earth / Polar Axis (ME)', observerHeightM: eyeM, source: `${site.source}. ${coordinateSource}`,
  });
  bundle.profiles.push(await localHorizon(site, directory, build));
  const sun = observerSeries(site, build.site_h_m, 10);
  const earth = observerSeries(site, build.site_h_m, 399);
  for (const offsetH of offsets) {
    bundle.scenarios.push({
      id: `${site.id}_${offsetH}`, siteId: site.id, startUtc: utc(startMs + offsetH * hour), offsetH, durationH, stepMin,
      sun: compact(sun, offsetH), earth: compact(earth, offsetH),
    });
  }
}

const { errors, warnings } = validateBundle(bundle);
if (errors.length) throw new Error(errors.join('\n'));
const output = new URL('data/', root);
await mkdir(output, { recursive: true });
await writeFile(new URL('bundle.json', output), JSON.stringify(bundle, null, 2).replace(/\[\s+(?=-?[\d.])([\d.,\s-]+)\s+]/g, (_, values) => `[${values.replace(/\s+/g, '')}]`) + '\n');
console.log(`${bundle.scenarios.length} scenarii Apollo · ${utc(startMs)} → ${utc(stopMs)}\n${warnings.join('\n')}`);
