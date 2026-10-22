import React, { useEffect, useState } from 'react';
import {
  Key,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Info,
  Save,
  RotateCw,
  Server,
  Calendar,
  Database,
  UserCheck,
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

export default function SettingsPage() {
  const { showToast } = useToast();

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

          {/* System info */}
          <div className="card">
            <div className="card-header">
              <div className="card-title-group">
                <span className="card-title-icon">
                  <Server size={18} />
                </span>
                <h2>System Architecture</h2>
              </div>
            </div>
            <div className="card-body" style={{ padding: '4px 20px 10px' }}>
              <div className="def-list">
                {[
                  { icon: Server, label: 'Server Runtime', value: 'Rust + Axum 0.7', tone: 'var(--accent-strong)' },
                  { icon: Database, label: 'Memory Footprint', value: '< 15 MB (Render Free Tier Safe)', tone: 'var(--success-text)' },
                  { icon: Calendar, label: 'Daily Cron Trigger', value: '10:00 AM UTC (tokio-cron-scheduler)', tone: 'var(--text-primary)' },
                  { icon: Database, label: 'Solution Repository', value: 'doocs/leetcode (3,500+ problems)', tone: 'var(--accent-strong)' },
                ].map(({ icon: Icon, label, value, tone }) => (
                  <div key={label} className="def-row">
                    <span className="def-key">
                      <Icon size={15} />
                      {label}
                    </span>
                    <span className="def-value" style={{ color: tone }}>
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
