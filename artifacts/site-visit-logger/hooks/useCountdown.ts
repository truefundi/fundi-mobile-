import { useEffect, useState } from 'react';

/**
 * Fraction of a timed stage that has elapsed, refreshed every second.
 *
 * Returns `progress` from 0 to 1 and the whole seconds still remaining, so
 * screens can show a live ETA while the simulated technician travels.
 */
export function useCountdown(since: string, durationMs: number) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  const elapsed = Math.max(now - new Date(since).getTime(), 0);
  const remainingMs = Math.max(durationMs - elapsed, 0);
  return {
    progress: durationMs > 0 ? Math.min(elapsed / durationMs, 1) : 1,
    remainingSeconds: Math.ceil(remainingMs / 1000),
  };
}

/**
 * Whole seconds until `iso`, refreshed every second; null when there is no
 * deadline. Used for the client's 10-minute confirmation window.
 */
export function useSecondsUntil(iso: string | null | undefined): number | null {
  const [now, setNow] = useState(() => Date.now());
  const target = iso ? new Date(iso).getTime() : NaN;
  const active = Number.isFinite(target);

  useEffect(() => {
    if (!active) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [active]);

  return active ? Math.max(Math.ceil((target - now) / 1000), 0) : null;
}

/** 0:00-style label for a number of seconds. */
export function formatSeconds(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}
