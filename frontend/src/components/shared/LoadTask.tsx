'use client';

// Plain in-scene status for a 3D load: label, progress bar and optional detail.
interface Props {
  label: string;
  pct?: number | null;
  detail?: string;
}

export function LoadTask({ label, pct = null, detail }: Props) {
  const known = pct != null && Number.isFinite(pct);
  return (
    <div className="scene-loading" role="status">
      <div className="scene-loading-box">
        <p>{label}…</p>
        <div className="load-bar" aria-hidden="true">
          <span style={{ width: known ? `${pct}%` : '0%' }} />
        </div>
        {(known || detail) && (
          <p className="mono small">
            {known ? `${pct} %` : ''}
            {known && detail ? ' · ' : ''}
            {detail}
          </p>
        )}
      </div>
    </div>
  );
}
