'use client';

// Lunar Quiz: timed multiple choice with speed points and streaks. Questions come from
// lib/logic/quiz.ts (data questions are computed from the loaded Bundle).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Bundle } from '@/lib/data/types';
import { buildQuiz, points, QUIZ_TIME_MS } from '@/lib/logic/quiz';

const LETTERS = ['A', 'B', 'C', 'D'];

type Phase = { kind: 'intro' } | { kind: 'ask'; i: number; t0: number } | { kind: 'reveal'; i: number; picked: number | null; gained: number } | { kind: 'done' };

export function Quiz({ bundle, activityMin, onClose }: { bundle: Bundle; activityMin: number; onClose: () => void }) {
  const questions = useMemo(() => buildQuiz(bundle, activityMin), [bundle, activityMin]);
  const dialog = useRef<HTMLDialogElement>(null);
  const [phase, setPhase] = useState<Phase>({ kind: 'intro' });
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [right, setRight] = useState(0);
  const [now, setNow] = useState(0);

  useEffect(() => {
    const d = dialog.current!;
    d.showModal();
    return () => d.close();
  }, []);


  const start = (i: number) => {
    const t = performance.now();
    setNow(t);
    setPhase({ kind: 'ask', i, t0: t });
  };

  const answer = useCallback(
    (picked: number | null) => {
      if (phase.kind !== 'ask') return;
      const q = questions[phase.i];
      const ok = picked === q.correct;
      const remaining = Math.max(0, QUIZ_TIME_MS - (performance.now() - phase.t0));
      const nextStreak = ok ? streak + 1 : 0;
      const gained = points(ok, remaining, QUIZ_TIME_MS, nextStreak);
      setStreak(nextStreak);
      setBest((b) => Math.max(b, nextStreak));
      setScore((s) => s + gained);
      if (ok) setRight((r) => r + 1);
      setPhase({ kind: 'reveal', i: phase.i, picked, gained });
    },
    [phase, questions, streak],
  );

  const remainingMs = phase.kind === 'ask' ? Math.max(0, QUIZ_TIME_MS - (now - phase.t0)) : 0;
  const answerRef = useRef(answer);
  useEffect(() => {
    answerRef.current = answer;
  }, [answer]);

  // countdown: redraws the bar every frame and answers "no answer" when the time runs out
  useEffect(() => {
    if (phase.kind !== 'ask') return;
    let raf = 0;
    const tick = () => {
      const t = performance.now();
      setNow(t);
      if (t - phase.t0 >= QUIZ_TIME_MS) return answerRef.current(null);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  // keyboard: 1–4 or A–D to answer, Enter for next
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (phase.kind === 'ask') {
        const k = e.key.toUpperCase();
        const idx = ['1', '2', '3', '4'].indexOf(k) >= 0 ? Number(k) - 1 : LETTERS.indexOf(k);
        if (idx >= 0 && idx < questions[phase.i].options.length) answer(idx);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, questions, answer]);

  const next = () => {
    if (phase.kind !== 'reveal') return;
    if (phase.i + 1 < questions.length) start(phase.i + 1);
    else setPhase({ kind: 'done' });
  };
  const restart = () => {
    setScore(0);
    setStreak(0);
    setBest(0);
    setRight(0);
    start(0);
  };

  const q = phase.kind === 'ask' || phase.kind === 'reveal' ? questions[phase.i] : null;
  const progress = phase.kind === 'ask' || phase.kind === 'reveal' ? `${phase.i + 1} / ${questions.length}` : '';

  return (
    <dialog
      ref={dialog}
      className="quiz"
      aria-labelledby="quiz-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="quiz-top">
        <p className="eyebrow" id="quiz-title">
          Lunar Quiz {progress && <span className="mono">· {progress}</span>}
        </p>
        <p className="quiz-score mono" aria-live="polite">
          {score.toLocaleString('en-US')} pts{streak > 1 ? ` · streak ×${streak}` : ''}
        </p>
        <button type="button" className="btn quiet" onClick={onClose}>
          Close
        </button>
      </div>

      {phase.kind === 'intro' && (
        <div className="quiz-center">
          <h2>Ready?</h2>
          <p>
            {questions.length} questions · {QUIZ_TIME_MS / 1000} seconds each. Faster correct answers earn more points (500–1000), and every extra correct answer in a row adds a 100-point
            streak bonus. Every question is about something the tutorial showed you or the landing sites revealed; data questions are computed from the same Horizons and LROC data you explored.
          </p>
          <p className="muted small">Keyboard: 1–4 or A–D to answer, Enter for the next question.</p>
          <button type="button" className="btn primary quiz-go" onClick={() => start(0)} autoFocus>
            Start
          </button>
        </div>
      )}

      {q && (
        <div className="quiz-body">
          {phase.kind === 'ask' && (
            <div className="quiz-timer" aria-hidden="true">
              <span style={{ transform: `scaleX(${remainingMs / QUIZ_TIME_MS})` }} />
            </div>
          )}
          <p className="quiz-tag">{q.fromData ? 'From the data' : 'Concept'}</p>
          <h2 className="quiz-q">{q.prompt}</h2>
          {phase.kind === 'ask' && <p className="quiz-time mono">{Math.ceil(remainingMs / 1000)} s</p>}
          <div className={`quiz-grid n${q.options.length}`}>
            {q.options.map((o, i) => {
              const revealed = phase.kind === 'reveal';
              const state = revealed ? (i === q.correct ? 'is-right' : i === phase.picked ? 'is-wrong' : 'is-dim') : '';
              return (
                <button key={o} type="button" className={`quiz-opt opt-${i} ${state}`} disabled={revealed} onClick={() => answer(i)}>
                  <span className="quiz-letter">{LETTERS[i]}</span>
                  <span>{o}</span>
                  {revealed && i === q.correct && <span className="quiz-mark">✓</span>}
                  {revealed && i === phase.picked && i !== q.correct && <span className="quiz-mark">✕</span>}
                </button>
              );
            })}
          </div>
          {phase.kind === 'reveal' && (
            <div className="quiz-reveal" role="status">
              <p className={phase.picked === q.correct ? 'ok' : 'bad'}>
                <b>{phase.picked === q.correct ? `Correct! +${phase.gained}` : phase.picked == null ? 'Time’s up.' : 'Not this time.'}</b>
              </p>
              <p>{q.explain}</p>
              <button type="button" className="btn primary" onClick={next} autoFocus>
                {phase.i + 1 < questions.length ? 'Next question' : 'See results'}
              </button>
            </div>
          )}
        </div>
      )}

      {phase.kind === 'done' && (
        <div className="quiz-center">
          <h2>{score.toLocaleString('en-US')} points</h2>
          <p className="quiz-stats">
            <span>
              <b>{right}</b> / {questions.length} correct
            </span>
            <span>
              best streak <b>{best}</b>
            </span>
          </p>
          <p className="muted">{right === questions.length ? 'Perfect run. You can explain where and when the rover can work.' : 'Review the “Why?” explanations on the Moon page, then try again.'}</p>
          <div className="row">
            <button type="button" className="btn primary" onClick={restart}>
              Play again
            </button>
            <button type="button" className="btn" onClick={onClose}>
              Back to the atlas
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
