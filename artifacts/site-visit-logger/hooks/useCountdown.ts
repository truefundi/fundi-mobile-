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
