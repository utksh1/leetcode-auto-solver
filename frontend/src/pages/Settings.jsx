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
  Terminal,
  Cpu
} from 'lucide-react';
import { useToast } from '../context/ToastContext';

export default function SettingsPage() {
  const { showToast } = useToast();

  const [sessionCookie, setSessionCookie] = useState('');
  const [csrfToken, setCsrfToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [sessionInfo, setSessionInfo] = useState({
    checked: false,
    valid: false,
    username: null,
    user_slug: null,
    avatar: null,
  });

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
          valid: data.valid,
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
    showToast('Validating cookies against LeetCode GraphQL...', 'info');

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
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '2rem' }}>Settings & Authentication</h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Manage your LeetCode session credentials and scheduler configuration
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))', gap: '24px' }}>
        {/* Left Column: Session Status & Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Status Banner Card */}
          <div className="card">
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ShieldCheck size={20} color="#818cf8" />
                <h2>LeetCode Account Status</h2>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={checkStatus} disabled={checking}>
                <RotateCw size={14} className={checking ? 'animate-spin' : ''} />
              </button>
            </div>
            <div className="card-body">
              {sessionInfo.checked ? (
                sessionInfo.valid ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    {sessionInfo.avatar ? (
                      <img
                        src={sessionInfo.avatar}
                        alt="Avatar"
                        style={{ width: '48px', height: '48px', borderRadius: '50%', border: '2px solid var(--success)' }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '48px',
                          height: '48px',
                          borderRadius: '50%',
                          background: 'rgba(16, 185, 129, 0.2)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--success)',
                          fontWeight: 800,
                        }}
                      >
                        ✓
                      </div>
                    )}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                          {sessionInfo.username || 'Active Account'}
                        </span>
                        <span className="badge badge-success">Session Active</span>
                      </div>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        Authenticated for automated daily challenge submissions.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div
                      style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '50%',
                        background: 'rgba(239, 68, 68, 0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--danger)',
                      }}
                    >
                      <XCircle size={22} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <strong style={{ color: 'var(--danger)' }}>No Valid Session Found</strong>
                        <span className="badge badge-danger">Unauthenticated</span>
                      </div>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Add your session cookies below to enable automated submissions.
                      </p>
                    </div>
                  </div>
                )
              ) : (
                <p style={{ color: 'var(--text-muted)' }}>Checking session validity...</p>
              )}
            </div>
          </div>

          {/* Cookie Input Form */}
          <div className="card">
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Key size={18} color="#818cf8" />
                <h2>Update Session Cookies</h2>
              </div>
            </div>
            <div className="card-body">
              <div className="callout callout-info" style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <Info size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    LeetCode implements Cloudflare protection on direct username/password login.
                    Using browser session cookies bypasses CAPTCHA blocks completely and lasts for weeks.
                  </div>
                </div>
              </div>

              <form onSubmit={handleSaveSession}>
                <div className="form-group">
                  <label htmlFor="inputSessionCookie">LEETCODE_SESSION Cookie *</label>
                  <textarea
                    id="inputSessionCookie"
                    className="form-textarea"
                    rows={3}
                    placeholder="eyJ0eXAiOiJKV1QiLCJhbGci... or raw session string"
                    value={sessionCookie}
                    onChange={(e) => setSessionCookie(e.target.value)}
                    required
                  />
                  <span className="form-hint">Found under Application &gt; Cookies &gt; leetcode.com</span>
                </div>

                <div className="form-group">
                  <label htmlFor="inputCsrfToken">csrftoken Cookie *</label>
                  <input
                    id="inputCsrfToken"
                    type="text"
                    className="form-input"
                    placeholder="e.g. aB3cD4eF5gH6..."
                    value={csrfToken}
                    onChange={(e) => setCsrfToken(e.target.value)}
                    required
                  />
                  <span className="form-hint">Found alongside LEETCODE_SESSION</span>
                </div>

                <button type="submit" className="btn btn-primary" disabled={saving}>
                  <Save size={16} />
                  <span>{saving ? 'Testing & Saving...' : 'Verify & Save Session'}</span>
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Right Column: Step-by-Step Guide & System Info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Quick Guide */}
          <div className="card">
            <div className="card-header">
              <h2>How to Get Your Cookies (60 Seconds)</h2>
            </div>
            <div className="card-body">
              <ol style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.9rem', color: '#cbd5e1' }}>
                <li>
                  Open <a href="https://leetcode.com" target="_blank" rel="noreferrer" style={{ fontWeight: 600 }}>leetcode.com</a> and ensure you are logged into your account.
                </li>
                <li>
                  Press <kbd style={{ background: '#334155', padding: '2px 6px', borderRadius: '4px', color: '#fff' }}>F12</kbd> (or <kbd style={{ background: '#334155', padding: '2px 6px', borderRadius: '4px', color: '#fff' }}>Cmd+Option+I</kbd> on Mac) to open DevTools.
                </li>
                <li>
                  Go to the <b>Application</b> tab (Chrome/Edge/Brave) or <b>Storage</b> tab (Firefox).
                </li>
                <li>
                  Under <b>Cookies</b>, select <code>https://leetcode.com</code>.
                </li>
                <li>
                  Copy the value of the cookie named <code>LEETCODE_SESSION</code> and paste it above.
                </li>
                <li>
                  Copy the value of the cookie named <code>csrftoken</code> and paste it above.
                </li>
                <li>
                  Click <b>Verify &amp; Save Session</b> to test and persist your credentials.
                </li>
              </ol>
            </div>
          </div>

          {/* Engine Architecture & Diagnostics */}
          <div className="card">
            <div className="card-header">
              <h2>System Architecture</h2>
            </div>
            <div className="card-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.9rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Server Runtime</span>
                  <span style={{ fontWeight: 600, color: '#a5b4fc' }}>Rust 1.99 + Axum 0.7</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Memory Footprint</span>
                  <span style={{ fontWeight: 600, color: 'var(--success)' }}>&lt; 15 MB (Render Free Tier Safe)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Daily Cron Trigger</span>
                  <span style={{ fontWeight: 600 }}>10:00 AM UTC (tokio-cron-scheduler)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Solution Repository</span>
                  <span style={{ fontWeight: 600, color: '#818cf8' }}>doocs/leetcode (3,500+ problems)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
