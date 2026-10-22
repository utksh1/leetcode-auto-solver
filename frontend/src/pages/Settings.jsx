import React, { useEffect, useRef, useState } from 'react';
import {
  Key,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Info,
  Save,
  RotateCw,
  Server,
  CalendarClock,
  Database,
  UserCheck,
  Activity,
  Cpu,
  MemoryStick,
  Timer,
  Send,
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { Skeleton } from '../components/Skeleton';

const GUIDE_STEPS = [
  {
    text: 'Open',
    link: { href: 'https://leetcode.com', label: 'leetcode.com' },
    after: ' and make sure you are logged into your account.',
  },
  {
    text: 'Press',
    kbd: ['F12'],
    kbdAlt: 'Cmd+Option+I on Mac',
    after: ' to open browser DevTools.',
  },
  {
    text: 'Go to the',
    bold: 'Application',
    tail: ' tab (Chrome/Edge/Brave) or',
    bold2: 'Storage',
    tail2: ' tab (Firefox).',
  },
  {
    text: 'Under',
    bold: 'Cookies',
    after: ', select https://leetcode.com.',
  },
  {
    text: 'Copy the value of the cookie named',
    code: 'LEETCODE_SESSION',
    after: ' and paste it into the form.',
  },
  {
    text: 'Copy the value of the cookie named',
    code: 'csrftoken',
    after: ' and paste it as well.',
  },
  {
    text: 'Click',
    bold: 'Verify & Save Session',
    after: ' to test and persist your credentials.',
  },
];

const SYSTEM_POLL_MS = 2000;

/**
 * Polls GET /api/system for realtime process specs (RSS memory, CPU, uptime,
 * cron countdown, request counter) and re-renders every second so the live
 * values keep ticking between polls.
 */
function useSystemSpecs(pollMs) {
  const [specs, setSpecs] = useState(null);
  const [offline, setOffline] = useState(false);
  const fetchedAtRef = useRef(0);
  const [, forceTick] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch('/api/system', { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        fetchedAtRef.current = Date.now();
        setSpecs(data);
        setOffline(false);
      } catch {
        if (!cancelled) setOffline(true);
      }
    };

    load();
    const pollId = setInterval(load, pollMs);
    const tickId = setInterval(() => forceTick((t) => (t + 1) % 1000), 1000);

    return () => {
      cancelled = true;
      clearInterval(pollId);
      clearInterval(tickId);
    };
  }, [pollMs]);

  return { specs, offline, fetchedAtRef };
}

/** "07:12:03" or "1d 07:12:03" */
function fmtClock(totalSecs) {
  const s = Math.max(0, Math.floor(totalSecs));
  const d = Math.floor(s / 86400);
  const h = String(Math.floor((s % 86400) / 3600)).padStart(2, '0');
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const sec = String(s % 60).padStart(2, '0');
  return d > 0 ? `${d}d ${h}:${m}:${sec}` : `${h}:${m}:${sec}`;
}

/** "3h 12m 44s" / "1d 3h 12m" */
function fmtUptime(totalSecs) {
  const s = Math.max(0, Math.floor(totalSecs));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  return `${m}m ${sec}s`;
}

export default function SettingsPage() {
  const { showToast } = useToast();
  const { specs, offline, fetchedAtRef } = useSystemSpecs(SYSTEM_POLL_MS);

  const [sessionCookie, setSessionCookie] = useState('');
  const [csrfToken, setCsrfToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [sessionInfo, setSessionInfo] = useState(null);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    setChecking(true);
    try {
      const res = await fetch('/api/session/status');
      if (res.ok) {
        const data = await res.json();
        setSessionInfo({
          checked: true,
          valid: Boolean(data.valid),
          username: data.username || null,
          user_slug: data.user_slug || null,
          avatar: data.avatar || null,
        });
      } else {
        setSessionInfo({ checked: true, valid: false });
      }
    } catch {
      setSessionInfo({ checked: true, valid: false });
    } finally {
      setChecking(false);
    }
  };

  const handleSaveSession = async (e) => {
    e.preventDefault();
    if (!sessionCookie.trim() || !csrfToken.trim()) {
      showToast('Please enter both LEETCODE_SESSION and csrftoken', 'error');
      return;
    }

    setSaving(true);
    showToast('Validating cookies against LeetCode GraphQL…', 'info');

    try {
      const res = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_token: sessionCookie.trim(),
          leetcode_session: sessionCookie.trim(),
          csrf_token: csrfToken.trim(),
        }),
      });

      const data = await res.json();
      if (data.valid) {
        showToast(
          `Authentication verified! Logged in as ${data.username || 'LeetCode User'}`,
          'success'
        );
        setSessionCookie('');
        setCsrfToken('');
        checkStatus();
      } else {
        showToast(
          `Invalid session cookies: ${data.message || 'Please check and re-enter.'}`,
          'error'
        );
      }
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  // ---- Realtime spec derivations (interpolated between polls) ----
  const elapsedSinceFetch = specs && fetchedAtRef.current
    ? Math.max(0, Math.floor((Date.now() - fetchedAtRef.current) / 1000))
    : 0;
  const memPct = specs ? Math.min(100, (specs.memory_rss_mb / specs.memory_budget_mb) * 100) : 0;
  const memTone = memPct >= 80 ? 'danger' : memPct >= 50 ? 'warn' : 'ok';
  const uptimeLive = specs ? specs.uptime_secs + elapsedSinceFetch : 0;
  const cronIn = specs ? Math.max(0, specs.cron_next_run_in_secs - elapsedSinceFetch) : 0;

  const specRows = [
    {
      icon: Server,
      label: 'Server Runtime',
      value: 'Rust + Axum 0.7',
      tone: 'var(--accent-strong)',
    },
    {
      icon: MemoryStick,
      label: 'Memory Footprint',
      value: specs
        ? `${specs.memory_rss_mb.toFixed(1)} MB / 512 MB · app target < 15 MB`
        : '…',
      tone: memPct >= 80 ? 'var(--danger-text)' : memPct >= 50 ? 'var(--warning-text)' : 'var(--success-text)',
    },
    {
      icon: CalendarClock,
      label: 'Daily Cron Trigger',
      value: '10:00 AM UTC (tokio-cron-scheduler)',
      tone: 'var(--text-primary)',
    },
    {
      icon: Timer,
      label: 'Next Auto-Solve',
      value: specs ? `in ${fmtClock(cronIn)}` : '…',
      tone: 'var(--success-text)',
      title: specs?.cron_next_run_iso,
    },
    {
      icon: Database,
      label: 'Solution Repository',
      value: 'doocs/leetcode (3,500+ problems)',
      tone: 'var(--accent-strong)',
    },
    {
      icon: Activity,
      label: 'Requests Served',
      value: specs ? specs.requests_served.toLocaleString() : '…',
      tone: 'var(--text-primary)',
    },
    {
      icon: Send,
      label: 'Submissions Processed',
      value: specs
        ? `${specs.submissions_total} total · ${specs.submissions_accepted} accepted`
        : '…',
      tone: 'var(--text-primary)',
    },
    {
      icon: Cpu,
      label: 'Process',
      value: specs
        ? `PID ${specs.pid} · ${specs.arch}-${specs.os} · ${specs.profile}`
        : '…',
      tone: 'var(--text-muted)',
    },
  ];

  return (
    <div className="page-enter">
      <div className="page-head">
        <div>
          <h1>Settings & Authentication</h1>
          <p className="page-desc">
            Manage your LeetCode session credentials and review the solver configuration
          </p>
        </div>
      </div>

      <div className="grid-2-wide">
        {/* Left column */}
        <div className="stack">
          {/* Status */}
          <div className="card">
            <div className="card-header">
              <div className="card-title-group">
                <span className="card-title-icon">
                  <ShieldCheck size={19} />
                </span>
                <h2>LeetCode Account Status</h2>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-icon"
                onClick={checkStatus}
                disabled={checking}
                title="Re-check session validity"
                aria-label="Re-check session validity"
              >
                <RotateCw size={15} className={checking ? 'animate-spin' : ''} />
              </button>
            </div>
            <div className="card-body">
              {!sessionInfo?.checked ? (
                <div className="row" style={{ gap: 14 }}>
                  <Skeleton width={48} height={48} radius={999} />
                  <div style={{ flex: 1 }}>
                    <Skeleton width={140} height={16} />
                    <div style={{ height: 8 }} />
                    <Skeleton width={220} height={11} />
                  </div>
                </div>
              ) : sessionInfo.valid ? (
                <div className="row" style={{ gap: 16, flexWrap: 'nowrap' }}>
                  {sessionInfo.avatar ? (
                    <img
                      src={sessionInfo.avatar}
                      alt={`${sessionInfo.username || 'Account'} avatar`}
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: '50%',
                        border: '2px solid var(--success)',
                        flexShrink: 0,
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: '50%',
                        background: 'rgba(16, 185, 129, 0.16)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--success)',
                        flexShrink: 0,
                      }}
                    >
                      <UserCheck size={22} />
                    </div>
                  )}
                  <div>
                    <div className="row" style={{ gap: 8 }}>
                      <span style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {sessionInfo.username || 'Active Account'}
                      </span>
                      <span className="badge badge-success">
                        <CheckCircle2 size={11} />
                        Session Active
                      </span>
                    </div>
                    <p style={{ fontSize: '0.84rem', marginTop: 2 }}>
                      Authenticated for automated daily challenge submissions.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="row" style={{ gap: 14, flexWrap: 'nowrap' }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: '50%',
                      background: 'rgba(244, 63, 94, 0.14)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--danger)',
                      flexShrink: 0,
                    }}
                  >
                    <XCircle size={22} />
                  </div>
                  <div>
                    <div className="row" style={{ gap: 8 }}>
                      <strong style={{ color: 'var(--danger-text)' }}>No Valid Session Found</strong>
                      <span className="badge badge-danger">Unauthenticated</span>
                    </div>
                    <p style={{ fontSize: '0.84rem', marginTop: 2 }}>
                      Add your session cookies below to enable automated submissions.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Cookie form */}
          <div className="card">
            <div className="card-header">
              <div className="card-title-group">
                <span className="card-title-icon">
                  <Key size={18} />
                </span>
                <h2>Update Session Cookies</h2>
              </div>
            </div>
            <div className="card-body">
              <div className="callout callout-info" style={{ marginBottom: 20 }}>
                <div className="row" style={{ gap: 10, alignItems: 'flex-start', flexWrap: 'nowrap' }}>
                  <Info size={17} style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    LeetCode protects direct logins with Cloudflare. Using browser session cookies
                    bypasses CAPTCHA blocks entirely and typically stays valid for weeks.
                  </div>
                </div>
              </div>

              <form onSubmit={handleSaveSession}>
                <div className="form-group">
                  <label htmlFor="inputSessionCookie">LEETCODE_SESSION cookie *</label>
                  <div style={{ position: 'relative' }}>
                    <textarea
                      id="inputSessionCookie"
                      className="form-textarea"
                      rows={3}
                      placeholder="eyJ0eXAiOiJKV1QiLCJhbGci…"
                      value={sessionCookie}
                      onChange={(e) => setSessionCookie(e.target.value)}
                      required
                    />
                  </div>
                  <span className="form-hint">Found under Application → Cookies → leetcode.com</span>
                </div>

                <div className="form-group">
                  <label htmlFor="inputCsrfToken">csrftoken cookie *</label>
                  <input
                    id="inputCsrfToken"
                    type="text"
                    className="form-input"
                    placeholder="aB3cD4eF5gH6…"
                    value={csrfToken}
                    onChange={(e) => setCsrfToken(e.target.value)}
                    required
                    autoComplete="off"
                    spellCheck="false"
                  />
                  <span className="form-hint">Found alongside LEETCODE_SESSION in the same panel</span>
                </div>

                <button type="submit" className="btn btn-primary" disabled={saving}>
                  <Save size={16} />
                  <span>{saving ? 'Testing & Saving…' : 'Verify & Save Session'}</span>
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="stack">
          {/* Guide */}
          <div className="card">
            <div className="card-header">
              <div className="card-title-group">
                <span className="card-title-icon">
                  <Key size={18} />
                </span>
                <h2>How to Get Your Cookies (60 Seconds)</h2>
              </div>
            </div>
            <div className="card-body">
              <ol className="guide-steps">
                {GUIDE_STEPS.map((step, i) => (
                  <li key={i}>
                    <span>{step.text} </span>
                    {step.link && (
                      <a href={step.link.href} target="_blank" rel="noreferrer" style={{ fontWeight: 600 }}>
                        {step.link.label}
                      </a>
                    )}
                    {step.kbd && (
                      <>
                        <kbd>{step.kbd[0]}</kbd>
                        {step.kbdAlt && <span> ({step.kbdAlt})</span>}
                      </>
                    )}
                    {step.bold && <strong>{step.bold}</strong>}
                    {step.tail && <span>{step.tail}</span>}
                    {step.bold2 && <strong>{step.bold2}</strong>}
                    {step.tail2 && <span>{step.tail2}</span>}
                    {step.code && <code>{step.code}</code>}
                    {step.after && <span>{step.after}</span>}
                  </li>
                ))}
              </ol>
            </div>
          </div>

          {/* System Architecture — realtime monitor */}
          <div className="card">
            <div className="card-header">
              <div className="card-title-group">
                <span className="card-title-icon">
                  <Server size={18} />
                </span>
                <h2>System Architecture</h2>
              </div>
              <span
                className={`sys-chip${offline ? ' sys-chip-off' : ''}`}
                title={offline ? 'Cannot reach /api/system' : `Live metrics, refreshed every ${SYSTEM_POLL_MS / 1000}s`}
              >
                <span className="sys-chip-dot" />
                {offline ? 'OFFLINE' : 'LIVE'}
              </span>
            </div>
            <div className="card-body">
              {/* Realtime tiles */}
              <div className="sys-tiles">
                <div className="sys-tile">
                  <span className="sys-tile-label">
                    <MemoryStick size={12} />
                    Memory
                  </span>
                  <span className="sys-tile-value">
                    {specs ? specs.memory_rss_mb.toFixed(1) : '—'}
                    <small> MB</small>
                  </span>
                  <div
                    className="sys-bar"
                    role="progressbar"
                    aria-label="Memory usage against 512 MB Render free tier budget"
                    aria-valuemin={0}
                    aria-valuemax={512}
                    aria-valuenow={specs ? specs.memory_rss_mb : 0}
                  >
                    <div className={`sys-bar-fill ${memTone}`} style={{ width: `${memPct}%` }} />
                  </div>
                  <span className="sys-tile-sub">512 MB Render free tier</span>
                </div>

                <div className="sys-tile">
                  <span className="sys-tile-label">
                    <Cpu size={12} />
                    CPU
                  </span>
                  <span className="sys-tile-value">
                    {specs ? specs.cpu_percent.toFixed(1) : '—'}
                    <small> %</small>
                  </span>
                  <span className="sys-tile-sub">process usage</span>
                </div>

                <div className="sys-tile">
                  <span className="sys-tile-label">
                    <Timer size={12} />
                    Uptime
                  </span>
                  <span className="sys-tile-value sys-tile-value-sm">
                    {specs ? fmtUptime(uptimeLive) : '—'}
                  </span>
                  <span className="sys-tile-sub">since last restart</span>
                </div>
              </div>

              {/* Spec rows */}
              <div className="def-list">
                {specRows.map(({ icon: Icon, label, value, tone, title }) => (
                  <div key={label} className="def-row">
                    <span className="def-key">
                      <Icon size={15} />
                      {label}
                    </span>
                    <span className="def-value" style={{ color: tone }} title={title || undefined}>
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
