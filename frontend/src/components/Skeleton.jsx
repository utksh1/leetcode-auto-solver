import React from 'react';
import { cn } from '../lib/utils';

export function Skeleton({ width, height = 14, radius, className, style }) {
  return (
    <span
      className={cn('skeleton', className)}
      style={{ display: 'block', width, height, borderRadius: radius, ...style }}
      aria-hidden="true"
    />
  );
}

export function SkeletonText({ lines = 3, width = '100%' }) {
  const widths = ['100%', '92%', '78%', '96%', '64%'];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} width={i === lines - 1 ? '62%' : widths[i % widths.length]} height={12} />
      ))}
      {width !== '100%' && null}
    </div>
  );
}

export function SkeletonCard({ height = 120, style }) {
  return (
    <div className="card" style={{ padding: 22, ...style }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Skeleton width={120} height={12} />
        <Skeleton width={36} height={36} radius={10} />
      </div>
      <Skeleton width={90} height={30} radius={8} />
      <div style={{ marginTop: 14 }}>
        <Skeleton width="55%" height={10} />
      </div>
      <div style={{ height, display: 'none' }} />
    </div>
  );
}

export function SkeletonTableRows({ rows = 5, cols = 4 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r}>
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c}>
              <Skeleton width={c === 1 ? '70%' : '46%'} height={12} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
