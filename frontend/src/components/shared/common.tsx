'use client';

import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { VisState } from '@/lib/logic/derive';

export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(640);
  // measure synchronously before the first paint, then follow size changes
  useLayoutEffect(() => {
    if (!ref.current) return;
    setW(Math.max(260, Math.round(ref.current.getBoundingClientRect().width)));
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.round(e.contentRect.width))));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

export function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 640, h: 300 });
  useLayoutEffect(() => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setSize({ w: Math.max(240, Math.round(r.width)), h: Math.max(200, Math.round(r.height)) });
    const ro = new ResizeObserver(([e]) => setSize({ w: Math.max(240, Math.round(e.contentRect.width)), h: Math.max(200, Math.round(e.contentRect.height)) }));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, size.w, size.h] as const;
}

export function SunGlyph({ x = 0, y = 0, r = 6 }: { x?: number; y?: number; r?: number }) {
  return (
    <g transform={`translate(${x} ${y})`} className="glyph-sun">
      <circle r={r} />
      <g>
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i * Math.PI) / 4;
          return <line key={i} x1={Math.cos(a) * (r + 2.5)} y1={Math.sin(a) * (r + 2.5)} x2={Math.cos(a) * (r + 5.5)} y2={Math.sin(a) * (r + 5.5)} />;
        })}
      </g>
    </g>
  );
}

export function EarthGlyph({ x = 0, y = 0, r = 6 }: { x?: number; y?: number; r?: number }) {
  return (
    <g transform={`translate(${x} ${y})`} className="glyph-earth">
      <circle r={r} />
      <path d={`M${-r} 0H${r}M0 ${-r}V${r}`} />
    </g>
  );
}

export function BodyIcon({ body }: { body: 'sun' | 'earth' }) {
  return (
    <svg width="20" height="20" viewBox="-11 -11 22 22" aria-hidden="true" className="body-icon">
      {body === 'sun' ? <SunGlyph r={4} /> : <EarthGlyph r={5.5} />}
    </svg>
  );
}

export const BODY_NAME = { sun: 'Sun', earth: 'Earth' } as const;
export const STATE_TEXT: Record<VisState, string> = { vis: 'Visible', hid: 'Hidden', unk: 'Unknown' };
const STATE_MARK: Record<VisState, string> = { vis: '●', hid: '○', unk: '?' };

export function StatePill({ state, label }: { state: VisState; label?: string }) {
  return (
    <span className={`pill pill-${state}`}>
      <span aria-hidden="true">{STATE_MARK[state]}</span> {label ?? STATE_TEXT[state]}
    </span>
  );
}

export function Tag({ id, label, small = false }: { id: 'A' | 'B'; label: string; small?: boolean }) {
  return (
    <span className={`tag tag-${id}${small ? ' tag-sm' : ''}`}>
      {label}
    </span>
  );
}

export interface ChipOption<T> {
  value: T;
  label: string;
  /** set to disable the option; the reason is shown next to the group, never only in a tooltip */
  reason?: string;
}

/**
 * Single-choice chip group with radio semantics: one Tab stop, arrow keys move and select,
 * disabled options are skipped and their reasons are rendered as text.
 */
export function ChipGroup<T extends string | number>({
  label,
  value,
  options,
  onChange,
  hideLabel = false,
  size = 'md',
}: {
  label: string;
  value: T | null;
  options: ChipOption<T>[];
  onChange: (v: T) => void;
  hideLabel?: boolean;
  size?: 'md' | 'sm';
}) {
  const id = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const enabled = options.map((o, i) => (o.reason ? -1 : i)).filter((i) => i >= 0);
  const checked = options.findIndex((o) => o.value === value && !o.reason);
  const tabStop = checked >= 0 ? checked : (enabled[0] ?? -1);
  const reasons = options.filter((o) => o.reason);

  const onKey = (e: KeyboardEvent, i: number) => {
    const fwd = e.key === 'ArrowRight' || e.key === 'ArrowDown';
    const back = e.key === 'ArrowLeft' || e.key === 'ArrowUp';
    if (!fwd && !back && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    if (!enabled.length) return;
    const pos = enabled.indexOf(i);
    let next: number;
    if (e.key === 'Home') next = enabled[0];
    else if (e.key === 'End') next = enabled[enabled.length - 1];
    else next = enabled[(pos + (fwd ? 1 : -1) + enabled.length) % enabled.length];
    refs.current[next]?.focus();
    onChange(options[next].value);
  };

  return (
    <div className={`chipfield chip-${size}`}>
      <span className={hideLabel ? 'sr-only' : 'chip-label'} id={`${id}-l`}>
        {label}
      </span>
      <div className="chips" role="radiogroup" aria-labelledby={`${id}-l`} aria-describedby={reasons.length ? `${id}-r` : undefined}>
        {options.map((o, i) => (
          <button
            key={String(o.value)}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={i === checked}
            aria-disabled={o.reason ? true : undefined}
            tabIndex={i === tabStop ? 0 : -1}
            className={`chip${i === checked ? ' on' : ''}${o.reason ? ' off' : ''}`}
            onClick={() => !o.reason && onChange(o.value)}
            onKeyDown={(e) => onKey(e, i)}
          >
            {o.label}
          </button>
        ))}
      </div>
      {reasons.length > 0 && (
        <p className="chip-reasons" id={`${id}-r`}>
          {reasons.map((o) => (
            <span key={String(o.value)}>
              <b>{o.label}</b> indisponibil: {o.reason}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
