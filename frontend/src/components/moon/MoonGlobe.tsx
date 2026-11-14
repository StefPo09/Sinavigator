import Link from "next/link";
import { Timeline, type useTimeline } from "../Timeline";
import { sites, surfaceHref, type LandingSite } from "./landingSites";

const positions = {
  "Shackleton Rim": [50, 79],
  "Malapert Massif": [48, 72],
  "Chandrayaan-3": [55, 60],
  "Apollo 11": [55, 17],
  "Apollo 17": [62, 10],
} as const;

const craters = [
  [22, 28, 28, 21], [53, 21, 20, 16], [42, 36, 23, 17], [62, 38, 16, 21],
  [17, 45, 18, 14], [32, 11, 8, 8], [24, 26, 8, 8], [80, 31, 8, 8],
  [72, 35, 8, 8], [45, 52, 8, 8], [51, 48, 6, 6], [57, 55, 10, 10],
  [38, 83, 8, 8], [22, 78, 6, 6], [64, 57, 6, 6], [77, 60, 4, 4],
  [62, 76, 4, 4], [18, 71, 5, 5], [40, 63, 3, 3], [56, 65, 3, 3],
  [32, 45, 3, 3], [15, 34, 3, 3], [60, 34, 5, 5], [49, 56, 4, 4],
];

export function MoonGlobe({ selected, clock }: {
  selected: LandingSite;
  clock: ReturnType<typeof useTimeline>;
}) {
  const light = 40 + 23 * Math.sin((clock.day - 1) * 2 * Math.PI / 30);

  return (
    <section className="scene-card" aria-label="Moon globe and landing sites">
      <div className="flex items-start justify-between gap-2 p-4 sm:p-5">
        <div><p className="eyebrow text-muted">Moon</p><p className="mt-1 text-sm">Landing sites view</p></div>
        <span className="ui-button">Globe view</span>
      </div>
      <div className="grid flex-1 place-items-center px-3 pb-3">
        <div className="relative aspect-square w-[92%] max-w-[clamp(21rem,42vw,42rem)]">
          <div
            aria-hidden="true"
            className="absolute inset-[2%] overflow-hidden rounded-full shadow-[inset_-1.1rem_-0.7rem_0_0.4rem_#353e48aa,0_0_0_0.65rem_#0e151d,0_0_0_0.73rem_#1c2631]"
            style={{ background: `radial-gradient(circle at ${light}% 37%, #e3e5e7, #a5abb1 52%, #626b75 90%)` }}
          >
            {craters.map(([x, y, w, h]) => (
              <span key={`${x}-${y}`} className="absolute rounded-[50%] bg-[#444d58]" style={{
                left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%`, opacity: w > 12 ? 0.27 : 0.13,
              }} />
            ))}
          </div>
          {sites.map((site) => {
            const [x, y] = positions[site];
            return (
              <Link
                key={site}
                aria-label={`View ${site} from the surface`}
                href={surfaceHref(site)}
                className="group absolute grid size-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full"
                style={{ left: `${x}%`, top: `${y}%` }}
              >
                <span className={`size-3 rounded-full border-2 border-space group-hover:bg-accent ${selected === site ? "bg-accent ring-2 ring-accent ring-offset-2 ring-offset-transparent" : "bg-white"}`} />
                <span className={`pointer-events-none absolute hidden whitespace-nowrap text-xs [text-shadow:0_1px_4px_#000,0_1px_3px_#000] min-[500px]:block ${site === "Malapert Massif" ? "right-8" : "left-8"}`}>{site}</span>
              </Link>
            );
          })}
        </div>
      </div>
      <Timeline clock={clock} />
    </section>
  );
}
