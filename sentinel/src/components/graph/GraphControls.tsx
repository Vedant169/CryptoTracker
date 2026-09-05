import React from 'react';
import { Filter, ZoomIn, ZoomOut } from 'lucide-react';
import { useStore } from '../../store/useStore';

export function GraphControls() {
  const filterThreats = useStore((s) => s.filterThreats);
  const toggleFilterThreats = useStore((s) => s.toggleFilterThreats);
  const traceResult = useStore((s) => s.traceResult);
  const result = traceResult;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.5rem',
      padding: '0.375rem 0.75rem',
      background: 'var(--color-surface-2)',
      borderBottom: '1px solid var(--color-border)',
    }}>
      {/* Node legend — overflow:hidden+minWidth:0 prevent width expansion */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, overflow: 'hidden', minWidth: 0 }}>
        {[
          { color: '#ffd700', label: 'SUSPECT SEED', shape: '★' },
          { color: '#00e55b', label: 'VASP OFFRAMP', shape: '⬡' },
          { color: '#d4004b', label: 'MIXER / FRAUD', shape: '◆' },
          { color: '#ff6b35', label: 'SYBIL CLUSTER', shape: '■' },
          { color: '#5a6a7a', label: 'INTERMEDIATE', shape: '●' },
        ].map((item) => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <span style={{ color: item.color, fontSize: '10px', lineHeight: 1 }}>{item.shape}</span>
            <span className="label-sm" style={{ color: 'var(--color-text-faint)' }}>{item.label}</span>
          </div>
        ))}

        {/* Edge legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginLeft: '0.5rem', borderLeft: '1px solid var(--color-border)', paddingLeft: '0.5rem' }}>
          <div style={{ width: '18px', height: '2px', background: '#d4004b', borderTop: '2px dashed #d4004b' }} />
          <span className="label-sm" style={{ color: 'var(--color-text-faint)' }}>PEEL</span>
          <div style={{ width: '18px', height: '2px', background: '#00e55b', marginLeft: '0.375rem' }} />
          <span className="label-sm" style={{ color: 'var(--color-text-faint)' }}>OFFRAMP</span>
          <div style={{ width: '18px', height: '2px', background: '#5a6a7a', marginLeft: '0.375rem' }} />
          <span className="label-sm" style={{ color: 'var(--color-text-faint)' }}>NORMAL</span>
        </div>
      </div>

      {/* Filter button */}
      <button
        id="filter-threats-btn"
        className={`btn ${filterThreats ? 'btn-secondary' : 'btn-ghost'}`}
        onClick={toggleFilterThreats}
        disabled={!result}
        title={filterThreats ? 'Showing threats only — click to show all' : 'Show threats only'}
      >
        <Filter size={10} />
        {filterThreats ? 'THREATS ONLY' : 'FILTER THREATS'}
      </button>
    </div>
  );
}

