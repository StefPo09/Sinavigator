import { LANDING_SITES } from "@/lib/data/landingSites";
import type { Perspective, WS } from "./types";
import Image from "next/image";

const perspectives: { id: Perspective; label: string }[] = [
  { id: "sistem", label: "Sistem solar" },
  { id: "zone", label: "Lună" },
  { id: "suprafata", label: "Suprafață" },
];

export function Brand() {
  return (
    <div className="brand">
      <h1><Image src="/brand/sinavigator-logo.svg" alt="Sinavigator" width={190} height={54} priority /></h1>
      <p>Observatorul tău lunar</p>
    </div>
  );
}

export function WorkspaceNavigation({
  perspective,
  landingId,
  hasLanding,
  flight,
  fading,
  onNavigate,
  onSelectLanding,
}: {
  perspective: Perspective;
  landingId: string | null;
  hasLanding: boolean;
  flight: WS["flight"];
  fading: boolean;
  onNavigate: (perspective: Perspective) => void;
  onSelectLanding: (id: string) => void;
}) {
  return (
    <aside className="workspace-sidebar min-w-0">
      <Brand />
      <nav className="workspace-nav" aria-label="Perspective">
        <p className="k">Spațiu de lucru</p>
        {perspectives.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => onNavigate(id)}
            aria-current={id === perspective ? "page" : undefined}
            disabled={
              id === perspective ||
              !!flight ||
              fading ||
              (perspective === "zone" && id === "suprafata" && !hasLanding)
            }
          >
            {label}
          </button>
        ))}
        {perspective !== "sistem" && (
          <div className="nav-group nav-sites" role="group" aria-label="Locuri lunare">
            <p className="k">Locuri de aterizare</p>
            {LANDING_SITES.map(({ id, name }) => (
              <button
                key={id}
                type="button"
                aria-pressed={landingId === id}
                disabled={!!flight || fading}
                onClick={() => onSelectLanding(id)}
              >
                <span className="nav-dot" aria-hidden="true" />
                {name}
              </button>
            ))}
          </div>
        )}
      </nav>
    </aside>
  );
}
