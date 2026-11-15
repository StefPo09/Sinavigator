'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fixture, loadBundle, type LoadResult } from '@/lib/data/load';
import type { Bundle } from '@/lib/data/types';
import { analyse, assessFit, seekTime, type Body, type Model } from '@/lib/logic/derive';
import { buildExport } from '@/lib/logic/export';
import { fmtUtcMs } from '@/lib/logic/format';
import { siteTrack, type SiteTrack } from '@/lib/logic/lesson';
import { findOptions, type AltOption } from '@/lib/logic/recommend';
import { catalog, defaults, find, startsFor, type Sel } from '@/lib/logic/scenarios';
import { clampTo, coverage, inScenario, type Speed } from '@/lib/logic/timeline';
import { SistemView } from './Sistem';
import { SuprafataView } from './Suprafata';
import { ZoneAterizareView } from './ZoneAterizare';
import type { Trust } from '@/components/zone/DecisionSummary';
import type { Side } from '@/components/zone/ScenarioCards';
import type { Marker, Mode, Perspective, WS } from '@/components/shared/types';
import { LANDING_SITES } from '@/lib/data/landingSites';
import { detectQuality, QUALITY_TEXT, type Quality } from '@/components/shared/quality';
import { Brand, WorkspaceNavigation, type PreloadState } from '@/components/shared/WorkspaceNavigation';
import { MethodsSources } from '@/components/zone/EvidenceDetails';
import { Comparison } from '@/components/zone/Comparison';
import { Mission } from '@/components/lesson/Mission';
import { Tour } from '@/components/tour/Tour';
import { Quiz } from '@/components/quiz/Quiz';

const H = 3_600_000;
const TOUR_KEY = 'sinavigator.tour.v1';
/** The system clock, read only when the user presses "Now". */
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
    return (
      <InvalidData
        errors={res.errors}
        source={res.source}
        onRetry={load}
        onDemo={() => setRes(fixture(`Showing labelled demo data because the data from ${res.source} did not pass validation.`))}
      />
    );
  return <Workspace key={`${res.origin}-${res.bundle.generatedAt}`} bundle={res.bundle} origin={res.origin} source={res.source} reason={res.reason} warnings={res.warnings} />;
}

/** Same composition as the app, so nothing jumps while loading. */
function Shell({ children, status }: { children: React.ReactNode; status: React.ReactNode }) {
  return (
    <div className="atlas">
      <aside className="atlas-nav">
        <Brand />
      </aside>
      <div className="atlas-main">
        <header className="atlas-head">
          <div>
            <p className="eyebrow">Sinavigator</p>
            <h1>Lunar atlas</h1>
          </div>
          {status}
        </header>
        {children}
      </div>
    </div>
  );
}

function Skeleton() {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setSlow(true), 4000);
    return () => clearTimeout(id);
  }, []);
  return (
    <Shell status={<span className="state-line" role="status">Loading visibility data…</span>}>
      <div className="atlas-body" aria-busy="true">
        <div className="atlas-grid">
          <div className="scene-frame placeholder">
            <p className="muted">
              Reading the data set (Sun–Earth scenarios for the Apollo sites) from the backend or the static file.
              {slow && ' The backend is slow; after at most 10 s the static file is tried.'}
            </p>
          </div>
          <div className="inspector placeholder" />
        </div>
      </div>
    </Shell>
  );
}

function InvalidData({ errors, source, onRetry, onDemo }: { errors: string[]; source: string; onRetry: () => void; onDemo: () => void }) {
  return (
    <Shell status={<span className="state-line bad">Invalid data</span>}>
      <section className="notice bad" role="alert" aria-labelledby="err-h">
        <h2 id="err-h">The data cannot be used</h2>
        <p>
          <code>{source}</code> answered, but the content failed validation, so no result from it is shown. Nothing was silently replaced.
        </p>
        <ul className="bullets mono small">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
        <div className="row">
          <button type="button" className="btn primary" onClick={onRetry}>
            Retry
          </button>
          <button type="button" className="btn" onClick={onDemo}>
            Continue with labelled demo data
          </button>
        </div>
      </section>
    </Shell>
  );
}

function initialParam<T extends string>(name: string, ok: (v: string | null) => v is T, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  const v = new URLSearchParams(window.location.search).get(name);
  return ok(v) ? v : fallback;
}
const isMode = (v: string | null): v is Mode => v === 'elev' || v === 'planificator';

const matchesSite = (value: string | null, id: string, ...names: string[]) =>
  value != null && [id, ...names].some((name) => name.toLowerCase() === value.trim().toLowerCase());

const scrollToId = (id: string) => {
  const el = document.getElementById(id);
  if (!el) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
};

function Workspace({ bundle, origin, source, reason, warnings }: { bundle: Bundle; origin: 'file' | 'fixture'; source?: string; reason?: string; warnings: string[] }) {
  const cat = useMemo(() => catalog(bundle), [bundle]);
  const cov = useMemo(() => coverage(bundle), [bundle]);
  const profileOf = useCallback((siteId: string) => bundle.profiles.find((p) => p.siteId === siteId), [bundle]);
  const noTerrain = cat.sites.filter((s) => !profileOf(s.id)?.elevDeg.some((v) => v != null));
  const synthetic = bundle.provenance === 'fixture';
  const trust: Trust = synthetic ? 'synthetic' : bundle.validation?.status === 'validated' ? 'validated' : 'unvalidated';
  const terrainSynthetic = synthetic || bundle.layers?.terrain?.source === 'synthetic';
  const init = useMemo(() => defaults(cat), [cat]);
  const [requestedSite] = useState(() => (typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('site')));
  const [perspective, setPerspective] = useState<Perspective>(() => initialParam('p', isPerspective, 'sistem'));
  const [mode, setModeState] = useState<Mode>(() => initialParam('mode', isMode, 'elev'));
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
  const [landingId, setLandingId] = useState<string | null>(() => LANDING_SITES.find((l) => matchesSite(requestedSite, l.id, l.name))?.id ?? null);
  const [quality, setQuality] = useState<Quality>(detectQuality);
  /** the system clock, read once: the data window is in the future, so "now" usually falls outside it */
  const [todayMs] = useState(readClock);
  const [tourOpen, setTourOpen] = useState(() => {
    try {
      return typeof window !== 'undefined' && localStorage.getItem(TOUR_KEY) !== 'done' && new URLSearchParams(window.location.search).get('tour') !== '0';
    } catch {
      return false;
    }
  });
  const [quizOpen, setQuizOpen] = useState(false);
  const [preload, setPreload] = useState<PreloadState>({ kind: 'idle' });
  const mainRef = useRef<HTMLDivElement>(null);
  const aboutRef = useRef<HTMLDetailsElement>(null);

  const analyses = useMemo(() => new Map(bundle.scenarios.map((s) => [s.id, analyse(s, profileOf(s.siteId), model, bundle.rules)])), [bundle, model, profileOf]);
  const tracks = useMemo(() => {
    const m = new Map<string, SiteTrack | null>();
    for (const s of cat.sites) m.set(s.id, siteTrack(bundle.scenarios, analyses, s.id));
    return m;
  }, [bundle, analyses, cat]);
  const trackOf = useCallback((id: string) => tracks.get(id) ?? null, [tracks]);

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

  /* ── time ── */
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

  /** "Now" when today is inside the data; otherwise the nearest edge of the data window, said out loud. */
  const nowState: 'inside' | 'before' | 'after' = todayMs < cov.startMs ? 'before' : todayMs > cov.endMs ? 'after' : 'inside';
  const goNow = () => {
    if (nowState === 'inside') return seekUtc(readClock());
    const edge = nowState === 'before' ? cov.startMs : cov.endMs;
    seekUtc(edge);
    setNote(
      `Today (${fmtUtcMs(todayMs, true).replace(/, .*/, '')}) is ${nowState === 'before' ? 'before' : 'after'} the computed data (${fmtUtcMs(cov.startMs)} → ${fmtUtcMs(cov.endMs)}), so the timeline moved to its ${nowState === 'before' ? 'first' : 'last'} moment. No values are extrapolated.`,
    );
  };

  /* ── comparison: the A/B cursor is the time elapsed since A's start ── */
  const seekElapsed = (min: number) => {
    if (!A) return;
    seekUtc(A.t0 + Math.max(0, Math.min(A.an.totalMin, min)) * 60_000);
  };

  const goEvent = (sideId: 'A' | 'B', x: number, body: Body | 'both' | null) => {
    const s = sides.find((d) => d.id === sideId);
    if (!s || !A) return;
    // the comparison is synchronised on elapsed time from each option's start (see Methods)
    const at = Math.min(A.an.totalMin, seekTime(s.an, x));
    setPlaying(false);
    setTimeMs(A.t0 + at * 60_000);
    setMarker({ side: sideId, t: x, body });
    setNote(
      at === x
        ? `Option ${sideId} at ${fmtUtcMs(s.t0 + x * 60_000)}.`
        : `Event in option ${sideId} at ≈ ${fmtUtcMs(s.t0 + x * 60_000)}; showing the first sample after it (${fmtUtcMs(s.t0 + at * 60_000, false)}).`,
    );
  };

  const keepTimeIn = (sel: Sel) => {
    const sc = find(cat, sel);
    if (!sc || inScenario(sc, timeMs)) return;
    setTimeMs(Date.parse(sc.startUtc));
    setNote(`The analysed moment moved to the start of the chosen option (${fmtUtcMs(Date.parse(sc.startUtc))}) because the previous moment was outside it.`);
  };

  const changeA = (s: Sel) => {
    setSelA(s);
    if (s.startMs == null) setNote('Option A needs an available start for the chosen site.');
    else keepTimeIn(s);
  };
  const changeB = (s: Sel) => {
    setSelB(s);
    if (s.startMs == null) setNote('Option B needs an available start or another site.');
  };

  const selectLanding = useCallback((id: string | null) => {
    setLandingId(id);
    const l = LANDING_SITES.find((x) => x.id === id);
    if (l) setNote(`Site selected: ${l.name}.`);
  }, []);
  const landing = LANDING_SITES.find((x) => x.id === landingId) ?? null;

  const useOption = (o: AltOption) => {
    setSelB({ siteId: o.siteId, startMs: Date.parse(o.scenario.startUtc) });
    setPlaying(false);
    if (A) setTimeMs(A.t0 + Math.min(A.an.totalMin, seekTime(analyses.get(o.scenario.id)!, o.offsetMin)) * 60_000);
    setMarker({ side: 'B', t: o.offsetMin, body: null });
    setNote(`B now uses ${cat.sites.find((s) => s.id === o.siteId)?.short}, starting ${fmtUtcMs(Date.parse(o.scenario.startUtc))}. A is unchanged.`);
  };

  const setModel = (m: Model) => {
    setModelState(m);
    setNote(m === 'ideal' ? 'Recomputed with the ideal 0° horizon: terrain is ignored in the conclusions.' : 'Recomputed with the terrain profile.');
  };

  const setMode = (m: Mode) => {
    setModeState(m);
    try {
      const u = new URL(window.location.href);
      if (m === 'elev') u.searchParams.delete('mode');
      else u.searchParams.set('mode', m);
      window.history.replaceState(null, '', u);
    } catch {
      /* the URL is not essential */
    }
    // the Planner adds a full section below the scene: bring it into view so the switch is visible
    if (m === 'planificator') window.setTimeout(() => scrollToId('planner'), 60);
  };

  const exportJson = () => {
    const data = buildExport({ bundle, origin, source, model, activityMin, sides, fits, options, readyFromMs });
    const url = URL.createObjectURL(new Blob([JSON.stringify({ ...data, analyzedUtc: new Date(timeMs).toISOString() }, null, 2)], { type: 'application/json' }));
    const el = document.createElement('a');
    el.href = url;
    el.download = `sinavigator_${sides.map((s) => s.sc.id).join('_vs_') || 'empty'}${synthetic ? '_SYNTHETIC' : ''}.json`;
    el.click();
    URL.revokeObjectURL(url);
    setNote('Data and sources exported as JSON.');
  };

  const startPreload = async () => {
    if (preload.kind === 'running') return;
    setPreload({ kind: 'running', done: 0, total: 1, label: 'Starting…', pct: null });
    const { preloadAll } = await import('@/components/shared/preload');
    const { failed } = await preloadAll(
      LANDING_SITES.filter((l) => l.terrain).map((l) => l.id),
      quality,
      (s) => setPreload({ kind: 'running', done: s.done, total: s.total, label: s.label, pct: s.moonPct }),
    );
    setPreload(failed.length ? { kind: 'partial', failed } : { kind: 'ready' });
    setNote(failed.length ? `Preloaded, except: ${failed.join(', ')}.` : 'All 3D assets are loaded: transitions will not wait for the network.');
  };

  /* ── navigation: a short camera flight in the current scene, then the swap to the next page ── */
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
          /* the URL is not essential */
        }
        mainRef.current?.focus({ preventScroll: true });
        window.scrollTo({ top: 0, behavior: 'instant' });
        window.setTimeout(() => {
          transitioning.current = false;
          setFading(false);
        }, reduced ? 0 : 60);
      },
      reduced ? 0 : 500,
    );
  };
  const go = (p: Perspective) => {
    if (transitioning.current || flight || p === perspective) return;
    const cinematic = (f: 'moon' | 'site') => {
      // the flight happens in the scene: if the page is scrolled, bring the scene back into view
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (window.scrollY > 0) window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
      setFlight(f);
    };
    if (perspective === 'sistem' && p === 'zone') cinematic('moon');
    else if (perspective === 'zone' && p === 'suprafata') cinematic('site');
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

  const openAbout = () => {
    if (aboutRef.current) {
      aboutRef.current.open = true;
      aboutRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      aboutRef.current.querySelector('summary')?.focus({ preventScroll: true });
    }
  };
  const endTour = (quiz: boolean) => {
    try {
      localStorage.setItem(TOUR_KEY, 'done');
    } catch {
      /* private mode: the tour simply shows again next time */
    }
    setTourOpen(false);
    if (quiz) setQuizOpen(true);
  };

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
    nowState,
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
    trackOf,
    mode,
    setMode,
    showMission: () => scrollToId('mission'),
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

  const title = {
    sistem: 'Sun, Earth and Moon',
    zone: landing ? landing.name : 'The Moon',
    suprafata: `${landing?.name ?? A?.site.short ?? 'Moon'} · on the ground`,
  }[perspective];
  const eyebrow = {
    sistem: 'System · schematic view',
    zone: landing ? `Moon · ${landing.mission.split(' · ').slice(1).join(' · ')}` : 'Moon · landing sites',
    suprafata: 'Surface · view from 1.7 m',
  }[perspective];

  return (
    <div className={`atlas${flight ? ' in-flight' : ''}${fading ? ' is-swapping' : ''}`}>
      <button type="button" className="skip" onClick={() => mainRef.current?.focus()}>
        Skip to content
      </button>
      <WorkspaceNavigation
        perspective={perspective}
        landingId={landingId}
        flight={flight}
        fading={fading}
        onNavigate={go}
        onSelectLanding={selectLanding}
        onAbout={openAbout}
        onMission={() => scrollToId('mission')}
        onTour={() => setTourOpen(true)}
        onQuiz={() => setQuizOpen(true)}
        onPreload={startPreload}
        preload={preload}
        synthetic={synthetic}
      />
      <div className="atlas-main">
        <header className="atlas-head">
          <div className="atlas-title">
            <p className="eyebrow">{eyebrow}</p>
            <h1>{title}</h1>
          </div>
          <div className="atlas-tools">
            <div className="seg" role="group" aria-label="Mode">
              {(['elev', 'planificator'] as const).map((m) => (
                <button key={m} type="button" className={mode === m ? 'on' : ''} aria-pressed={mode === m} onClick={() => setMode(m)} title={m === 'elev' ? 'Guided mission' : 'Detailed comparison, angles, thresholds and sources'}>
                  {m === 'elev' ? 'Student' : 'Planner'}
                </button>
              ))}
            </div>
            <div className="seg" role="group" aria-label="Graphics quality">
              {(['high', 'low'] as const).map((q) => (
                <button key={q} type="button" className={quality === q ? 'on' : ''} aria-pressed={quality === q} onClick={() => setQuality(q)} title={q === 'high' ? 'Shadows and detailed terrain' : 'No shadows, light terrain tiles'}>
                  {QUALITY_TEXT[q]}
                </button>
              ))}
            </div>
          </div>
        </header>
        {synthetic && (
          <p className="notice warn">
            <b>Synthetic demo data.</b> {reason} The results do not describe real places.
          </p>
        )}
        <main id="perspectiva" ref={mainRef} tabIndex={-1} className="atlas-body">
          <div className="stage-swap" key={perspective}>
            {perspective === 'sistem' && <SistemView ws={ws} />}
            {perspective === 'zone' && <ZoneAterizareView ws={ws} />}
            {perspective === 'suprafata' && <SuprafataView ws={ws} />}
          </div>
        </main>

        {mode === 'planificator' && (
          <section className="planner" id="planner" aria-labelledby="planner-h">
            <header className="section-head">
              <p className="eyebrow">Planner mode</p>
              <h2 id="planner-h">Compare two plans in detail</h2>
              <p className="muted">
                Plan A and plan B are the same two options as in the mission below. For each you see the horizon with the Sun and Earth, the exact angles and margins, the shared
                timeline, elevation charts, why each window closes, the earliest alternative in the data, and every interval in a table. Change a site or start date and everything updates.
              </p>
            </header>
            <Comparison ws={ws} />
            <div className="planner-download">
              <button type="button" className="btn" onClick={exportJson} disabled={!sides.length}>
                Download this comparison (.json)
              </button>
              <p className="muted small">
                A data file with both plans: the computed visibility windows, your settings (activity length, horizon model, analysed moment) and the sources. Useful to check the
                numbers or reuse them in a spreadsheet or another program; nothing is sent anywhere.
              </p>
            </div>
          </section>
        )}

        <Mission ws={ws} />

        {mode === 'elev' && (
          <p className="planner-cta">
            Want the angles, thresholds and every interval?{' '}
            <button type="button" className="text-link" onClick={() => setMode('planificator')}>
              Switch to Planner mode
            </button>
            .
          </p>
        )}

        <details className="about" id="despre" ref={aboutRef}>
          <summary>
            <span>About, sources and AI statement</span>
            <span className="muted small">Data provenance, validation, rules, limits, credits</span>
          </summary>
          <MethodsSources bundle={bundle} origin={origin} reason={reason} warnings={warnings} sides={sides} embedded />
        </details>
        <footer className="atlas-foot">
          <p>NASA Space Apps Challenge 2026 project · Lunar Landing Site Navigator. An educational tool, not affiliated with NASA.</p>
          <p>A geometrically visible Earth does not guarantee a radio link; a visible Sun does not guarantee power or thermal safety.</p>
        </footer>
      </div>

      {tourOpen && <Tour ws={ws} onFinish={() => endTour(true)} onSkip={() => endTour(false)} />}
      {quizOpen && <Quiz bundle={bundle} activityMin={activityMin} onClose={() => setQuizOpen(false)} />}
      <p className="toast" role="status" aria-live="polite">
        {note}
      </p>
    </div>
  );
}
