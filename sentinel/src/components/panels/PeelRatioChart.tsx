import React from 'react';
import { useStore } from '../../store/useStore';
import type { PeelHop } from '../../types/graph';

export function PeelRatioChart({ hops }: { hops: PeelHop[] }) {
  if (!hops.length) return null;

  return (
    <div style={{ marginTop: '0.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
        <span className="label-sm" style={{ color: 'var(--color-text-faint)' }}>PEEL RATIO / HOP</span>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <div style={{ width: '8px', height: '8px', background: 'var(--color-primary-container)', borderRadius: '1px' }} />
            <span className="label-sm" style={{ color: 'var(--color-text-faint)' }}>STORE</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <div style={{ width: '8px', height: '8px', background: 'var(--color-secondary)', borderRadius: '1px' }} />
            <span className="label-sm" style={{ color: 'var(--color-text-faint)' }}>PEEL</span>
          </div>
        </div>
      </div>

      {hops.map((hop, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '4px' }}>
          <span className="label-sm" style={{ color: 'var(--color-text-faint)', width: '30px', flexShrink: 0 }}>HOP {hop.hop}</span>
          <div style={{ flex: 1, height: '8px', display: 'flex', borderRadius: '2px', overflow: 'hidden', gap: '1px' }}>
            <div style={{
              width: `${hop.storePercent}%`,
              background: 'var(--color-primary-container)',
              minWidth: hop.storePercent > 0 ? '3px' : 0,
            }} />
            <div style={{
              flex: 1,
              background: 'var(--color-secondary)',
            }} />
          </div>
          <div style={{ display: 'flex', gap: '0.375rem', flexShrink: 0 }}>
            <span className="code-terminal" style={{ color: 'var(--color-primary)', width: '32px' }}>{hop.storePercent}%S</span>
            <span className="code-terminal" style={{ color: 'var(--color-secondary-dim)', width: '32px' }}>{hop.peelPercent}%P</span>
          </div>
        </div>
      ))}
    </div>
  );
}
