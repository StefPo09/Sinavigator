"use client";

import Link from "next/link";
import { useRef, type Dispatch, type SetStateAction } from "react";
import { sites, type LandingSite } from "../moon/landingSites";
import { directionName, signedElevation, wrapHeading, type Camera, type skyPositions } from "./camera";
import styles from "./SurfaceScene.module.css";

const stars = Array.from({ length: 105 }, (_, i) => ({
  x: (i * 71.431 + i * i * 1.11) % 100,
  y: (i * 13.297 + i * i * 0.11) % 93,
  opacity: 0.18 + (i % 7) * 0.11,
  size: i % 9 === 0 ? 2 : 1,
}));

const rocks = [[14, 74, 7], [39, 82, 4], [60, 70, 5], [86, 65, 5], [18, 38, 3], [47, 26, 2]];
const headings = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

export function SurfaceScene({ site, camera, setCamera, sky }: {
  site: LandingSite;
  camera: Camera;
  setCamera: Dispatch<SetStateAction<Camera>>;
  sky: ReturnType<typeof skyPositions>;
}) {
  const drag = useRef<{ x: number; y: number } | null>(null);
  const horizon = 50 + camera.pitch * 0.95 + (camera.height - 2) * 0.55;
  const nearestHeading = Math.round(camera.heading / 45);
  const sceneryOffset = 6 * Math.sin((camera.heading - 262) * Math.PI / 180);
  const terrainOffset = sites.indexOf(site) * 6;

  function turn(yaw: number, pitch: number) {
    setCamera((previous) => ({
      ...previous,
      heading: wrapHeading(previous.heading + yaw),
      pitch: Math.max(-34, Math.min(34, previous.pitch + pitch)),
    }));
  }

  return (
    <div className="relative isolate flex min-h-[360px] flex-1 flex-col overflow-hidden rounded-[inherit] bg-[#090d14] sm:min-h-[clamp(29rem,48vw,48rem)]">
      <div
        tabIndex={0}
        role="group"
        aria-label="Surface camera. Drag or use the arrow keys to look around."
        className="absolute inset-0 touch-none overflow-hidden outline-offset-[-3px] [cursor:grab] active:[cursor:grabbing]"
        onPointerDown={(event) => {
          if (event.button !== 0 || !event.isPrimary) return;
          drag.current = { x: event.clientX, y: event.clientY };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!drag.current || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
          turn((drag.current.x - event.clientX) * 0.23, (event.clientY - drag.current.y) * 0.17);
          drag.current = { x: event.clientX, y: event.clientY };
        }}
        onLostPointerCapture={() => { drag.current = null; }}
        onKeyDown={(event) => {
          const deltas: Record<string, [number, number]> = { ArrowLeft: [-5, 0], ArrowRight: [5, 0], ArrowUp: [0, 4], ArrowDown: [0, -4] };
          const delta = deltas[event.key];
          if (delta) {
            event.preventDefault();
            turn(...delta);
          }
        }}
      >
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="absolute inset-x-0 top-0 bg-linear-to-b from-[#05070c] to-[#0b1119]" style={{ height: `${horizon}%` }}>
            {stars.map(({ x, y, opacity, size }, i) => (
              <span key={i} className="absolute rounded-full bg-white" style={{
                left: `${(x + 100 - camera.heading / 3.6) % 100}%`, top: `${y}%`, opacity, width: size, height: size,
              }} />
            ))}
          </div>
          <div className={`${styles.ridge} absolute -inset-x-16 h-[10%] bg-[#454b54]`} style={{ bottom: `${100 - horizon - 1}%`, translate: `${sceneryOffset / 2 + terrainOffset}px 0` }} />
          <div className={`${styles.ground} absolute inset-x-0 bottom-0`} style={{ top: `${horizon}%` }}>
            <div className={`${styles.grid} absolute inset-0`} />
            <div className="absolute left-[11%] top-[50%] h-[18%] w-[45%] rounded-[50%] bg-black/25" style={{ translate: `${sceneryOffset + terrainOffset}px 0` }} />
            <div className="absolute right-[13%] top-[33%] h-[9%] w-[23%] rounded-[50%] bg-black/20" />
            <div className={`${styles.lander} absolute left-[68%] top-[27%] h-[22%] w-[13%]`} style={{ translate: `${sceneryOffset - terrainOffset}px 0` }}>
              <span /><i /><i /><i /><i />
            </div>
            {rocks.map(([x, y, size]) => (
              <div className={`${styles.rock} absolute h-[7%]`} key={x} style={{ left: `${x}%`, top: `${y}%`, width: `${size}%`, translate: `${sceneryOffset - terrainOffset}px 0` }} />
            ))}
          </div>
          {sky.map(({ name, azimuth, elevation, body, color }) => {
            const relative = wrapHeading(azimuth - camera.heading + 180) - 180;
            const x = 50 + relative / camera.fov * 100;
            const y = horizon - 2 - elevation * 1.5;
            return x > 0 && x < 100 && elevation >= 0 && (
              <div key={name} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${x}%`, top: `${y}%`, color }}>
                <span className={`block rounded-full ${styles[body]}`} />
                <span className={`absolute bottom-full mb-2 whitespace-nowrap text-xs [text-shadow:0_1px_4px_#000] ${x > 80 ? "right-0" : x < 20 ? "left-0" : "left-1/2 -translate-x-1/2"}`}>
                  {name}<span className="hidden sm:inline"> · az {Math.round(azimuth)}° · {signedElevation(elevation)}</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="pointer-events-none relative flex items-start justify-between gap-2 p-4 sm:p-5">
        <div><p className="eyebrow text-muted">Surface view</p><p className="mt-1 text-sm">{site} · facing {directionName(camera.heading)}</p></div>
        <Link href={{ pathname: "/moon", query: { site } }} className="ui-button pointer-events-auto shrink-0">Back to globe</Link>
      </div>
      <div aria-hidden="true" className="pointer-events-none relative mx-auto flex w-[54%] min-w-36 items-center justify-around rounded-full bg-scene/90 py-2 text-xs">
        {[7, 8, 9].map((offset) => (
          <span key={offset} className="flex flex-col items-center gap-1"><span className="h-2 border-l border-muted" />{headings[(nearestHeading + offset) % 8]}</span>
        ))}
        <span className="absolute -top-1 left-1/2 -translate-x-1/2 text-accent">▼</span>
      </div>
      <div className="pointer-events-none relative mt-auto self-start p-4 text-center text-xs">
        <div aria-hidden="true" className="relative mx-auto mb-1 size-12 rounded-full border-2 border-scene" style={{ rotate: `${camera.heading - 262}deg` }}>
          <span className="absolute bottom-1 left-1/2 size-2 -translate-x-1/2 rounded-full bg-accent" />
        </div>
        {site}
      </div>
    </div>
  );
}
