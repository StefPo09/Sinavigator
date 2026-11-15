'use client';

// Guided first-visit tutorial: a spotlight on the real interface, one step at a time.
// Steps that live on another page offer a button that flies there (same cinematic as the app).
import { useEffect, useLayoutEffect, useState } from 'react';
import type { Perspective, WS } from '../shared/types';

interface Step {
  title: string;
  body: string;
  /** CSS selector of the element to highlight; none = centred card */
  target?: string;
  /** the page this step is on */
  stage?: Perspective;
  /** label of the button that flies to `stage` */
  goLabel?: string;
}

const STEPS: Step[] = [
  {
    title: 'Your mission',
    body: 'A lunar rover task needs 2 continuous hours with the Sun visible (power) and the Earth visible (communication). Your job: find a landing site and a date where it fits — and explain why. This tour shows where everything is.',
  },
  {
    stage: 'sistem',
    goLabel: 'Go to the System view',
    target: '.workspace-scene',
    title: 'Sun, Earth and Moon',
    body: 'A schematic picture (not to scale). The Moon sits at its real position for the chosen moment. Hover the Moon to highlight it and click it to fly there.',
  },
  {
    stage: 'sistem',
    target: '.timebar',
    title: 'The timeline',
    body: 'This sets the analysed moment (UTC). The data covers 27 Nov – 3 Dec 2026. Drag, step, or press play to watch time move.',
  },
  {
    target: '.atlas-tools',
    title: 'Student or Planner',
    body: 'Student mode guides you through the mission. Planner mode adds the detailed comparison: angles, thresholds, every interval and the sources. Export JSON saves what you see.',
  },
  {
    stage: 'zone',
    goLabel: 'Fly to the Moon',
    target: '.nav-sites',
    title: 'Pick a landing site',
    body: 'Apollo 15 or Apollo 17. You can also click their markers on the globe. Selecting a site shows its data; entering the surface is a separate button.',
  },
  {
    stage: 'zone',
    target: '.workspace-inspector',
    title: 'The answer, computed',
    body: 'Does the 2-hour activity fit at this site in the period that contains the analysed moment? “Why?” names the body and direction that limit it, with real angles.',
  },
  {
    stage: 'zone',
    target: '.workspace-scene',
    title: 'Read the bands',
    body: 'Green = Sun and Earth both visible. Yellow = only the Sun, blue = only the Earth. ▲▼ mark computed rise and set events — click one to jump there.',
  },
  {
    stage: 'zone',
    target: '#mission',
    title: 'Your exercise is here',
    body: 'Choose two options (two sites, or one site on two dates), predict, then check. You get the computed answer, the cause, and an experiment with and without terrain.',
  },
  {
    stage: 'zone',
    target: '.workspace-inspector',
    title: 'Stand on the surface',
    body: 'See the real Apollo terrain at the analysed moment, with the Sun and Earth where the data puts them. After the tour, a short quiz checks what you learned.',
  },
];

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function Tour({ ws, onFinish, onSkip }: { ws: WS; onFinish: () => void; onSkip: () => void }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const step = STEPS[i];
  const elsewhere = step.stage != null && step.stage !== ws.stage;
  const { landing, selectLanding, stage, flight } = ws;

  // steps on the Moon page need a selected site to have something to show
  useEffect(() => {
    if (stage === 'zone' && i >= 5 && !landing) selectLanding('apollo17');
  }, [stage, i, landing, selectLanding]);

  // follow the highlighted element (layout, scroll, resize)
  useLayoutEffect(() => {
    let raf = 0;
    let scrolled = false;
    const measure = () => {
      if (elsewhere || !step.target || flight) {
        setRect(null);
        return;
      }
      const el = document.querySelector(step.target!) as HTMLElement | null;
      if (el) {
        if (!scrolled) {
          scrolled = true;
          const r0 = el.getBoundingClientRect();
          if (r0.top < 80 || r0.bottom > window.innerHeight - 40) el.scrollIntoView({ block: r0.height > window.innerHeight * 0.6 ? 'start' : 'center', behavior: 'smooth' });
        }
        const r = el.getBoundingClientRect();
        setRect((p) => (p && p.top === r.top && p.left === r.left && p.width === r.width && p.height === r.height ? p : { top: r.top, left: r.left, width: r.width, height: r.height }));
      } else setRect(null);
      raf = requestAnimationFrame(measure);
    };
    raf = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(raf);
  }, [i, elsewhere, step.target, flight]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onSkip();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onSkip]);

  const last = i === STEPS.length - 1;
  const next = () => (last ? onFinish() : setI(i + 1));

  // card placement: below the target if there is room, otherwise above, otherwise centred
  const PAD = 8;
  const W = 360;
  let cardStyle: React.CSSProperties = {};
  if (rect) {
    const vw = typeof window === 'undefined' ? 1200 : window.innerWidth;
    const vh = typeof window === 'undefined' ? 800 : window.innerHeight;
    const left = Math.max(16, Math.min(vw - W - 16, rect.left + rect.width / 2 - W / 2));
    const CARD_H = 300;
    if (rect.height > vh * 0.5) {
      // large target (a whole scene): keep the card inside its lower-left corner, off the subject
      cardStyle = { top: Math.min(vh - 16, rect.top + rect.height) - 16, left: Math.max(16, rect.left + 16), transform: 'translateY(-100%)' };
    } else if (rect.top + rect.height + CARD_H < vh) cardStyle = { top: rect.top + rect.height + PAD + 8, left };
    else if (rect.top > CARD_H) cardStyle = { top: Math.max(16, rect.top - PAD - 8), left, transform: 'translateY(-100%)' };
    else cardStyle = { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
  }

  return (
    <div className="tour" role="dialog" aria-modal="false" aria-labelledby="tour-title">
      {rect ? (
        <div className="tour-spot" style={{ top: rect.top - PAD, left: rect.left - PAD, width: rect.width + 2 * PAD, height: rect.height + 2 * PAD }} aria-hidden="true" />
      ) : (
        <div className="tour-dim" aria-hidden="true" />
      )}
      <div className={`tour-card${rect ? '' : ' centred'}`} style={rect ? cardStyle : undefined}>
        <p className="eyebrow">
          Tutorial · {i + 1} / {STEPS.length}
        </p>
        <h2 id="tour-title">{step.title}</h2>
        <p>{step.body}</p>
        <div className="tour-dots" aria-hidden="true">
          {STEPS.map((_, k) => (
            <i key={k} className={k === i ? 'on' : k < i ? 'done' : ''} />
          ))}
        </div>
        <div className="row tour-actions">
          <button type="button" className="text-link" onClick={onSkip}>
            Skip tutorial
          </button>
          <span className="spacer" />
          {i > 0 && (
            <button type="button" className="btn quiet" onClick={() => setI(i - 1)}>
              Back
            </button>
          )}
          {elsewhere ? (
            <button type="button" className="btn primary" onClick={() => ws.go(step.stage!)} disabled={!!flight}>
              {flight ? 'Flying…' : (step.goLabel ?? 'Go there')}
            </button>
          ) : (
            <button type="button" className="btn primary" onClick={next} autoFocus>
              {last ? 'Finish & take the quiz' : i === 0 ? 'Start the tour' : 'Next'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
