export const sites = ["Shackleton Rim", "Malapert Massif", "Chandrayaan-3", "Apollo 11", "Apollo 17"] as const;
export type LandingSite = (typeof sites)[number];

export function findLandingSite(value: string | string[] | undefined): LandingSite {
  return sites.find((site) => site === value) ?? sites[0];
}

export function surfaceHref(site: LandingSite) {
  return { pathname: "/surface", query: { site } };
}
