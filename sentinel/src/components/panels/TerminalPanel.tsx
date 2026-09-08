import React, { useEffect, useRef } from 'react';
import { Terminal } from 'lucide-react';
import { useStore } from '../../store/useStore';

export function TerminalPanel() {
  const terminalLines = useStore((s) => s.terminalLines);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [terminalLines]);

  function lineColor(line: string): string {
    if (line.includes('[ALERT]') || line.includes('ERROR')) return 'var(--color-secondary-dim)';
    if (line.includes('[PASS]') || line.includes('COMPLETE')) return 'var(--color-primary)';
    if (line.includes('[ML]') || line.includes('[GDS]')) return 'var(--color-tertiary)';
    if (line.includes('[MEMPOOL]')) return '#f59e0b';
    if (line.includes('[SYS]')) return 'var(--color-text-faint)';
    return 'var(--color-text-muted)';
  }

  return (
    <div className="panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div className="panel-header">
        <Terminal size={11} color="var(--color-primary)" />
        <span className="label-md" style={{ color: 'var(--color-text)' }}>NEO4J CYPHER</span>
        <span className="label-sm" style={{ color: 'var(--color-text-faint)', marginLeft: 'auto' }}>INSPECTOR</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <span className="status-dot status-dot-active" />
          <span className="code-terminal" style={{ color: 'var(--color-primary)' }}>STREAMING</span>
        </div>
      </div>

      {/* Query display */}
      <div style={{ padding: '0.5rem 0.625rem', borderBottom: '1px solid var(--color-border)', background: 'var(--color-lowest)' }}>
        <div className="code-terminal" style={{ color: 'var(--color-text-faint)', marginBottom: '2px' }}>QUERY</div>
        <div className="code-terminal" style={{ color: 'var(--color-tertiary)', lineHeight: '1.6' }}>
          {`MATCH (w:Wallet {addr:'0x7c15...'})
-[:TRANSFERRED_TO*1..5]->(n:GSP)
RETURN w, n`}
        </div>
      </div>

      {/* Log stream */}
      <div
        ref={scrollRef}
        style={{ flex: 1, overflow: 'auto', padding: '0.5rem 0.625rem' }}
      >
        {terminalLines.map((line, i) => (
          <div
            key={i}
            className="code-terminal"
            style={{ color: lineColor(line), lineHeight: '1.7', fontFamily: 'var(--font-mono)' }}
          >
            {line}
          </div>
        ))}
      </div>

      {/* Engine footer */}
      <div style={{
        padding: '0.375rem 0.625rem',
        borderTop: '1px solid var(--color-border)',
        background: 'var(--color-surface-2)',
        display: 'flex', justifyContent: 'space-between',
      }}>
        <span className="code-terminal" style={{ color: 'var(--color-text-faint)' }}>ENGINE: CYPHER 5.18 GDS</span>
        <span className="code-terminal" style={{ color: 'var(--color-primary)' }}>14.2ms / BOP</span>
      </div>
    </div>
  );
}
