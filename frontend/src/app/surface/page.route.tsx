import { SurfacePage } from "@/pages/surface/SurfacePage";
import { findLandingSite } from "@/components/moon/landingSites";

export default async function SurfaceRoute({
  searchParams,
}: {
  searchParams: Promise<{ site?: string | string[] }>;
}) {
  const site = findLandingSite((await searchParams).site);
  return <SurfacePage key={site} site={site} />;
}
