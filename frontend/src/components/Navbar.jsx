import React, { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Calendar,
  Terminal,
  History,
  Settings,
  Zap,
  Menu,
  X,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { CompactIndianTimer } from './IndianTimer';

const NAV_ITEMS = [
  { to: '/', end: true, icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/daily', icon: Calendar, label: 'Daily Challenge' },
  { to: '/solver', icon: Terminal, label: 'Problem Solver' },
  { to: '/history', icon: History, label: 'History' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

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

  // Close the mobile menu whenever the route changes
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // Lock body scroll while the mobile menu is open
  useEffect(() => {
    document.body.classList.toggle('modal-open', menuOpen);
    return () => document.body.classList.remove('modal-open');
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
      <header className="app-header">
        <div className="nav-container">
          <NavLink to="/" className="brand" aria-label="LeetCode Auto home">
            <span className="brand-icon">
              <Zap size={20} />
            </span>
            <span className="brand-text">
              <span className="brand-title">
                LeetCode<span className="highlight">Auto</span>
              </span>
              <span className="brand-badge">Rust + React</span>
            </span>
          </NavLink>

          <nav className="nav-links" aria-label="Primary">
            {NAV_ITEMS.map(({ to, end, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) => cn('nav-btn', isActive && 'active')}
              >
                <Icon size={17} />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="nav-right">
            <CompactIndianTimer />

            <div
              className="nav-status"
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
              <span className="status-text">{statusText}</span>
            </div>

            <button
              type="button"
              className="nav-toggle"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </header>

      {menuOpen && (
        <div className="mobile-menu">
          <nav aria-label="Mobile">
            {NAV_ITEMS.map(({ to, end, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) => cn('nav-btn', isActive && 'active')}
              >
                <Icon size={18} />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="nav-status">
            <span
              className={cn(
                'status-indicator',
                !authStatus.checked ? '' : authStatus.valid ? 'active' : 'error'
              )}
            />
            <span className="status-text">{statusText}</span>
          </div>
        </div>
      )}
    </>
  );
}
