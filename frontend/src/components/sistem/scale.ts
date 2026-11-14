// Scara schematică a scenei sistemului (declarată în interfață).
export const SCALE = {
  /** raza orbitei Pământului în unități de scenă (1 UA) */
  earthOrbit: 40,
  /** raza medie a orbitei Lunii în unități de scenă — mărită față de scara reală (≈ 0,1 u) */
  moonOrbit: 6,
  sunR: 3.2,
  earthR: 1.1,
  moonR: 0.45,
};
export const MOON_ORBIT_EXAGGERATION = Math.round(SCALE.moonOrbit / ((384_400 / 149_597_870.7) * SCALE.earthOrbit));

