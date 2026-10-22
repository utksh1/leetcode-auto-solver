import React, { useState, useEffect } from 'react';
import { Zap } from 'lucide-react';

export function useIndianClock() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Next Auto-Solver Cron Run at 10:00:00 UTC
  let nextCronUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 10, 0, 0));
  if (now.getTime() >= nextCronUTC.getTime()) {
    nextCronUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 10, 0, 0));
  }
  const diffCronMs = Math.max(0, nextCronUTC.getTime() - now.getTime());
  const cronHours = String(Math.floor(diffCronMs / 3600000)).padStart(2, '0');
  const cronMinutes = String(Math.floor((diffCronMs % 3600000) / 60000)).padStart(2, '0');
  const cronSeconds = String(Math.floor((diffCronMs % 60000) / 1000)).padStart(2, '0');
  const cronCountdown = `${cronHours}:${cronMinutes}:${cronSeconds}`;

  return { cronCountdown };
}

// The single countdown: when the next problem gets solved automatically.
export function NextSolveCountdown() {
  const { cronCountdown } = useIndianClock();

  return (
    <span className="next-solve-chip" title="Next scheduled auto-solve (10:00 UTC)">
      <Zap size={13} />
      <span className="next-solve-label">Next auto-solve</span>
      <span className="next-solve-time">{cronCountdown}</span>
    </span>
  );
}
