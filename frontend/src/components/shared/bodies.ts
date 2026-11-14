// Corpuri cerești texturate, comune scenelor 3D.
// Texturi: Solar System Scope (CC BY 4.0, bazate pe date NASA), Poly Haven (CC0), NASA LRO (domeniu public).
import * as THREE from 'three';
import { glowTexture } from './three-utils';

export const TEX = {
  sun: '/textures/2k_sun.jpg',
  earthDay: '/textures/4k_earth_daymap.jpg',
  earthNight: '/textures/4k_earth_nightmap.jpg',
  earthClouds: '/textures/4k_earth_clouds.jpg',
  moon: '/textures/2k_moon.jpg',
  stars: '/textures/2k_stars_milky_way.jpg',
  rock: '/textures/aerial_rocks_02_diff_2k.jpg',
  rockNormal: '/textures/aerial_rocks_02_nor_gl_2k.jpg',
  groundDiff: '/textures/moon_ground_diff_2k.jpg',
  groundNormal: '/textures/moon_ground_nor_gl_2k.jpg',
};

/** Textura de sol lunar scanată (Poly Haven „Moon 01”, CC0; o placă = 3,1 m), repetabilă. */
export function groundTex(kind: 'diff' | 'normal', repeat = 1): THREE.Texture {
  const t = tex(kind === 'diff' ? TEX.groundDiff : TEX.groundNormal, kind === 'diff').clone();
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 16;
  t.userData.shared = false;
  // clona împarte imaginea cu originalul; când imaginea se încarcă, clona trebuie reîncărcată pe GPU
  const src = tex(kind === 'diff' ? TEX.groundDiff : TEX.groundNormal, kind === 'diff');
  if (!src.image) {
    const iv = setInterval(() => {
      if (src.image) {
        t.image = src.image;
        t.needsUpdate = true;
        clearInterval(iv);
      }
    }, 200);
  }
  return t;
}

export const TEXTURE_CREDITS =
  'Texturi Soare, Pământ, Lună și cer: Solar System Scope (CC BY 4.0), pe baza datelor NASA. Sol lunar și roci lunare scanate 3D: Poly Haven, colecția „Moon” (CC0), roci prelucrate în Blender. Globul lunar: model NASA LRO. Teren 3D Apollo 15 și 17: LROC NAC DTM și ortofoto NAC (NASA/GSFC/Arizona State University).';

const loader = new THREE.TextureLoader();
const cache = new Map<string, THREE.Texture>();

/** Textură partajată (încărcată o singură dată); nu o eliberați la demontarea scenei. */
export function tex(url: string, color = true): THREE.Texture {
  const key = `${url}|${color}`;
  let t = cache.get(key);
  if (!t) {
    t = loader.load(url);
    t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = 8;
    t.userData.shared = true;
    cache.set(key, t);
  }
  return t;
}

/** Cer înstelat (Calea Lactee) ca fundal echirectangular. */
export function starBackground(): THREE.Texture {
  const t = tex(TEX.stars);
  t.mapping = THREE.EquirectangularReflectionMapping;
  return t;
}

/* ───────── Pământul: zi/noapte, nori, atmosferă ───────── */

const EARTH_VS = /* glsl */ `
varying vec2 vUv;
varying vec3 vN;
varying vec3 vView;
void main() {
  vUv = uv;
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vView = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const EARTH_FS = /* glsl */ `
uniform sampler2D dayMap;
uniform sampler2D nightMap;
uniform vec3 sunDir;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vView;
void main() {
  vec3 n = normalize(vN);
  float d = dot(n, normalize(sunDir));
  float day = smoothstep(-0.12, 0.22, d);
  vec3 dayCol = texture2D(dayMap, vUv).rgb * (0.08 + 1.25 * max(d, 0.0));
  vec3 nightCol = texture2D(nightMap, vUv).rgb * 0.9;
  vec3 col = mix(nightCol, dayCol, day);
  // reflexie speculară discretă pe oceane (zonele întunecate și albastre ale hărții de zi)
  vec3 h = normalize(normalize(sunDir) + normalize(vView));
  vec3 base = texture2D(dayMap, vUv).rgb;
  float ocean = smoothstep(0.05, 0.0, base.r - base.b * 0.6);
  col += ocean * pow(max(dot(n, h), 0.0), 60.0) * 0.6 * day;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const ATMO_FS = /* glsl */ `
uniform vec3 sunDir;
varying vec3 vN;
varying vec3 vView;
void main() {
  vec3 n = normalize(vN);
  float rim = pow(1.0 - abs(dot(n, normalize(vView))), 2.5);
  float lit = smoothstep(-0.3, 0.4, dot(n, normalize(sunDir)));
  gl_FragColor = vec4(vec3(0.35, 0.62, 1.0) * rim * (0.15 + lit), rim * (0.15 + lit));
}`;

/** Unghiul de rotație al Pământului (ERA, IERS), radiani: orientează Greenwich față de echinocțiu. */
export function earthRotationAngle(ms: number): number {
  const d = ms / 86_400_000 + 2440587.5 - 2451545.0;
  const f = 0.779057273264 + 1.00273781191135448 * d;
  return 2 * Math.PI * (f - Math.floor(f));
}

export interface EarthBody {
  group: THREE.Group;
  /** direcția spre Soare, în coordonate de scenă */
  setSunDir: (d: THREE.Vector3) => void;
  /** rotația în jurul axei (radiani); vezi earthRotationAngle */
  setSpin: (a: number) => void;
}

export function makeEarth(radius: number): EarthBody {
  const group = new THREE.Group();
  const tilt = new THREE.Group();
  // axa Pământului: înclinată cu 23,44° spre longitudinea ecliptică de 90° (direcția −Z a scenei)
  tilt.rotation.x = -23.44 * (Math.PI / 180);
  group.add(tilt);
  const sunDir = { value: new THREE.Vector3(1, 0, 0) };
  const surface = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 96, 48),
    new THREE.ShaderMaterial({ uniforms: { dayMap: { value: tex(TEX.earthDay) }, nightMap: { value: tex(TEX.earthNight) }, sunDir }, vertexShader: EARTH_VS, fragmentShader: EARTH_FS }),
  );
  const clouds = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.012, 96, 48),
    new THREE.MeshStandardMaterial({ color: 0xffffff, alphaMap: tex(TEX.earthClouds, false), transparent: true, depthWrite: false, roughness: 1 }),
  );
  const atmo = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.06, 64, 32),
    new THREE.ShaderMaterial({ uniforms: { sunDir }, vertexShader: EARTH_VS, fragmentShader: ATMO_FS, transparent: true, blending: THREE.AdditiveBlending, side: THREE.BackSide, depthWrite: false }),
  );
  tilt.add(surface, clouds);
  group.add(atmo);
  return {
    group,
    setSunDir: (d) => sunDir.value.copy(d).normalize(),
    setSpin: (a) => {
      surface.rotation.y = a;
      clouds.rotation.y = a + 0.35; // norii se rotesc odată cu planeta (deriva lor reală e neglijabilă aici)
    },
  };
}

/* ───────── Soarele ───────── */

export function makeSun(radius: number, opts: { textured: boolean; glow: number }): THREE.Group {
  const g = new THREE.Group();
  const disk = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 64, 32),
    opts.textured ? new THREE.MeshBasicMaterial({ map: tex(TEX.sun), color: 0xffe2a8 }) : new THREE.MeshBasicMaterial({ color: 0xfffaf0 }),
  );
  g.add(disk);
  const layers: [string, string, number, number][] = [
    ['rgba(255,250,235,1)', 'rgba(255,220,150,0)', opts.glow * 0.45, 1],
    ['rgba(255,214,140,0.85)', 'rgba(255,150,40,0)', opts.glow, 0.9],
    ['rgba(255,190,110,0.35)', 'rgba(255,120,20,0)', opts.glow * 2.2, 0.6],
  ];
  for (const [inner, outer, size, op] of layers) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(inner, outer), transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.scale.setScalar(radius * size);
    g.add(s);
  }
  g.userData.disk = disk;
  return g;
}

/** Copie în tonuri de gri a unei imagini (pentru regolit), ca textură repetabilă. */
export function grayTexture(url: string, repeat: number): THREE.Texture {
  // imagine provizorie gri (1×1) până se încarcă fotografia
  const ph = document.createElement('canvas');
  ph.width = ph.height = 1;
  const pg = ph.getContext('2d')!;
  pg.fillStyle = '#9a9a9a';
  pg.fillRect(0, 0, 1, 1);
  const t = new THREE.Texture(ph);
  t.needsUpdate = true;
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const g = c.getContext('2d')!;
    g.filter = 'grayscale(1) contrast(1.05) brightness(1.15)';
    g.drawImage(img, 0, 0);
    t.image = c;
    t.needsUpdate = true;
  };
  img.src = url;
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  return t;
}
