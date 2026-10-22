import React from 'react';

const ACCENTS = new Set(['amber', 'green', 'rose', 'red', 'sky']);

export default function StatCard({ label, value, sub, icon: Icon, accent = 'amber', progress, delta }) {
  const tone = ACCENTS.has(accent) ? accent : 'neutral';
  return (
    <div className="card card-hover stat-card">
      <div className="stat-top">
        <span className="stat-label">{label}</span>
        {Icon && (
          <span className="stat-icon" data-accent={tone === 'neutral' ? undefined : tone}>
            <Icon size={16} />
          </span>
        )}
      </div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
      {typeof progress === 'number' && (
        <div className="stat-progress">
          <div
            className="stat-progress-fill"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}
      {delta && <div className="stat-delta">{delta}</div>}
    </div>
  );
}
