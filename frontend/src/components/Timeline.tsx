"use client";

import { useEffect, useState } from "react";

export function useTimeline(days: number) {
  const [day, setDay] = useState(1);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    if (!playing) return;
    const interval = window.setInterval(() => setDay((value) => value % days + 1), 1200 / speed);
    return () => window.clearInterval(interval);
  }, [days, playing, speed]);

  return { day, setDay, playing, setPlaying, speed, setSpeed, days };
}

export function Timeline({ clock, year = false }: { clock: ReturnType<typeof useTimeline>; year?: boolean }) {
  const { day, setDay, playing, setPlaying, speed, setSpeed, days } = clock;
  function selectCurrentDay() {
    const now = new Date();
    const dayOfYear = (Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(now.getFullYear(), 0, 1)) / 86400000 + 1;
    setPlaying(false);
    setDay(year ? Math.min(dayOfYear, days) : Math.min(now.getDate(), days));
  }

  return (
    <div className="px-4 pb-4 pt-2 sm:px-6">
      <input
        aria-label="Preview day"
        type="range"
        min={1}
        max={days}
        value={day}
        onChange={(event) => {
          setPlaying(false);
          setDay(event.currentTarget.valueAsNumber);
        }}
        className="w-full cursor-pointer accent-accent"
      />
      <p className="mb-3 mt-1 text-center text-sm text-muted">Day {String(day).padStart(2, "0")} / {days}</p>
      <div className="flex flex-wrap justify-between gap-2">
        <button className="ui-button" onClick={() => setSpeed(speed === 4 ? 1 : speed * 2)}>{speed}× speed</button>
        <button className="ui-button ui-button-primary min-w-20" onClick={() => setPlaying(!playing)}>
          <span aria-hidden="true" className="mr-2">{playing ? "Ⅱ" : "▶"}</span>{playing ? "Pause" : "Play"}
        </button>
        <button className="ui-button" onClick={selectCurrentDay}>Current time</button>
      </div>
    </div>
  );
}
