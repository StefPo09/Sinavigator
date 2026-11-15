'use client';

// First-visit tutorial that never covers the page: the element to use glows and (for buttons)
// bobs, and a small tip sits next to it. Steps that ask for an action advance by themselves
// when the visitor does it; the rest have a Next button.
import { useEffect, useLayoutEffect, useState } from 'react';
import type { Perspective, WS } from '../shared/types';

const PAGE: Record<Perspective, string> = { sistem: 'System', zone: 'Moon', suprafata: 'Surface' };

interface Step {
  title: string;
  body: string;
  /** the page the step happens on; elsewhere, the menu entry for that page glows instead */
  page?: Perspective;
  /** element to highlight on that page */
  target?: string;
  /** an action step: completes (and advances) when this becomes true */
  done?: (ws: WS) => boolean;
}

const STEPS: Step[] = [
  {
    title: 'Your mission',
    body: 'A lunar rover needs 2 continuous hours with the Sun visible (solar power) and the Earth visible (radio link home). Find a landing site and a date where that works. Follow the glowing controls — the page stays fully usable.',
  },
  {
    page: 'sistem',
    target: '.system-tableau',
    title: 'Sun, Earth and Moon',
    body: 'The three bodies at the analysed moment, with the Moon at its computed position. A schematic picture: sizes and distances are not to scale.',
  },
  {
    page: 'sistem',
    target: '.timeline',
    title: 'The timeline',
    body: 'This sets the analysed moment, in UTC. Press play or drag to move time; every view follows it.',
  },
  {
    page: 'sistem',
    target: '.sys-enter',
    title: 'Fly to the Moon',
    body: 'Press the glowing button (or click the Moon itself).',
    done: (ws) => ws.stage !== 'sistem',
  },
  {
    page: 'zone',
    target: '.nav-sites',
    title: 'Pick a landing site',
    body: 'Apollo 15 landed at Hadley–Apennine, Apollo 17 in the Taurus–Littrow valley. Choose one here or click its marker on the globe.',
    done: (ws) => ws.landing != null,
  },
  {
    page: 'zone',
    target: '.conclusion',
    title: 'The answer, computed',
    body: '✓ means the 2-hour activity fits in this period; ✕ means it does not. “Why?” names the body (Sun or Earth) and the terrain that limit it.',
  },
  {
    page: 'zone',
    target: '.tl-track',
    title: 'Read the colours',
    body: 'Green: Sun and Earth both visible. Yellow: only the Sun. Blue: only the Earth. ▲▼ mark the computed rise and set moments.',
  },
  {
    page: 'zone',
    target: '.insp-enter',
    title: 'Walk on the surface',
    body: 'Press the glowing button to land at the site.',
    done: (ws) => ws.stage === 'suprafata',
  },
  {
    page: 'suprafata',
    target: '.scene-view',
    title: 'Look around',
    body: 'Real Apollo terrain, with the Sun and Earth where the data puts them. Drag to look. Directions are azimuths from north: 90° east, 180° south, 270° west.',
  },
];

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const TIP_W = 300;

export function Tour({ ws, onFinish, onSkip }: { ws: WS; onFinish: () => void; onSkip: () => void }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const step = STEPS[i];
  const { stage, flight } = ws;
  const away = step.page != null && step.page !== stage && !step.done?.(ws);
  const selector = flight ? null : away ? `.nav-item[data-stage='${step.page}']` : (step.target ?? null);
  const last = i === STEPS.length - 1;
  const actionDone = !!step.done?.(ws);

  // action steps move on as soon as the visitor has done the action
  useEffect(() => {
    if (!actionDone) return;
    const id = window.setTimeout(() => setI((n) => (n === i ? Math.min(n + 1, STEPS.length - 1) : n)), 450);
    return () => window.clearTimeout(id);
  }, [actionDone, i]);

  // glow on the target, and follow it through layout, scroll and resize
  useLayoutEffect(() => {
    let raf = 0;
    let scrolled = false;
    let marked: HTMLElement | null = null;
    const measure = () => {
      const el = selector ? (document.querySelector(selector) as HTMLElement | null) : null;
      if (el !== marked) {
        marked?.removeAttribute('data-tour');
        marked = el;
        el?.setAttribute('data-tour', el.matches('button, a') ? 'button' : 'area');
      }
      if (el) {
        if (!scrolled) {
          scrolled = true;
          const r0 = el.getBoundingClientRect();
          if (r0.top < 60 || r0.bottom > window.innerHeight - 40) el.scrollIntoView({ block: r0.height > window.innerHeight * 0.6 ? 'start' : 'center', behavior: 'smooth' });
        }
        const r = el.getBoundingClientRect();
        setRect((p) => (p && p.top === r.top && p.left === r.left && p.width === r.width && p.height === r.height ? p : { top: r.top, left: r.left, width: r.width, height: r.height }));
      } else setRect(null);
      raf = requestAnimationFrame(measure);
    };
    raf = requestAnimationFrame(measure);
    return () => {
      cancelAnimationFrame(raf);
      marked?.removeAttribute('data-tour');
    };
  }, [selector]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onSkip();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onSkip]);

  // the tip sits beside the target: right of it, else left, else below/above; docked when there is none
  let style: React.CSSProperties | undefined;
  if (rect && typeof window !== 'undefined') {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const GAP = 14;
    const H = 210;
    const big = rect.width > vw * 0.45 || rect.height > vh * 0.45;
    if (big) style = { top: Math.min(vh - H - 16, Math.max(16, rect.top + 16)), left: Math.min(vw - TIP_W - 16, Math.max(16, rect.left + rect.width - TIP_W - 16)) };
    else if (rect.left + rect.width + GAP + TIP_W < vw - 8) style = { top: Math.max(16, Math.min(vh - H - 16, rect.top + rect.height / 2 - 60)), left: rect.left + rect.width + GAP };
    else if (rect.left - GAP - TIP_W > 8) style = { top: Math.max(16, Math.min(vh - H - 16, rect.top + rect.height / 2 - 60)), left: rect.left - GAP - TIP_W };
    else {
      const left = Math.max(16, Math.min(vw - TIP_W - 16, rect.left + rect.width / 2 - TIP_W / 2));
      style = rect.top + rect.height + GAP + H < vh ? { top: rect.top + rect.height + GAP, left } : { top: Math.max(16, rect.top - GAP - H), left };
    }
  }

  const waiting = !away && step.done != null && !step.done(ws);
  return (
    <div className={`tour-tip${style ? '' : ' docked'}`} style={style} role="dialog" aria-modal="false" aria-labelledby="tour-title" aria-live="polite">
      <p className="eyebrow">
        Tutorial · {i + 1} / {STEPS.length}
      </p>
      <h2 id="tour-title">{away ? `Open ${PAGE[step.page!]}` : step.title}</h2>
      <p>{away ? `This step is on the ${PAGE[step.page!]} page: press the glowing “${PAGE[step.page!]}” entry in the menu.` : step.body}</p>
      <div className="tour-dots" aria-hidden="true">
        {STEPS.map((_, k) => (
          <i key={k} className={k === i ? 'on' : k < i ? 'done' : ''} />
        ))}
      </div>
      <div className="row tour-actions">
        <button type="button" className="text-link" onClick={onSkip}>
          Skip
        </button>
        <span className="spacer" />
        {i > 0 && (
          <button type="button" className="btn quiet sm" onClick={() => setI(i - 1)}>
            Back
          </button>
        )}
        {waiting || away ? (
          <span className="tour-wait">{flight ? 'Flying…' : 'Your move'}</span>
        ) : (
          <button type="button" className="btn primary sm" onClick={() => (last ? onFinish() : setI(i + 1))} autoFocus>
            {last ? 'Take the quiz' : i === 0 ? 'Start' : 'Next'}
          </button>
        )}
      </div>
    </div>
  );
}
