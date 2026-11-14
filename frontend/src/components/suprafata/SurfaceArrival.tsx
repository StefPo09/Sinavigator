'use client';

import { useEffect, useRef, useState } from 'react';
import { fmtUtcMs } from '@/lib/logic/format';
import { nextLunarTransfer } from '@/lib/logic/lunarTransfer';
import { TransferDiagram } from './TransferDiagram';
import styles from './SurfaceArrival.module.css';

interface Props {
  site: string;
  presented: boolean;
  onComplete: () => void;
  onText: () => void;
  onBack: () => void;
}

export function SurfaceArrival({ site, presented, onComplete, onText, onBack }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [transfer] = useState(() => nextLunarTransfer(Date.now()));
  const [reducedMotion] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const [slow, setSlow] = useState(false);
  const [progress, setProgress] = useState(0);
  const progressRef = useRef(0);

  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    const timer = window.setTimeout(() => setSlow(true), 12_000);
    return () => {
      window.clearTimeout(timer);
      element.close();
    };
  }, []);

  useEffect(() => {
    if (!transfer || reducedMotion) {
      if (!presented) return;
      const frame = requestAnimationFrame(onComplete);
      return () => cancelAnimationFrame(frame);
    }

    let frame: number;
    let previous: number | undefined;
    const tick = (now: number) => {
      const step = Math.min(now - (previous ?? now), 100) / 4200;
      previous = now;
      const p = progressRef.current;
      // Let the flight continue at a decreasing rate, reserving the final segment for when the surface is ready.
      const factor = presented || p < 0.52 ? 1 : Math.max(0, (0.94 - p) / 1.1);
      const next = Math.min(presented ? 1 : 0.94, p + step * factor);
      progressRef.current = next;
      setProgress(next);
      if (next < 1) frame = requestAnimationFrame(tick);
      else frame = requestAnimationFrame(onComplete);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [transfer, reducedMotion, presented, onComplete]);

  const flightTime = transfer ? transfer.departureMs + progress * (transfer.arrivalMs - transfer.departureMs) : null;

  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby="surface-arrival-title"
      onCancel={(event) => {
        event.preventDefault();
        onBack();
      }}
    >
      <div className={styles.content}>
        <p className="k">{transfer ? 'Simulare · Transfer orbital Pământ–Lună' : 'Sinavigator · Suprafața Lunii'}</p>
        <h2 id="surface-arrival-title">{site}</h2>
        {transfer ? (
          <>
            <div className={styles.times}>
              <p><span>Plecare de pe orbită</span><time dateTime={new Date(transfer.departureMs).toISOString()}>{fmtUtcMs(transfer.departureMs)}</time></p>
              <p><span>Sosire în vecinătatea Lunii</span><time dateTime={new Date(transfer.arrivalMs).toISOString()}>{fmtUtcMs(transfer.arrivalMs)}</time></p>
            </div>
            <TransferDiagram transfer={transfer} progress={progress} />
            {!reducedMotion && flightTime != null && (
              <div className={styles.flight} aria-hidden="true">
                <div className={styles.track}><span style={{ width: `${progress * 100}%` }} /></div>
                <span>{fmtUtcMs(flightTime)}</span>
              </div>
            )}
            <p className={styles.modelNote}>Orbită inițială la 200 km, cu plecare dinspre Soare. Poziții estimate, proiecție 2D și discuri mărite. Simularea se termină la întâlnirea cu Luna.</p>
          </>
        ) : (
          <div className={styles.moon} aria-hidden="true" />
        )}
        <p role="status">{presented ? 'Suprafața este pregătită.' : slow ? 'Scena durează mai mult să se încarce.' : 'Se pregătește scena de pe suprafață…'}</p>
        {slow && (
          <div className="row">
            <button type="button" className="btn primary" onClick={onText}>Deschide vederea 2D</button>
            <button type="button" className="btn" onClick={onBack}>Înapoi la Lună</button>
          </div>
        )}
      </div>
    </dialog>
  );
}
