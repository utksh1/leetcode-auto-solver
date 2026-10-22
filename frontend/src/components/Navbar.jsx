import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Calendar, Terminal, History, Settings, Zap } from 'lucide-react';
import { CompactIndianTimer } from './IndianTimer';

export default function Navbar() {
  const [authStatus, setAuthStatus] = useState({ checked: false, valid: false, username: null });

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const res = await fetch('/api/session/status');
      if (res.ok) {
        const data = await res.json();
        setAuthStatus({
          checked: true,
          valid: Boolean(data.valid ?? data.isSignedIn),
          username: data.username || null,
        });
      } else {
        setAuthStatus({ checked: true, valid: false, username: null });
      }
    } catch {
      setAuthStatus({ checked: true, valid: false, username: null });
    }
  };

  return (
    <header className="app-header">
      <div className="nav-container">
        <NavLink to="/" className="brand">
          <div className="brand-icon">
            <Zap size={20} color="#a5b4fc" />
          </div>
          <div className="brand-text">
            <span className="brand-title">
              LeetCode<span className="highlight">Auto</span>
            </span>
            <span className="brand-badge">Rust + React</span>
          </div>
        </NavLink>

        <nav className="nav-links">
          <NavLink to="/" end className={({ isActive }) => `nav-btn ${isActive ? 'active' : ''}`}>
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </NavLink>
          <NavLink to="/daily" className={({ isActive }) => `nav-btn ${isActive ? 'active' : ''}`}>
            <Calendar size={18} />
            <span>Daily Challenge</span>
          </NavLink>
          <NavLink to="/solver" className={({ isActive }) => `nav-btn ${isActive ? 'active' : ''}`}>
            <Terminal size={18} />
            <span>Problem Solver</span>
          </NavLink>
          <NavLink to="/history" className={({ isActive }) => `nav-btn ${isActive ? 'active' : ''}`}>
            <History size={18} />
            <span>History</span>
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => `nav-btn ${isActive ? 'active' : ''}`}>
            <Settings size={18} />
            <span>Settings</span>
          </NavLink>
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <CompactIndianTimer />

          <div className="nav-status">
            <span
              className={`status-indicator ${
                !authStatus.checked ? '' : authStatus.valid ? 'active' : 'error'
              }`}
            />
            <span className="status-text" style={{ fontSize: '0.85rem' }}>
              {!authStatus.checked
                ? 'Checking session...'
                : authStatus.valid
                ? authStatus.username
                  ? `Logged in: ${authStatus.username}`
                  : 'Session Active'
                : 'No Session Configured'}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
