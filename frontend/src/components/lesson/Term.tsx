'use client';

import { useId, useState, type ReactNode } from 'react';

export type TermKey = 'azimut' | 'elevatie' | 'orizont' | 'fereastra' | 'marja';

const DEF: Record<TermKey, { word: string; text: string }> = {
  azimut: { word: 'azimuth', text: 'Direction along the horizon, measured from north towards east: 0° north, 90° east, 180° south, 270° west.' },
  elevatie: { word: 'elevation', text: 'How high a body is above the observer’s horizontal plane. Below 0° it is below the horizon plane.' },
  orizont: {
    word: 'local horizon',
    text: 'The angle the terrain rises to in each direction, computed here from a 5 km radius. A nearby mountain can hide a body that is above the 0° plane.',
  },
  fereastra: { word: 'common window', text: 'A continuous interval in which the Sun and the Earth are visible at the same time, by the rules below.' },
  marja: { word: 'margin', text: 'The body’s elevation minus the terrain angle in its direction. The project asks for > 0° for the Sun and ≥ 2° for the Earth.' },
};

/** Desen mic pentru azimut (văzut de sus) sau elevație (văzută din profil), în aceeași linie ca graficele. */
function Figure({ k }: { k: TermKey }) {
  if (k === 'azimut')
    return (
      <svg className="term-fig" viewBox="0 0 120 92" role="img" aria-label="Diagram: azimuth is the angle from north to the body’s direction, measured towards east.">
        <circle cx="60" cy="48" r="34" className="fig-line" />
        <line x1="60" y1="10" x2="60" y2="18" className="fig-strong" />
        <text x="60" y="8" className="fig-text" textAnchor="middle">N</text>
        <text x="100" y="51" className="fig-text">E</text>
        <line x1="60" y1="48" x2="89" y2="65" className="fig-sun" />
        <circle cx="92" cy="67" r="4" className="fig-sun-fill" />
        <path d="M60 30 A18 18 0 0 1 75.6 57" className="fig-arc" />
        <text x="76" y="36" className="fig-text">Az</text>
        <circle cx="60" cy="48" r="2.5" className="fig-dot" />
      </svg>
    );
  if (k === 'elevatie' || k === 'orizont' || k === 'marja')
    return (
      <svg className="term-fig" viewBox="0 0 140 80" role="img" aria-label="Side diagram: the body’s elevation above the horizontal plane, and terrain rising towards it.">
        <line x1="6" y1="62" x2="134" y2="62" className="fig-line" />
        <path d="M78 62 L100 46 L116 52 L134 40 L134 62 Z" className="fig-terrain" />
        <line x1="24" y1="62" x2="128" y2="22" className="fig-sun" />
        <circle cx="128" cy="22" r="4" className="fig-sun-fill" />
        <path d="M60 62 A36 36 0 0 0 57.6 48.2" className="fig-arc" />
        <text x="63" y="56" className="fig-text">El</text>
        {k !== 'elevatie' && (
          <>
            <line x1="24" y1="62" x2="134" y2="40" className="fig-dash" />
            <text x="100" y="74" className="fig-text">H terrain</text>
          </>
        )}
        <circle cx="24" cy="62" r="2.5" className="fig-dot" />
      </svg>
    );
  return null;
}

/** Termen cu explicație: buton accesibil din tastatură; definiția apare în flux, nu doar la hover. */
export function Term({ k, children }: { k: TermKey; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const d = DEF[k];
  return (
    <span className="term">
      <span>{children ?? d.word}</span>
      <button type="button" className="term-btn" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)} aria-label={`What does “${d.word}” mean?`}>
        ?
      </button>
      {open && (
        <span className="term-def" id={id} role="note">
          <Figure k={k} />
          <span>
            <b>{d.word[0].toUpperCase() + d.word.slice(1)}.</b> {d.text}
          </span>
        </span>
      )}
    </span>
  );
}
