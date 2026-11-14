"use client";

import { useState } from "react";
import { ObservatoryLayout } from "@/components/ObservatoryLayout";
import type { LandingSite } from "@/components/moon/landingSites";
import { SurfacePanel } from "@/components/surface/SurfacePanel";
import { SurfaceScene } from "@/components/surface/SurfaceScene";
import { defaultCamera, skyPositions } from "@/components/surface/camera";
import { Timeline, useTimeline } from "@/components/Timeline";

export function SurfacePage({ site }: { site: LandingSite }) {
  const [camera, setCamera] = useState(defaultCamera);
  const clock = useTimeline(30);
  const sky = skyPositions(clock.day);

  return (
    <ObservatoryLayout
      title={`${site} · Surface view`}
      description="Drag to look around. The timeline moves the Sun and Earth in the preview."
      body="Moon"
      site={site}
      isSurface
    >
      <section className="scene-card">
        <SurfaceScene site={site} camera={camera} setCamera={setCamera} sky={sky} />
        <Timeline clock={clock} />
      </section>
      <SurfacePanel site={site} camera={camera} setCamera={setCamera} sky={sky} />
    </ObservatoryLayout>
  );
}
