import React, { useEffect, useState, useCallback } from 'react';
import { useStore } from '../store/useStore';

// ── Types ─────────────────────────────────────────────────────────────────────

interface VaspHit {
  exchange:   string;
  address:    string;
  hops:       number;
  path:       string[];
  total_eth:  number;
  risk_level: 'CRITICAL' | 'HIGH' | 'MEDIUM';
}

interface VaspData {
  vasps:       VaspHit[];
  total_found: number;
  error?:      string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const API = 'http://127.0.0.1:8000';

const RISK_STYLE: Record<string, React.CSSProperties> = {
  CRITICAL: { color: '#ff4d6d', background: 'rgba(212,0,75,0.15)', border: '1px solid rgba(212,0,75,0.4)' },
  HIGH:     { color: '#f59e0b', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.35)' },
  MEDIUM:   { color: 'var(--color-tertiary)', background: 'rgba(76,215,246,0.08)', border: '1px solid rgba(76,215,246,0.25)' },
};

function Badge({ level }: { level: string }) {
  const s = RISK_STYLE[level] ?? RISK_STYLE.MEDIUM;
  return (
    <span style={{
      ...s,
      fontFamily: 'var(--font-mono)',
      fontSize: '9px',
      fontWeight: 700,
      letterSpacing: '0.1em',
      padding: '2px 8px',
      borderRadius: '999px',
      textTransform: 'uppercase',
    }}>
      {level}
    </span>
  );
}

function trunc(s: string, n = 20) {
  return s.length > n ? s.slice(0, 8) + '…' + s.slice(-6) : s;
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div style={{
      background: 'var(--color-surface-1)',
      border: '1px solid var(--color-border)',
      borderRadius: '6px',
      padding: '12px 16px',
      minWidth: '140px',
      flex: 1,
    }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-text-faint)', marginBottom: '6px' }}>
        {label}
      </div>
      <div style={{ fontFamily: 'var(--font-sans)', fontSize: '22px', fontWeight: 700, color: 'var(--color-primary)', lineHeight: 1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '4px' }}>{sub}</div>}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function VaspOfframps() {
  const traceAddress = useStore((s) => s.traceAddress);
  const [data, setData]     = useState<VaspData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const fetchVasps = useCallback(async (addr: string) => {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch(`${API}/vasp-offramps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: addr }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: VaspData = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (e: any) {
      setError(e.message ?? 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (traceAddress) fetchVasps(traceAddress);
  }, [traceAddress, fetchVasps]);

  const minHops = data?.vasps.length ? Math.min(...data.vasps.map((v) => v.hops)) : 0;
  const totalEth = data?.vasps.reduce((acc, v) => acc + v.total_eth, 0) ?? 0;

  // ── Awaiting target ───────────────────────────────────────────────────────
  if (!traceAddress) return (
    <EmptyState message="No active trace. Run a wallet trace from the Graph Explorer to populate VASP data." />
  );

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (loading) return (
    <PageShell title="VASP OFFRAMP DETECTOR" subtitle="BFS + DIJKSTRA ROUTING">
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
        {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
      </div>
      <SkeletonTable rows={4} />
    </PageShell>
  );

  // ── Error ─────────────────────────────────────────────────────────────────
  if (error) return (
    <PageShell title="VASP OFFRAMP DETECTOR" subtitle="BFS + DIJKSTRA ROUTING">
      <ErrorBanner message={error} onRetry={() => fetchVasps(traceAddress)} />
    </PageShell>
  );

  return (
    <PageShell title="VASP OFFRAMP DETECTOR" subtitle="BFS + DIJKSTRA ROUTING">
      {/* ── Address bar ──────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <span style={{ fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-text-faint)' }}>TARGET</span>
        <code style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-tertiary)', background: 'var(--color-surface-2)', padding: '3px 10px', borderRadius: '4px', border: '1px solid var(--color-border)' }}>
          {traceAddress}
        </code>
        <button className="btn btn-ghost" style={{ marginLeft: 'auto' }} onClick={() => fetchVasps(traceAddress)}>
          ↻ Re-scan
        </button>
      </div>

      {/* ── Stat cards ───────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <StatCard label="Exchanges Found" value={data?.total_found ?? 0} sub="reachable within 5 hops" />
        <StatCard label="Shortest Path"   value={data?.vasps.length ? `${minHops} hop${minHops !== 1 ? 's' : ''}` : '—'} sub="Dijkstra min-path" />
        <StatCard label="Total ETH Exposed" value={totalEth.toFixed(4)} sub="deposited to VASPs" />
      </div>

      {/* ── Table ────────────────────────────────────────────────────────── */}
      {!data?.vasps.length ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-faint)', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>✓</div>
          No known VASP addresses reachable within 5 hops from this wallet.
        </div>
      ) : (
        <div style={{ overflow: 'auto', border: '1px solid var(--color-border)', borderRadius: '6px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
            <thead>
              <tr style={{ background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)' }}>
                {['Exchange', 'Address', 'Hops', 'ETH Deposited', 'Risk', 'Path'].map((h) => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-text-faint)', fontWeight: 600 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.vasps.map((vasp) => {
                const isExpanded = expandedRow === vasp.address;
                return (
                  <React.Fragment key={vasp.address}>
                    <tr
                      style={{ borderBottom: '1px solid var(--color-border)', cursor: 'pointer', transition: 'background 0.12s' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-surface-1)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      onClick={() => setExpandedRow(isExpanded ? null : vasp.address)}
                    >
                      <td style={{ padding: '10px 12px', fontFamily: 'var(--font-sans)', fontWeight: 600, color: 'var(--color-text)' }}>
                        {vasp.exchange}
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--color-tertiary)' }}>
                        {trunc(vasp.address, 22)}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <span style={{ background: 'var(--color-surface-3)', borderRadius: '4px', padding: '2px 8px' }}>
                          {vasp.hops}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', color: vasp.total_eth > 0 ? 'var(--color-primary)' : 'var(--color-text-faint)' }}>
                        {vasp.total_eth.toFixed(6)} ETH
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <Badge level={vasp.risk_level} />
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--color-text-muted)' }}>
                        {isExpanded ? '▲ hide' : `▼ ${vasp.path.length} nodes`}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr style={{ background: 'var(--color-surface-1)' }}>
                        <td colSpan={6} style={{ padding: '10px 16px', borderBottom: '1px solid var(--color-border)' }}>
                          <div style={{ fontSize: '10px', color: 'var(--color-text-faint)', marginBottom: '6px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                            Shortest Path
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                            {vasp.path.map((node, i) => (
                              <React.Fragment key={i}>
                                <code style={{ fontSize: '10px', color: i === 0 ? 'var(--color-secondary-dim)' : i === vasp.path.length - 1 ? 'var(--color-primary)' : 'var(--color-text)', background: 'var(--color-surface-3)', padding: '2px 6px', borderRadius: '3px' }}>
                                  {trunc(node, 16)}
                                </code>
                                {i < vasp.path.length - 1 && <span style={{ color: 'var(--color-text-faint)', fontSize: '12px' }}>→</span>}
                              </React.Fragment>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </PageShell>
  );
}

// ── Layout sub-components ─────────────────────────────────────────────────────

function PageShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ flexShrink: 0, padding: '12px 16px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-2)', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: '13px', color: 'var(--color-text)' }}>{title}</span>
        <span style={{ fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-primary)', background: 'var(--color-primary-container)', border: '1px solid var(--color-primary)', padding: '2px 7px', borderRadius: '999px' }}>{subtitle}</span>
        <span className="status-dot status-dot-active" style={{ marginLeft: 'auto' }} />
      </div>
      {/* Body */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
        {children}
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px', color: 'var(--color-text-faint)', padding: '32px', textAlign: 'center' }}>
      <div style={{ fontSize: '40px' }}>⛓</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', maxWidth: '420px', lineHeight: '1.7' }}>{message}</div>
    </div>
  );
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div style={{ background: 'rgba(212,0,75,0.08)', border: '1px solid rgba(212,0,75,0.3)', borderRadius: '6px', padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
      <span style={{ color: 'var(--color-secondary-dim)', fontSize: '18px' }}>⚠</span>
      <span style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-secondary-dim)' }}>{message}</span>
      <button className="btn btn-secondary" onClick={onRetry}>Retry</button>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div style={{ flex: 1, minWidth: '120px', height: '72px', background: 'var(--color-surface-1)', border: '1px solid var(--color-border)', borderRadius: '6px', animation: 'pulse-green 1.5s ease-in-out infinite' }} />
  );
}

function SkeletonTable({ rows }: { rows: number }) {
  return (
    <div style={{ border: '1px solid var(--color-border)', borderRadius: '6px', overflow: 'hidden' }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ height: '40px', background: i % 2 === 0 ? 'var(--color-surface-1)' : 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)' }} />
      ))}
    </div>
  );
}
