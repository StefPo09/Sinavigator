import Link from "next/link";
import type { ReactNode } from "react";
import { sites, surfaceHref, type LandingSite } from "./moon/landingSites";

export type SolarBody = "Sun" | "Earth";

const bodies = [
  { name: "Sun", color: "bg-[#ffc471]" },
  { name: "Earth", color: "bg-[#7db9ec]" },
  { name: "Moon", color: "bg-[#cfd3df]" },
] as const;

export function ObservatoryLayout({
  title, description, body, site, isSurface, onBodySelect, children,
}: {
  title: string;
  description: string;
  body: SolarBody | "Moon";
  site?: LandingSite;
  isSurface?: boolean;
  onBodySelect?: (body: SolarBody) => void;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto min-h-screen min-[860px]:grid min-[860px]:grid-cols-[clamp(9rem,14.2vw,15rem)_minmax(0,1fr)]">
      <aside className="bg-[#11161d] p-3 min-[860px]:rounded-r-xl">
        <Link href="/" className="flex items-center gap-3 px-2 py-2 min-[860px]:block min-[860px]:px-3">
          <span aria-hidden="true" className="orbit-logo mx-auto shrink-0" />
          <span className="block text-xl tracking-tight min-[860px]:mt-3 min-[860px]:text-[clamp(1.35rem,2.05vw,2.2rem)]">Sinavigator</span>
          <span className="mt-2 hidden text-[clamp(.55rem,.72vw,.8rem)] tracking-wider text-[#9cacc1] min-[860px]:block">YOUR PERSONAL OBSERVATORY</span>
        </Link>
        <nav aria-label="Observatory" className="mt-2 flex flex-wrap items-center gap-1 min-[860px]:mt-5 min-[860px]:block">
          <p className="nav-caption">Workspace</p>
          <Link href="/" className="block rounded-lg bg-accent px-3 py-2 text-[#10161e] min-[860px]:mb-9">Solar system</Link>
          <p className="nav-caption">Objects / 03</p>
          {bodies.map(({ name, color }) => {
            const active = body === name;
            const className = `nav-item ${active ? "bg-control" : ""}`;
            const contents = (
              <>
                <span className={`size-2.5 shrink-0 rounded-full ${color}`} />
                {name}
                {active && <span className="ml-auto hidden text-[.68rem] text-accent min-[1100px]:inline">Selected</span>}
              </>
            );
            return name !== "Moon" && onBodySelect ? (
              <button key={name} type="button" className={className} aria-pressed={active} onClick={() => onBodySelect(name)}>
                {contents}
              </button>
            ) : (
              <Link key={name} href={name === "Moon" ? "/moon" : { pathname: "/", query: { body: name } }} className={className}>
                {contents}
              </Link>
            );
          })}
          {site && (
            <div className="flex w-full flex-wrap gap-1 min-[860px]:mt-9 min-[860px]:block">
              <p className="nav-caption">Landing sites / 05</p>
              {sites.map((name) => (
                <Link
                  key={name}
                  href={surfaceHref(name)}
                  aria-current={isSurface && name === site ? "page" : undefined}
                  className={`nav-item text-sm ${name === site ? "bg-control" : ""}`}
                >
                  <span className={`size-2 shrink-0 rounded-full ${name === site ? "bg-accent" : "bg-[#8292a4]"}`} />
                  {name}
                </Link>
              ))}
            </div>
          )}
        </nav>
      </aside>
      <section className="min-w-0">
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-4 sm:px-5 lg:py-5">
          <h1 className="text-[clamp(1.45rem,2.5vw,2.8rem)] leading-tight">{title}</h1>
          <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-full border border-accent text-accent">◇</span>
        </header>
        <div className="px-4 pb-6 sm:px-5">
          <p className="my-3 text-sm text-muted sm:text-base">{description}</p>
          <div className="grid items-stretch gap-4 min-[1000px]:grid-cols-[minmax(0,2.3fr)_minmax(15rem,1fr)] min-[1350px]:gap-6">
            {children}
          </div>
        </div>
      </section>
    </main>
  );
}
