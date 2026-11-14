export const defaultCamera = { heading: 262, pitch: 0, height: 2, fov: 90 };
export type Camera = typeof defaultCamera;

export function wrapHeading(heading: number) {
  return (heading % 360 + 360) % 360;
}

export function directionName(heading: number) {
  const directions = ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"];
  return directions[Math.round(heading / 45) % 8];
}

export function skyPositions(day: number) {
  const phase = (day - 1) / 30 * 2 * Math.PI;
  return [
    { name: "Sun", azimuth: 238 + 20 * Math.sin(phase), elevation: 0.9 + 4 * Math.sin(phase), color: "#ffbf6c", body: "sun" },
    { name: "Earth", azimuth: 300 + 8 * Math.sin(phase), elevation: 3.2 + 2 * Math.sin(phase), color: "#7db9ec", body: "earth" },
  ] as const;
}

export function signedElevation(elevation: number) {
  return `${elevation >= 0 ? "+" : ""}${elevation.toFixed(1)}°`;
}
