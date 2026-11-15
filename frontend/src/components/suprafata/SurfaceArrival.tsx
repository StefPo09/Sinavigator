'use client';

// Replay educațional opțional: un transfer Pământ–Lună estimat de la ora sistemului.
// Nu este zborul Apollo, nici o fereastră de lansare validată, și nu schimbă momentul analizat.
import { useEffect, useRef, useState } from 'react';
import { fmtUtcMs } from '@/lib/logic/format';
import { nextLunarTransfer } from '@/lib/logic/lunarTransfer';
import { TransferDiagram } from './TransferDiagram';
import styles from './SurfaceArrival.module.css';

interface Props {
  site: string;
  onClose: () => void;
}

const DURATION_MS = 4200;

export function SurfaceArrival({ site, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [nowMs] = useState(() => Date.now());
  const [transfer] = useState(() => nextLunarTransfer(nowMs));
  const [reducedMotion] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [progress, setProgress] = useState(reducedMotion ? 1 : 0);

  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    return () => element.close();
  }, []);

  useEffect(() => {
    if (!transfer || reducedMotion) return;
    let frame = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / DURATION_MS);
      setProgress(p);
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [transfer, reducedMotion]);

  const flightTime = transfer ? transfer.departureMs + progress * (transfer.arrivalMs - transfer.departureMs) : null;

  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby="surface-arrival-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className={styles.content}>
        <p className="eyebrow">Educational replay · estimate</p>
        <h2 id="surface-arrival-title">To {site}</h2>
        <p className={styles.modelNote}>
          An idealised orbital transfer, computed from the system clock ({fmtUtcMs(nowMs)}). It is not the historic Apollo flight, not a landing date at this site, and not a validated launch window.
          The analysed moment in the atlas does not change.
        </p>
        {transfer ? (
          <>
            <div className={styles.times}>
              <p>
                <span>Estimated departure from Earth orbit</span>
                <time dateTime={new Date(transfer.departureMs).toISOString()}>{fmtUtcMs(transfer.departureMs)}</time>
              </p>
              <p>
                <span>Estimated arrival near the Moon</span>
                <time dateTime={new Date(transfer.arrivalMs).toISOString()}>{fmtUtcMs(transfer.arrivalMs)}</time>
              </p>
            </div>
            <TransferDiagram transfer={transfer} progress={progress} />
            {flightTime != null && (
              <div className={styles.flight} aria-hidden="true">
                <div className={styles.track}>
                  <span style={{ width: `${progress * 100}%` }} />
                </div>
                <span>{fmtUtcMs(flightTime)}</span>
              </div>
            )}
            <p className={styles.modelNote}>Initial orbit at 200 km, departing on the Sun side. Estimated positions, 2D projection, enlarged discs.</p>
          </>
        ) : (
          <p>No transfer could be estimated for the coming period.</p>
        )}
        <div className="row">
          <button type="button" className="btn primary" onClick={onClose} autoFocus>
            {progress < 1 ? 'Skip' : 'Close'}
          </button>
        </div>
      </div>
    </dialog>
  );
}
