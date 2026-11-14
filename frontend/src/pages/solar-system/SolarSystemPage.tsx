"use client";

import { useState } from "react";
import { ObservatoryLayout, type SolarBody } from "@/components/ObservatoryLayout";
import { ObjectPanel, initialOrbit } from "@/components/solar-system/ObjectPanel";
import { SolarCanvas } from "@/components/solar-system/SolarCanvas";
import { useTimeline } from "@/components/Timeline";

export function SolarSystemPage({ initialBody }: { initialBody: SolarBody }) {
  const [body, setBody] = useState(initialBody);
  const [orbit, setOrbit] = useState(initialOrbit);
  const clock = useTimeline(365);

  return (
    <ObservatoryLayout
      title="Sun, Earth & Moon"
      description="Explore their orbits. Select a body to inspect it."
      body={body}
      onBodySelect={setBody}
    >
      <SolarCanvas selected={body} onSelect={setBody} clock={clock} orbit={orbit} />
      <ObjectPanel key={body} selected={body} orbit={orbit} onApply={setOrbit} />
    </ObservatoryLayout>
  );
}
