"use client";

import { ObservatoryLayout } from "@/components/ObservatoryLayout";
import { LandingSitePanel } from "@/components/moon/LandingSitePanel";
import { MoonGlobe } from "@/components/moon/MoonGlobe";
import type { LandingSite } from "@/components/moon/landingSites";
import { useTimeline } from "@/components/Timeline";

export function MoonPage({ selected }: { selected: LandingSite }) {
  const clock = useTimeline(30);

  return (
    <ObservatoryLayout
      title="Moon · Landing sites"
      description="Choose a landing site on the globe or in the sidebar to enter its surface view."
      body="Moon"
      site={selected}
    >
      <MoonGlobe selected={selected} clock={clock} />
      <LandingSitePanel site={selected} />
    </ObservatoryLayout>
  );
}
