"use client";

import { useState } from "react";
import type { SolarBody } from "../ObservatoryLayout";

export const initialOrbit = { distance: 149.6, speed: 29.78, tilt: 23.44 };
export type Orbit = typeof initialOrbit;

const bodies = {
  Earth: {
    subtitle: "Terrestrial planet · orbits the Sun",
    description: "Our home world, with one natural satellite: the Moon.",
    stats: [["Mean radius", "6,371 km"], ["Mass", "5.972 × 10²⁴ kg"], ["Orbital period", "365.25 days"]],
    color: "bg-[#7db9ec]",
  },
  Sun: {
    subtitle: "Star · center of the diagram",
    description: "The source of light and heat for the planets that orbit it.",
    stats: [["Mean radius", "696,340 km"], ["Mass", "1.989 × 10³⁰ kg"]],
    color: "bg-[#ffc471]",
  },
};

const fields = [
  { key: "distance", label: "Distance from Sun", unit: "million km", min: 1, max: 1000 },
  { key: "speed", label: "Orbital speed", unit: "km/s", min: 0.1, max: 300 },
  { key: "tilt", label: "Axial tilt", unit: "degrees", min: 0, max: 180 },
] as const;

export function ObjectPanel({ selected, orbit, onApply }: {
  selected: SolarBody;
  orbit: Orbit;
  onApply: (orbit: Orbit) => void;
}) {
  const [draft, setDraft] = useState(orbit);
  const body = bodies[selected];

  return (
    <aside className="info-card">
      <p className="eyebrow text-accent">Selected object</p>
      <div className="mt-3 flex items-start justify-between gap-2">
        <h2 className="text-[clamp(1.6rem,2.5vw,2.8rem)] leading-tight">{selected}</h2>
        <span aria-hidden="true" className={`size-9 shrink-0 rounded-full xl:size-12 ${body.color}`} />
      </div>
      <p className="mt-1 text-sm text-muted">{body.subtitle}</p>
      <p className="mt-4 text-sm text-muted">{body.description}</p>
      <section className="mt-5 border-t border-line pt-4">
        <h3 className="text-lg">At a glance</h3>
        <dl className="mt-3 space-y-3 text-sm">
          {body.stats.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-2">
              <dt className="text-muted">{label}</dt><dd className="text-right font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      </section>
      {selected === "Earth" && (
        <form onSubmit={(event) => { event.preventDefault(); onApply(draft); }} className="mt-5 border-t border-line pt-4">
          <h3 className="text-lg">Adjust simulation</h3>
          <p className="mt-1 text-sm text-muted">Changes update the orbit preview.</p>
          {fields.map(({ key, label, unit, min, max }) => (
            <label key={key} className="mt-4 block text-sm text-muted">
              {label}
              <span className="info-field">
                <input
                  type="number" required step="any" min={min} max={max}
                  className="min-w-0 flex-1 text-base text-white"
                  value={Number.isFinite(draft[key]) ? draft[key] : ""}
                  onChange={(event) => setDraft({ ...draft, [key]: event.currentTarget.valueAsNumber })}
                />
                <span className="shrink-0 text-xs">{unit}</span>
              </span>
            </label>
          ))}
          <div className="mt-5 flex flex-wrap gap-2">
            <button type="submit" className="ui-button ui-button-primary grow">Apply changes</button>
            <button type="button" className="ui-button" onClick={() => { setDraft(initialOrbit); onApply(initialOrbit); }}>Reset</button>
          </div>
        </form>
      )}
    </aside>
  );
}
