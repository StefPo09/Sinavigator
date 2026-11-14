"use client";

import Link from "next/link";
import { Timeline, type useTimeline } from "../Timeline";
import type { SolarBody } from "../ObservatoryLayout";
import type { Orbit } from "./ObjectPanel";

export function SolarCanvas({ selected, onSelect, clock, orbit }: {
  selected: SolarBody;
  onSelect: (body: SolarBody) => void;
  clock: ReturnType<typeof useTimeline>;
  orbit: Orbit;
}) {
  const angle = 0.25 + (clock.day - 1) * (2 * Math.PI / 365) * orbit.speed / 29.78;
  const orbitWidth = Math.min(34, Math.max(15, 30 * orbit.distance / 149.6));
  const earthX = 39 + orbitWidth * Math.cos(angle);
  const earthY = 48 + 27 * Math.sin(angle);
  const moonAngle = (clock.day - 1) * (2 * Math.PI / 27.32);
  const moonX = earthX + 9 * Math.cos(moonAngle);
  const moonY = earthY + 10 * Math.sin(moonAngle);

  return (
    <section aria-label="Solar system diagram" className="scene-card">
      <div className="flex items-start justify-between gap-2 p-4 sm:p-5">
        <div><p className="eyebrow text-muted">Solar system</p><p className="mt-1 text-sm">Sun-centered view</p></div>
        <span className="ui-button">2D view</span>
      </div>
      <div className="relative isolate min-h-[250px] flex-1 sm:min-h-[clamp(21rem,39vw,41rem)]">
        <div aria-hidden="true" className="absolute left-[39%] top-[48%] h-[54%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border border-dashed border-[#344451]" style={{ width: `${orbitWidth * 2}%` }} />
        <div aria-hidden="true" className="absolute h-[20%] w-[18%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border border-dashed border-[#344451]" style={{ left: `${earthX}%`, top: `${earthY}%` }} />
        <button aria-label="Sun" aria-pressed={selected === "Sun"} onClick={() => onSelect("Sun")} className="absolute left-[39%] top-[48%] -translate-x-1/2 -translate-y-1/2 rounded-full">
          <span className={`block size-[clamp(3rem,6vw,7rem)] rounded-full bg-[radial-gradient(circle,#ffe2a0,#e29338_75%)] shadow-[0_0_0_12px_#e6a14b15,0_0_0_23px_#e6a14b0a] ${selected === "Sun" ? "ring-2 ring-accent" : ""}`} />
          <span className="absolute inset-x-0 top-full mt-2 text-sm">Sun</span>
        </button>
        <button aria-label="Earth" aria-pressed={selected === "Earth"} onClick={() => onSelect("Earth")} className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: `${earthX}%`, top: `${earthY}%` }}>
          <span className={`relative block size-[clamp(1.9rem,4vw,4.5rem)] rounded-full bg-[radial-gradient(circle_at_35%_30%,#9bd2db,#2b5b77_78%)] ${selected === "Earth" ? "ring-2 ring-accent ring-offset-4 ring-offset-scene" : ""}`}>
            {orbit.tilt !== 23.44 && <span aria-hidden="true" className="absolute inset-y-0 left-1/2 w-px bg-white/60" style={{ rotate: `${orbit.tilt}deg` }} />}
          </span>
          <span className="absolute left-1/2 top-full mt-2 -translate-x-1/2 text-sm">Earth</span>
        </button>
        <Link href="/moon" aria-label="Open Moon landing sites" className="absolute grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full hover:text-accent" style={{ left: `${moonX}%`, top: `${moonY}%` }}>
          <span className="size-[clamp(.7rem,1.35vw,1.65rem)] rounded-full bg-[radial-gradient(circle_at_35%_30%,#fff,#9298a2)]" />
          <span className="absolute left-[82%] text-xs sm:text-sm">Moon</span>
        </Link>
      </div>
      <Timeline clock={clock} year />
    </section>
  );
}
