"use client";

import type { Dispatch, SetStateAction } from "react";
import type { LandingSite } from "../moon/landingSites";
import { directionName, signedElevation, type Camera, type skyPositions } from "./camera";

const fields = [
  { key: "heading", label: "Heading", unit: "degrees", min: 0, max: 359 },
  { key: "height", label: "Eye height", unit: "m", min: 1, max: 20 },
  { key: "fov", label: "Field of view", unit: "degrees", min: 35, max: 125 },
] as const;

export function SurfacePanel({ site, camera, setCamera, sky }: {
  site: LandingSite;
  camera: Camera;
  setCamera: Dispatch<SetStateAction<Camera>>;
  sky: ReturnType<typeof skyPositions>;
}) {
  return (
    <aside className="info-card">
      <p className="eyebrow text-accent">Selected landing site</p>
      <h2 className="mt-3 text-[clamp(1.6rem,2.5vw,2.8rem)] leading-tight">{site}</h2>
      <p className="mt-2 text-sm text-muted">Surface view · looking {directionName(camera.heading)}</p>
      <p className="mt-4 text-sm text-muted">You are standing {camera.height} m above the ground.</p>
      <section className="mt-5 border-t border-line pt-4">
        <h3 className="text-lg">At a glance</h3>
        <p className="mt-1 text-sm text-muted">Illustrative sky positions.</p>
        <dl className="mt-3 space-y-3 text-sm">
          {sky.map(({ name, azimuth, elevation }) => (
            <div key={name} className="flex justify-between gap-2">
              <dt className="text-muted">{name}</dt>
              <dd className="text-right font-medium">{signedElevation(elevation)} · az {Math.round(azimuth)}°</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="mt-5 border-t border-line pt-4">
        <h3 className="text-lg">Camera</h3>
        {fields.map(({ key, label, unit, min, max }) => (
          <label key={key} className="mt-4 block text-sm text-muted">
            {label}
            <span className="info-field flex-wrap">
              <span className="text-base text-white">{Math.round(camera[key])} <span className="text-xs text-muted">{unit}</span></span>
              <input
                aria-label={label}
                className="min-w-14 grow cursor-pointer accent-accent"
                type="range" min={min} max={max} value={Math.min(max, Math.round(camera[key]))}
                onChange={(event) => setCamera({ ...camera, [key]: event.currentTarget.valueAsNumber })}
              />
            </span>
          </label>
        ))}
        <div className="mt-5 flex flex-wrap gap-2">
          {sky.map(({ name, azimuth, elevation }) => (
            <button
              key={name}
              className={`ui-button grow ${name === "Sun" ? "ui-button-primary" : ""}`}
              onClick={() => setCamera({ ...camera, heading: azimuth, pitch: elevation })}
              disabled={elevation < 0}
              title={elevation < 0 ? `${name} is below the preview horizon` : undefined}
            >Look at {name}</button>
          ))}
        </div>
      </section>
    </aside>
  );
}
