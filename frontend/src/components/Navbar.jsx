import React, { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  CalendarClock,
  Terminal,
  History,
  Settings,
  Zap,
  Menu,
  X,
} from 'lucide-react';
import { cn } from '../lib/utils';

const NAV_ITEMS = [
  { to: '/', end: true, icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/daily', icon: CalendarClock, label: 'Daily Challenge' },
  { to: '/solver', icon: Terminal, label: 'Problem Solver' },
  { to: '/history', icon: History, label: 'History' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

function Brand({ compact = false }) {
  return (
    <NavLink to="/" className="brand" aria-label="LeetCode Auto home">
      <span className="brand-icon">
        <Zap size={compact ? 16 : 18} strokeWidth={2.4} />
      </span>
      {!compact && (
        <span className="brand-text">
          <span className="brand-title">
            LeetCode<span className="brand-accent">Auto</span>
          </span>
          <span className="brand-badge">Rust + React</span>
        </span>
      )}
    </NavLink>
  );
}

function SessionChip({ authStatus, statusText, statusTitle }) {
  return (
    <div
      className="session-chip"
      title={statusTitle}
      aria-live="polite"
      role="status"
    >
      <span
        className={cn(
          'status-indicator',
          !authStatus.checked ? '' : authStatus.valid ? 'active' : 'error'
        )}
      />
      <span className="session-chip-text">
        <span className="session-chip-label">
          {authStatus.checked ? (authStatus.valid ? 'Signed in as' : 'Session') : 'Checking…'}
        </span>
        <span className="session-chip-user">
          {authStatus.checked
            ? authStatus.valid
              ? authStatus.username || 'Active'
              : 'Not configured'
            : statusText}
        </span>
      </span>
    </div>
  );
}

function NavLinks() {
  return (
    <>
      {NAV_ITEMS.map(({ to, end, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) => cn('nav-btn', isActive && 'active')}
        >
          <Icon size={16} />
          <span>{label}</span>
        </NavLink>
      ))}
    </>
  );
}

export default function Navbar() {
  const [authStatus, setAuthStatus] = useState({ checked: false, valid: false, username: null });
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;
    const checkSession = async () => {
      try {
        const res = await fetch('/api/session/status');
        if (!cancelled && res.ok) {
          const data = await res.json();
          setAuthStatus({
            checked: true,
            valid: Boolean(data.valid ?? data.isSignedIn),
            username: data.username || null,
          });
          return;
        }
      } catch {
        /* fall through */
      }
      if (!cancelled) setAuthStatus({ checked: true, valid: false, username: null });
    };
    checkSession();
    return () => {
      cancelled = true;
    };
  }, []);

  // Close the mobile drawer whenever the route changes
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // Lock body scroll while the drawer is open
  useEffect(() => {
    document.body.classList.toggle('modal-open', menuOpen);
    return () => document.body.classList.remove('modal-open');
  }, [menuOpen]);

  // Escape closes the drawer
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [menuOpen]);

  const statusText = !authStatus.checked
    ? 'Checking session…'
    : authStatus.valid
      ? authStatus.username
        ? `Logged in: ${authStatus.username}`
        : 'Session Active'
      : 'No Session Configured';

  const statusTitle = authStatus.checked
    ? authStatus.valid
      ? 'LeetCode session is valid — automated submissions enabled.'
      : 'No valid LeetCode session. Configure cookies in Settings.'
    : 'Verifying your LeetCode session…';

  return (
    <>
      {/* ── Desktop sidebar ─────────────────────────────────────────────── */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Brand />
        </div>

        <nav className="sidebar-nav" aria-label="Primary">
          <span className="sidebar-nav-label">Console</span>
          <NavLinks />
        </nav>

        <div className="sidebar-foot">
          <SessionChip
            authStatus={authStatus}
            statusText={statusText}
            statusTitle={statusTitle}
          />
        </div>
      </aside>

      {/* ── Mobile topbar ───────────────────────────────────────────────── */}
      <header className="topbar">
        <button
          type="button"
          className="nav-toggle"
          aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={menuOpen}
          aria-controls="mobile-drawer"
          onClick={() => setMenuOpen((o) => !o)}
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        <Brand compact />

        <div className="topbar-spacer">
          <span
            className={cn(
              'status-indicator',
              !authStatus.checked ? '' : authStatus.valid ? 'active' : 'error'
            )}
            role="status"
            aria-live="polite"
            aria-label={statusText}
            title={statusTitle}
          />
        </div>
      </header>

      {/* ── Mobile drawer ───────────────────────────────────────────────── */}
      <div
        className={cn('drawer-overlay')}
        style={{ display: menuOpen ? undefined : 'none' }}
        onClick={() => setMenuOpen(false)}
        aria-hidden="true"
      />
      <div
        id="mobile-drawer"
        className={cn('drawer', menuOpen && 'open')}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        <div className="drawer-brand">
          <Brand />
        </div>

        <nav className="drawer-nav" aria-label="Primary mobile">
          <NavLinks />
        </nav>

        <div className="drawer-foot">
          <SessionChip
            authStatus={authStatus}
            statusText={statusText}
            statusTitle={statusTitle}
          />
        </div>
      </div>
    </>
  );
}
