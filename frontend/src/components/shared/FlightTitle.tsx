// Title card laid over a scene during a camera flight: letterbox, vignette and the destination.
export function FlightTitle({ eyebrow, title, detail }: { eyebrow: string; title: string; detail?: string }) {
  return (
    <div className="flight-overlay" aria-live="polite">
      <div className="flight-vignette" aria-hidden="true" />
      <div className="flight-title">
        <p className="flight-eyebrow">{eyebrow}</p>
        <p className="flight-name">{title}</p>
        {detail && <p className="flight-detail">{detail}</p>}
      </div>
    </div>
  );
}
