import React, { useEffect, useState } from 'react';
import { Activity } from 'lucide-react';

export function SystemHealthPanel() {
  const [blockHeight, setBlockHeight] = useState(21489102);
  const [gasPrice, setGasPrice] = useState({ base: 18.4, priority: 1.2 });
  const [rpcStatus, setRpcStatus] = useState(99.9);

  useEffect(() => {
    const id = setInterval(() => {
      setBlockHeight((b) => b + (Math.random() > 0.5 ? 1 : 0));
      setGasPrice({ base: 16 + Math.random() * 4, priority: 0.8 + Math.random() * 0.8 });
      setRpcStatus(98.5 + Math.random() * 1.5);
    }, 12000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="panel" style={{ minWidth: 0 }}>
      <div className="panel-header">
        <Activity size={11} color="var(--color-primary)" />
        <span className="label-md" style={{ color: 'var(--color-text)' }}>CHAIN HEALTH</span>
      </div>
      {/* Compact horizontal layout — avoids taking too much vertical space */}
      <div style={{ padding: '0.3rem 0.625rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', overflow: 'hidden' }}>
        <HealthRow label="BLOCK" value={`#${blockHeight.toLocaleString()}`} ok />
        <HealthRow label="GAS" value={`${gasPrice.base.toFixed(1)} / ${gasPrice.priority.toFixed(1)} GWEI`} ok />
        <HealthRow label="RPC" value={`${rpcStatus.toFixed(1)}%`} ok />
      </div>
    </div>
  );
}

function HealthRow({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', overflow: 'hidden' }}>
      <span className={`status-dot ${ok ? 'status-dot-active' : 'status-dot-error'}`} style={{ flexShrink: 0 }} />
      <span className="label-sm" style={{ color: 'var(--color-text-faint)', flexShrink: 0 }}>{label}:</span>
      <span className="code-terminal" style={{ color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
    </div>
  );
}
