'use client';

import '@fontsource-variable/jetbrains-mono';
import '@fontsource-variable/space-grotesk';
import './styles.css';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fixture, loadBundle, type LoadResult } from '@/lib/data/load';
import type { Bundle } from '@/lib/data/types';
import { analyse, assessFit, seekTime, type Body, type Model } from '@/lib/logic/derive';
import { buildExport } from '@/lib/logic/export';
import { fmtUtcMs } from '@/lib/logic/format';
import { findOptions, type AltOption } from '@/lib/logic/recommend';
import { catalog, defaults, find, startsFor, type Sel } from '@/lib/logic/scenarios';
import { clampTo, coverage, inScenario, type Speed } from '@/lib/logic/timeline';
import { SistemView } from '../../pages/Sistem';
import { SuprafataView } from '../../pages/Suprafata';
import { ZoneAterizareView } from '../../pages/ZoneAterizare';
import type { Trust } from '../zone/DecisionSummary';
import type { Side } from '../zone/ScenarioCards';
import type { Marker, Perspective, WS } from './types';
import { LANDING_SITES } from '@/lib/data/landingSites';
import { detectQuality, QUALITY_TEXT, type Quality } from './quality';

const H = 3_600_000;

/** Ceasul sistemului, citit doar la apăsarea butonului „Acum”. */
const readClock = () => Date.now();

const isPerspective = (v: string | null): v is Perspective => v === 'sistem' || v === 'zone' || v === 'suprafata';

export default function WorkspaceRoot() {
  const [res, setRes] = useState<LoadResult | null>(null);
  useEffect(() => {
    loadBundle().then(setRes);
  }, []);
  const load = useCallback(() => {
    setRes(null);
    loadBundle().then(setRes);
  }, []);

  if (!res) return <Skeleton />;
  if (res.status === 'invalid')
    return <InvalidData errors={res.errors} onRetry={load} onDemo={() => setRes(fixture('Se afișează date demonstrative etichetate, pentru că fișierul de date nu a trecut validarea.'))} />;
  return <Workspace key={`${res.origin}-${res.bundle.generatedAt}`} bundle={res.bundle} origin={res.origin} reason={res.reason} warnings={res.warnings} />;
}

function Brand() {
  return (
    <div className="brand">
      <span className="brand-orbit" aria-hidden="true" />
      <h1>Sinavigator</h1>
      <p>Observatorul tău lunar</p>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="ws" aria-busy="true">
      <header className="top">
        <Brand />
        <span className="status st-loading" role="status">
          Se încarcă datele…
        </span>
      </header>
      <div className="skel skel-1" />
      <div className="skel skel-3" />
    </div>
  );
}

function InvalidData({ errors, onRetry, onDemo }: { errors: string[]; onRetry: () => void; onDemo: () => void }) {
  return (
    <div className="ws">
      <header className="top">
        <Brand />
        <span className="status st-invalid">Fișier de date invalid</span>
      </header>
      <section className="card error" role="alert" aria-labelledby="err-h">
        <h2 id="err-h">Fișierul de date nu poate fi folosit</h2>
        <p>
          <code>public/data/bundle.json</code> există, dar nu a trecut validarea, deci nu se afișează niciun rezultat din el. Nimic nu a fost înlocuit pe ascuns.
        </p>
        <ul>
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
        <div className="row">
          <button type="button" className="btn primary" onClick={onRetry}>
            Reîncearcă după corectarea fișierului
          </button>
          <button type="button" className="btn" onClick={onDemo}>
            Continuă cu date demonstrative etichetate
          </button>
        </div>
      </section>
    </div>
  );
}

function initialPerspective(): Perspective {
  if (typeof window === 'undefined') return 'sistem';
  const p = new URLSearchParams(window.location.search).get('p');
  return isPerspective(p) ? p : 'sistem';
}

const matchesSite = (value: string | null, id: string, ...names: string[]) =>
  value != null && [id, ...names].some((name) => name.toLowerCase() === value.trim().toLowerCase());

function Workspace({ bundle, origin, reason, warnings }: { bundle: Bundle; origin: 'file' | 'fixture'; reason?: string; warnings: string[] }) {
  const cat = useMemo(() => catalog(bundle), [bundle]);
  const cov = useMemo(() => coverage(bundle), [bundle]);
  const profileOf = useCallback((siteId: string) => bundle.profiles.find((p) => p.siteId === siteId), [bundle]);
  const noTerrain = cat.sites.filter((s) => !profileOf(s.id)?.elevDeg.some((v) => v != null));
  const synthetic = bundle.provenance === 'fixture';
  const trust: Trust = synthetic ? 'synthetic' : bundle.validation?.status === 'validated' ? 'validated' : 'unvalidated';
  const terrainSynthetic = synthetic || bundle.layers?.terrain?.source === 'synthetic';
  const init = useMemo(() => defaults(cat), [cat]);
  const [requestedSite] = useState(() => typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('site'));
  const [perspective, setPerspective] = useState<Perspective>(initialPerspective);
  const [model, setModelState] = useState<Model>(noTerrain.length ? 'ideal' : 'terrain');
  const [selA, setSelA] = useState<Sel>(() => {
    // Apollo links select the exploration site without swapping the two comparison plans.
    if (LANDING_SITES.some((s) => matchesSite(requestedSite, s.id, s.name))) return init.a;
    const site = cat.sites.find((s) => matchesSite(requestedSite, s.id, s.short, s.name));
    return site ? { siteId: site.id, startMs: startsFor(cat, site.id)[0] ?? null } : init.a;
  });
  const [selB, setSelB] = useState<Sel | null>(init.b);
  const [activityMin, setActivityMin] = useState(120);
  const [timeMs, setTimeMs] = useState<number>(selA.startMs ?? cov.startMs);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>(6);
  const [marker, setMarker] = useState<Marker | null>(null);
  const [note, setNote] = useState('');
  const [landingId, setLandingId] = useState<string | null>(() =>
    LANDING_SITES.find((l) => matchesSite(requestedSite, l.id, l.name))?.id ?? null,
  );
  const [quality, setQuality] = useState<Quality>(detectQuality);
  const mainRef = useRef<HTMLDivElement>(null);

  const analyses = useMemo(() => new Map(bundle.scenarios.map((s) => [s.id, analyse(s, profileOf(s.siteId), model, bundle.rules)])), [bundle, model, profileOf]);

  const mkSide = (id: 'A' | 'B', sel: Sel | null): Side | null => {
    const sc = find(cat, sel);
    if (!sc) return null;
    return { id, sc, site: cat.sites.find((s) => s.id === sc.siteId)!, an: analyses.get(sc.id)!, profile: profileOf(sc.siteId), t0: Date.parse(sc.startUtc) };
  };
  const A = mkSide('A', selA);
  const B = mkSide('B', selB);
  const sides = [A, B].filter((s): s is Side => s != null);
  const fits = useMemo(() => sides.map((s) => assessFit(s.an, activityMin)), [A?.an, B?.an, activityMin]); // eslint-disable-line react-hooks/exhaustive-deps
  const change = A && B ? { site: A.sc.siteId !== B.sc.siteId, date: A.t0 !== B.t0, deltaH: (B.t0 - A.t0) / H } : null;
  const readyFromMs = B?.t0 ?? A?.t0 ?? cat.starts[0];
  const options = useMemo(() => findOptions(bundle.scenarios, analyses, readyFromMs, activityMin), [bundle, analyses, readyFromMs, activityMin]);
  const cursorA = A && inScenario(A.sc, timeMs) ? (timeMs - A.t0) / 60_000 : null;

  /* ── timp ── */
  const seekUtc = useCallback(
    (ms: number) => {
      setPlaying(false);
      setMarker(null);
      setTimeMs(clampTo(cov, ms));
    },
    [cov],
  );

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setTimeMs((t) => {
        const n = t + (speed * H) / 10;
        if (n >= cov.endMs) {
          setPlaying(false);
          return cov.endMs;
        }
        return n;
      });
    }, 100);
    return () => clearInterval(id);
  }, [playing, speed, cov]);

  useEffect(() => {
    if (!note) return;
    const id = setTimeout(() => setNote(''), 8000);
    return () => clearTimeout(id);
  }, [note]);

  const togglePlay = () => {
    if (!playing && timeMs >= cov.endMs) setTimeMs(cov.startMs);
    setMarker(null);
    setPlaying((p) => !p);
  };

  const goNow = () => {
    const now = readClock();
    if (now < cov.startMs || now > cov.endMs) {
      setNote(
        `„Acum” (${fmtUtcMs(now)}) este în afara intervalului acoperit de date (${fmtUtcMs(cov.startMs)} → ${fmtUtcMs(cov.endMs)}). Nu se afișează poziții sau rezultate pentru acest moment; momentul analizat a rămas neschimbat.`,
      );
      return;
    }
    seekUtc(now);
  };

  /* ── comparație: cursorul A/B este timpul scurs de la startul lui A ── */
  const seekElapsed = (min: number) => {
    if (!A) return;
    seekUtc(A.t0 + Math.max(0, Math.min(A.an.totalMin, min)) * 60_000);
  };

  const goEvent = (sideId: 'A' | 'B', x: number, body: Body | 'both' | null) => {
    const s = sides.find((d) => d.id === sideId);
    if (!s || !A) return;
    const at = Math.min(A.an.totalMin, seekTime(s.an, x));
    setPlaying(false);
    setTimeMs(A.t0 + at * 60_000);
    setMarker({ side: sideId, t: x, body });
    setNote(
      at === x
        ? `Scenariul ${sideId} la ${fmtUtcMs(s.t0 + x * 60_000)}.`
        : `Eveniment în scenariul ${sideId} la ≈ ${fmtUtcMs(s.t0 + x * 60_000)}; se arată primul eșantion de după el (${fmtUtcMs(s.t0 + at * 60_000, false)}).`,
    );
  };

  const keepTimeIn = (sel: Sel) => {
    const sc = find(cat, sel);
    if (!sc || inScenario(sc, timeMs)) return;
    setTimeMs(Date.parse(sc.startUtc));
    setNote(`Momentul analizat a fost mutat la startul scenariului ales (${fmtUtcMs(Date.parse(sc.startUtc))}), pentru că momentul anterior nu era acoperit de el.`);
  };

  const changeA = (s: Sel) => {
    setSelA(s);
    if (s.startMs == null) setNote('Planul A are nevoie de un start disponibil pentru zona aleasă.');
    else keepTimeIn(s);
  };
  const changeB = (s: Sel) => {
    setSelB(s);
    if (s.startMs == null) setNote('Alternativa B are nevoie de un start disponibil sau de o altă zonă.');
  };

  const selectLanding = (id: string | null) => {
    setLandingId(id);
    const l = LANDING_SITES.find((x) => x.id === id);
    if (l) setNote(`Loc de aterizare selectat: ${l.name}.`);
  };
  const landing = LANDING_SITES.find((x) => x.id === landingId) ?? null;

  const useOption = (o: AltOption) => {
    setSelB({ siteId: o.siteId, startMs: Date.parse(o.scenario.startUtc) });
    setPlaying(false);
    if (A) setTimeMs(A.t0 + Math.min(A.an.totalMin, seekTime(analyses.get(o.scenario.id)!, o.offsetMin)) * 60_000);
    setMarker({ side: 'B', t: o.offsetMin, body: null });
    setNote(`B folosește acum ${cat.sites.find((s) => s.id === o.siteId)?.short}, cu start la ${fmtUtcMs(Date.parse(o.scenario.startUtc))}. A rămâne neschimbat.`);
  };

  const setModel = (m: Model) => {
    setModelState(m);
    setNote(m === 'ideal' ? 'Recalculat cu orizontul idealizat de 0°: terenul este ignorat.' : 'Recalculat cu profilul de teren.');
  };

  const exportJson = () => {
    const data = buildExport({ bundle, origin, model, activityMin, sides, fits, options, readyFromMs });
    const url = URL.createObjectURL(new Blob([JSON.stringify({ ...data, analyzedUtc: new Date(timeMs).toISOString() }, null, 2)], { type: 'application/json' }));
    const el = document.createElement('a');
    el.href = url;
    el.download = `sinavigator_${sides.map((s) => s.sc.id).join('_vs_') || 'gol'}${synthetic ? '_SINTETIC' : ''}.json`;
    el.click();
    URL.revokeObjectURL(url);
    setNote('Dovezile au fost exportate ca JSON.');
  };

  /* ── navigare cinematică: zbor de cameră în scena curentă, apoi trecere scurtă spre scena următoare ── */
  const [prevStage, setPrevStage] = useState<Perspective | null>(null);
  const [flight, setFlight] = useState<null | 'moon' | 'site'>(null);
  const [fading, setFading] = useState(false);
  const transitioning = useRef(false);
  const travel = (p: Perspective) => {
    if (transitioning.current) return;
    transitioning.current = true;
    const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setFading(true);
    window.setTimeout(
      () => {
        setPrevStage(perspective);
        setPerspective(p);
        setFlight(null);
        try {
          const u = new URL(window.location.href);
          u.searchParams.set('p', p);
          window.history.replaceState(null, '', u);
        } catch {
          /* URL-ul nu este esențial */
        }
        mainRef.current?.focus({ preventScroll: true });
        window.scrollTo({ top: 0, behavior: 'instant' });
        window.setTimeout(() => {
          transitioning.current = false;
          setFading(false);
        }, reduced ? 0 : 60);
      },
      reduced ? 0 : 420,
    );
  };
  const go = (p: Perspective) => {
    if (transitioning.current || flight || p === perspective) return;
    if (perspective === 'sistem' && p === 'zone') setFlight('moon');
    else if (perspective === 'zone' && p === 'suprafata') setFlight('site');
    else travel(p);
  };
  const arrive = () => {
    if (flight === 'moon') travel('zone');
    else if (flight === 'site') travel('suprafata');
  };

  useEffect(() => {
    const url = new URL(window.location.href);
    if (perspective === 'sistem' || (perspective === 'zone' && !landingId)) url.searchParams.delete('site');
    else url.searchParams.set('site', landingId ?? selA.siteId);
    if (url.href !== window.location.href) window.history.replaceState(null, '', url);
  }, [perspective, landingId, selA.siteId]);

  const ws: WS = {
    bundle,
    origin,
    reason,
    warnings,
    cat,
    analyses,
    profileOf,
    synthetic,
    terrainSynthetic,
    noTerrain,
    trust,
    cov,
    timeMs,
    playing,
    speed,
    seekUtc,
    togglePlay,
    setSpeed,
    goNow,
    model,
    setModel,
    activityMin,
    setActivityMin,
    selA,
    selB,
    changeA,
    changeB,
    A,
    B,
    sides,
    fits,
    change,
    options,
    readyFromMs,
    cursorA,
    marker,
    seekElapsed,
    goEvent,
    useOption,
    exportJson,
    landing,
    selectLanding,
    quality,
    setQuality,
    note,
    setNote,
    go,
    stage: perspective,
    prevStage,
    flight,
    arrive,
  };

  const site = A?.site ?? cat.sites.find((s) => s.id === selA.siteId);
  const perspectives: { id: Perspective; label: string }[] = [
    { id: 'sistem', label: 'Sistem solar' },
    { id: 'zone', label: 'Lună' },
    { id: 'suprafata', label: 'Suprafață' },
  ];
  const title = {
    sistem: 'Soare, Pământ și Lună',
    zone: 'Lună · Locuri de aterizare',
    suprafata: `${landing?.name ?? site?.short ?? 'Lună'} · Suprafață`,
  }[perspective];
  const description = {
    sistem: 'Explorează orbitele. Apasă pe Lună pentru a zbura spre ea.',
    zone: 'Trage globul pentru a-l roti. Folosește rotița sau apropie ori depărtează două degete pentru zoom.',
    suprafata: 'Trage în scenă pentru a privi în jur și folosește rotița pentru zoom.',
  }[perspective];

  return (
    <div className={`observatory min-h-dvh min-w-0${flight ? ' in-flight' : ''}`}>
      <button type="button" className="skip" onClick={() => mainRef.current?.focus()}>
        Sari la conținut
      </button>
      <aside className="workspace-sidebar min-w-0">
        <Brand />
        <nav className="workspace-nav" aria-label="Perspective">
          <p className="k">Spațiu de lucru</p>
          {perspectives.map(({ id, label }) => (
            <button key={id} type="button" onClick={() => go(id)} aria-current={id === perspective ? 'page' : undefined} disabled={id === perspective || !!flight || fading || (perspective === 'zone' && id === 'suprafata' && !landing)}>
              {label}
            </button>
          ))}
          {perspective !== 'sistem' && (
            <div className="nav-group" role="group" aria-label="Locuri lunare">
              <p className="k">Locuri de aterizare</p>
              {LANDING_SITES.map(({ id, name }) => (
                <button key={id} type="button" aria-pressed={landingId === id} disabled={!!flight || fading} onClick={() => selectLanding(id)}>
                  <span className="nav-dot" aria-hidden="true" />
                  {name}
                </button>
              ))}
            </div>
          )}
        </nav>
      </aside>
      <div className="min-w-0">
        <header className="workspace-header">
          <h2>{title}</h2>
          <div className="top-actions">
            <div className="seg quality" role="group" aria-label="Calitate grafică">
              {(['high', 'low'] as const).map((q) => (
                <button key={q} type="button" className={`chip${quality === q ? ' on' : ''}`} aria-pressed={quality === q} onClick={() => setQuality(q)}>
                  {QUALITY_TEXT[q]}
                </button>
              ))}
            </div>
            <button type="button" className="btn sm" onClick={exportJson} disabled={!sides.length}>
              Export
            </button>
          </div>
        </header>
        <main id="perspectiva" ref={mainRef} tabIndex={-1} className="workspace-main">
          <p className="workspace-description">{description}</p>
          <div className="workspace-stage" key={perspective}>
            {perspective === 'sistem' && <SistemView ws={ws} />}
            {perspective === 'zone' && <ZoneAterizareView ws={ws} />}
            {perspective === 'suprafata' && <SuprafataView ws={ws} />}
          </div>
        </main>
      </div>

      <div className={`fader${fading ? ' on' : ''}`} aria-hidden="true" />
      <p className="note" role="status" aria-live="polite">
        {note}
      </p>
    </div>
  );
}
