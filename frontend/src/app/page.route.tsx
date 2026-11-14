import { SolarSystemPage } from "@/pages/solar-system/SolarSystemPage";

export default async function SolarSystemRoute({
  searchParams,
}: {
  searchParams: Promise<{ body?: string | string[] }>;
}) {
  const body = (await searchParams).body === "Sun" ? "Sun" : "Earth";
  return <SolarSystemPage key={body} initialBody={body} />;
}
