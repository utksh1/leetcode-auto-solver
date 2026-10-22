import React, { useState, useEffect } from 'react';
import { Clock, Timer, Sparkles } from 'lucide-react';

export function useIndianClock() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Format IST time
  const istTimeStr = now.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour12: true,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  // Format IST date
  const istDateStr = now.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  // Next LeetCode Reset at 00:00:00 UTC = 05:30:00 AM IST
  const nextResetUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
  const diffResetMs = Math.max(0, nextResetUTC.getTime() - now.getTime());
  const resetHours = String(Math.floor(diffResetMs / 3600000)).padStart(2, '0');
  const resetMinutes = String(Math.floor((diffResetMs % 3600000) / 60000)).padStart(2, '0');
  const resetSeconds = String(Math.floor((diffResetMs % 60000) / 1000)).padStart(2, '0');
  const resetCountdown = `${resetHours}:${resetMinutes}:${resetSeconds}`;

  // Next Auto-Solver Cron Run at 10:00:00 UTC = 03:30:00 PM IST
  let nextCronUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 10, 0, 0));
  if (now.getTime() >= nextCronUTC.getTime()) {
    nextCronUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 10, 0, 0));
  }
  const diffCronMs = Math.max(0, nextCronUTC.getTime() - now.getTime());
  const cronHours = String(Math.floor(diffCronMs / 3600000)).padStart(2, '0');
  const cronMinutes = String(Math.floor((diffCronMs % 3600000) / 60000)).padStart(2, '0');
  const cronSeconds = String(Math.floor((diffCronMs % 60000) / 1000)).padStart(2, '0');
  const cronCountdown = `${cronHours}:${cronMinutes}:${cronSeconds}`;

  return {
    istTimeStr,
    istDateStr,
    resetCountdown,
    cronCountdown,
  };
}

// Compact widget for Navbar Header
export function CompactIndianTimer() {
  const { istTimeStr, resetCountdown } = useIndianClock();

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '6px 14px',
        background: 'rgba(255, 255, 255, 0.04)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        fontSize: '0.8rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#e2e8f0' }}>
        <Clock size={14} color="#818cf8" />
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{istTimeStr}</span>
        <span style={{ fontSize: '0.7rem', color: '#a5b4fc', background: 'rgba(99, 102, 241, 0.2)', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>
          IST
        </span>
      </div>

      <div style={{ width: '1px', height: '14px', background: 'var(--border-subtle)' }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }} title="Countdown to Next Daily Challenge (05:30 AM IST)">
        <Timer size={14} color="#34d399" />
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Reset:</span>
        <span style={{ fontFamily: 'var(--font-mono)', color: '#34d399', fontWeight: 600 }}>{resetCountdown}</span>
      </div>
    </div>
  );
}

// Full Dashboard / Challenge page Timer Card
export default function IndianTimerCard() {
  const { istTimeStr, istDateStr, resetCountdown, cronCountdown } = useIndianClock();

  return (
    <div
      className="card"
      style={{
        marginBottom: '28px',
        background: 'linear-gradient(135deg, rgba(30, 27, 75, 0.4) 0%, rgba(15, 23, 42, 0.6) 100%)',
        borderColor: 'rgba(99, 102, 241, 0.25)',
      }}
    >
      <div className="card-body" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', alignItems: 'center' }}>
          
          {/* Section 1: Current Indian Time */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '46px',
                height: '46px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(99, 102, 241, 0.15)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Clock size={22} color="#a5b4fc" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                  INDIAN STANDARD TIME
                </span>
                <span style={{ fontSize: '0.7rem', color: '#818cf8', background: 'rgba(99, 102, 241, 0.15)', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                  UTC+5:30
                </span>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.4rem', fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>
                {istTimeStr}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {istDateStr}
              </div>
            </div>
          </div>

          {/* Section 2: Daily Challenge Reset Countdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', borderLeft: '1px solid var(--border-subtle)', paddingLeft: '20px' }}>
            <div
              style={{
                width: '46px',
                height: '46px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Timer size={22} color="#34d399" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                  NEXT DAILY CHALLENGE
                </span>
                <span style={{ fontSize: '0.7rem', color: '#34d399', background: 'rgba(16, 185, 129, 0.15)', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                  05:30 AM IST
                </span>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.4rem', fontWeight: 700, color: '#34d399', letterSpacing: '-0.02em' }}>
                {resetCountdown}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Resets daily at 00:00 UTC
              </div>
            </div>
          </div>

          {/* Section 3: Next Auto-Solver Scheduled Execution */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', borderLeft: '1px solid var(--border-subtle)', paddingLeft: '20px' }}>
            <div
              style={{
                width: '46px',
                height: '46px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Sparkles size={22} color="#fbbf24" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                  NEXT AUTO-SUBMISSION
                </span>
                <span style={{ fontSize: '0.7rem', color: '#fbbf24', background: 'rgba(245, 158, 11, 0.15)', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                  03:30 PM IST
                </span>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.4rem', fontWeight: 700, color: '#fbbf24', letterSpacing: '-0.02em' }}>
                {cronCountdown}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Daily autonomous trigger (10:00 UTC)
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
