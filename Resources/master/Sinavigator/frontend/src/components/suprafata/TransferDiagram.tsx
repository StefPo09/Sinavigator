import { useId, useMemo } from 'react';
import { transferFrame, type Point, type Transfer } from '@/lib/logic/lunarTransfer';
import styles from './SurfaceArrival.module.css';

const ORIGIN = [218, 111] as const;
const PIXELS_PER_KM = 0.00076;
const project = ([x, y]: Point) => [ORIGIN[0] + x * PIXELS_PER_KM, ORIGIN[1] - y * PIXELS_PER_KM];
const line = (samples: Point[]) => samples.map((point) => project(point).join(',')).join(' ');
const stars = Array.from({ length: 70 }, (_, i) => ({
  x: (i * 187.21 + i * i * 3.39) % 625,
  y: (i * 59.13 + i * i * 1.17) % 455,
  radius: i % 11 === 0 ? 1.3 : 0.7,
}));

export function TransferDiagram({ transfer, progress }: { transfer: Transfer; progress: number }) {
  const id = useId();
  const { trajectory, lunarArc } = useMemo(() => {
    const samples = Array.from({ length: 161 }, (_, i) => transferFrame(transfer, (i / 160) ** 2));
    return { trajectory: line(samples.map((s) => s.craft)), lunarArc: line(samples.map((s) => s.moon)) };
  }, [transfer]);

  const frame = transferFrame(transfer, progress);
  const [mx, my] = project(frame.moon);
  const [cx, cy] = project(frame.craft);
  const [ex, ey] = ORIGIN;
  const sx = ex + 150 * Math.cos(frame.sunAngle);
  const sy = ey - 150 * Math.sin(frame.sunAngle);
  return (
    <svg viewBox="0 0 625 455" className={styles.diagram} role="img" aria-labelledby={`${id}-title`}>
      <title id={`${id}-title`}>Transfer orbital simulat în proiecție ecliptică, cu poziția Lunii și direcția Soarelui la momentul afișat</title>
      <defs>
        <radialGradient id={`${id}-earth`} cx="33%" cy="26%">
          <stop stopColor="#c4e8ff" />
          <stop offset=".48" stopColor="#538eba" />
          <stop offset="1" stopColor="#21364e" />
        </radialGradient>
        <radialGradient id={`${id}-moon`} cx="31%" cy="27%">
          <stop stopColor="#efeff2" />
          <stop offset=".55" stopColor="#a2abb5" />
          <stop offset="1" stopColor="#495360" />
        </radialGradient>
      </defs>
      <g fill="#91a1b5" opacity=".32" aria-hidden="true">
        {stars.map(({ x, y, radius }, i) => <circle key={i} cx={x} cy={y} r={radius} />)}
      </g>
      <line x1={ex} y1={ey} x2={sx} y2={sy} stroke="#9a743e" strokeDasharray="3 6" />
      <circle cx={sx} cy={sy} r="6" fill="#ffc77d" />
      <text x={sx} y={sy - 16} fill="#ffc77d" textAnchor="middle">Spre Soare</text>
      <polyline points={lunarArc} fill="none" stroke="#6a7787" strokeWidth="1.4" strokeDasharray="4 7" />
      <polyline points={trajectory} fill="none" stroke="#d8f479" strokeWidth="1.6" strokeOpacity=".76" />
      <circle cx={ex} cy={ey} r="15" fill={`url(#${id}-earth)`} />
      <text x={ex} y={ey - 24} fill="#afd8f5" textAnchor="middle">Pământ</text>
      <circle cx={mx} cy={my} r="10" fill={`url(#${id}-moon)`} />
      <text x={mx + 16} y={my + 4} fill="#e0e5ed">Lună</text>
      <circle cx={cx} cy={cy} r="9" fill="#d8f479" opacity=".20" />
      <circle cx={cx} cy={cy} r="4" fill="#ecffa9" stroke="#172019" strokeWidth="1" />
      <text x={Math.max(ex + 27, cx)} y={cy + 29} fill="#d8f479" textAnchor="middle">Navă</text>
    </svg>
  );
}
