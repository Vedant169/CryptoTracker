import React, { useEffect, useState } from 'react';
import { useStore } from '../../store/useStore';

export function BottomTicker() {
  const traceResult = useStore((s) => s.traceResult);
  const result = traceResult;
  const [blockHeight, setBlockHeight] = useState(21489102);

  useEffect(() => {
    const id = setInterval(() => setBlockHeight((b) => b + Math.floor(Math.random() * 2)), 12000);
    return () => clearInterval(id);
  }, []);

  const items = [
    { label: 'MEMPOOL LISTENER', value: 'ONLINE (0.02s POLL)', ok: true },
    { label: 'ALCH:ETHERSCAN RPC', value: '99.99% RESILIENCE', ok: true },
    { label: 'ACTIVE BLOCK', value: blockHeight.toLocaleString(), ok: true },
    { label: 'BASE FEE', value: '18.4 GWEI', ok: true },
    { label: 'SYSTEM', value: 'SENTINEL-DEFENSE-X', ok: true },
    { label: 'CLEARANCE', value: 'LEVEL 5 LAW-ENFORCEMENT', ok: true },
    ...(result ? [
      { label: 'TRACE ID', value: result.traceId, ok: true },
      { label: 'RISK', value: `${result.riskScore}/100`, ok: result.riskScore < 50 },
    ] : []),
  ];

  const doubled = [...items, ...items];

  return (
    <div style={{
      height: '24px', overflow: 'hidden',
      background: 'var(--color-surface-2)',
      display: 'flex', alignItems: 'center',
    }}>
      <div className="ticker-inner" style={{ gap: '2rem' }}>
        {doubled.map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexShrink: 0 }}>
            <span className="label-sm" style={{ color: 'var(--color-text-faint)' }}>{item.label}:</span>
            <span className="code-terminal" style={{ color: item.ok ? 'var(--color-primary)' : 'var(--color-secondary-dim)' }}>
              {item.value}
            </span>
            <span style={{ color: 'var(--color-border)', marginLeft: '0.5rem' }}>|</span>
          </div>
        ))}
      </div>
    </div>
  );
}

