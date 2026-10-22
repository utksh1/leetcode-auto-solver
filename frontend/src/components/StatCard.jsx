import React from 'react';

const ACCENTS = {
  violet: { bg: 'rgba(139, 92, 246, 0.12)', color: '#a78bfa' },
  green: { bg: 'rgba(16, 185, 129, 0.12)', color: '#34d399' },
  purple: { bg: 'rgba(168, 85, 247, 0.12)', color: '#c084fc' },
  amber: { bg: 'rgba(245, 158, 11, 0.12)', color: '#fbbf24' },
  rose: { bg: 'rgba(244, 63, 94, 0.12)', color: '#fb7185' },
  sky: { bg: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8' },
};

export default function StatCard({ label, value, sub, icon: Icon, accent = 'violet', progress }) {
  const a = ACCENTS[accent] || ACCENTS.violet;
  return (
    <div className="card stat-card">
      <div className="stat-top">
        <span className="stat-label">{label}</span>
        {Icon && (
          <span className="stat-icon" style={{ background: a.bg, color: a.color }}>
            <Icon size={20} />
          </span>
        )}
      </div>
      <div className="stat-value" style={{ color: a.color }}>
        {value}
      </div>
      {sub && <div className="stat-sub">{sub}</div>}
      {typeof progress === 'number' && (
        <div className="stat-progress">
          <div
            className="stat-progress-fill"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}
    </div>
  );
}
