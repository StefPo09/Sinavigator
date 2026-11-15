import { redirect } from "next/navigation";

export default async function MoonRoute({
  searchParams,
}: {
  searchParams: Promise<{ site?: string | string[] }>;
}) {
  const { site } = await searchParams;
  const query = new URLSearchParams({ p: "zone" });
  if (typeof site === "string") query.set("site", site);
  redirect(`/?${query}`);
}
