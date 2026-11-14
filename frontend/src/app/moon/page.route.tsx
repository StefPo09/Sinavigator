import { MoonPage } from "@/pages/moon/MoonPage";
import { findLandingSite } from "@/components/moon/landingSites";

export default async function MoonRoute({
  searchParams,
}: {
  searchParams: Promise<{ site?: string | string[] }>;
}) {
  return <MoonPage selected={findLandingSite((await searchParams).site)} />;
}
