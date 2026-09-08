import React, { useEffect, useState, useCallback } from 'react';
import { useStore } from '../store/useStore';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PeelFlag {
  address:     string;
  peel_ratio:  number;
  vasp_ratio:  number;
  peel_target: string;
  severity:    'CRITICAL' | 'CONFIRMED' | 'FLAGGED' | 'SUSPECTED';
}

interface VelocityFlag {
  address:      string;
  hold_seconds: number;
  amount_eth:   number;
  severity:     'CRITICAL' | 'FLAGGED';
}

interface HeuristicsData {
  peel_flags:     PeelFlag[];
  velocity_flags: VelocityFlag[];
  total_peel:     number;
  total_velocity: number;
  error?:         string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const API = 'http://127.0.0.1:8000';

const SEV_COLOR: Record<string, string> = {
  CRITICAL:  'var(--color-secondary-dim)',
  CONFIRMED: '#f59e0b',
  FLAGGED:   'var(--color-tertiary)',
  SUSPECTED: 'var(--color-text-muted)',
};
const SEV_BG: Record<string, string> = {
  CRITICAL:  'rgba(212,0,75,0.12)',
  CONFIRMED: 'rgba(245,158,11,0.1)',
  FLAGGED:   'rgba(76,215,246,0.08)',
  SUSPECTED: 'var(--color-surface-3)',
};

function SeverityBadge({ level }: { level: string }) {
  return (
    <span style={{
      color: SEV_COLOR[level] ?? 'var(--color-text-muted)',
      background: SEV_BG[level] ?? 'var(--color-surface-3)',
      border: `1px solid ${SEV_COLOR[level] ?? 'var(--color-border)'}`,
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

function trunc(s: string, n = 18) {
  return s.length > n ? s.slice(0, 8) + '…' + s.slice(-6) : s;
}

/** Stacked ratio bar using existing .peel-bar-* CSS classes */
function PeelBar({ peel, vasp }: { peel: number; vasp: number }) {
  const store = Math.max(0, 100 - peel - vasp);
  return (
    <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
      <div className="peel-bar-wrap" style={{ flex: 1, height: '8px', borderRadius: '2px', overflow: 'hidden', display: 'flex' }}>
        {store > 0 && <div className="peel-bar-store" style={{ width: `${store}%` }} title={`Retained: ${store.toFixed(1)}%`} />}
        {vasp > 0  && <div style={{ width: `${vasp}%`, background: 'var(--color-tertiary)', flexShrink: 0 }} title={`VASP: ${vasp.toFixed(1)}%`} />}
        <div className="peel-bar-peel" style={{ width: `${peel}%` }} title={`Peeled: ${peel.toFixed(1)}%`} />
      </div>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-secondary-dim)', marginLeft: '6px', minWidth: '38px' }}>
        {peel.toFixed(0)}%
      </span>
    </div>
  );
}

/** Hold time display with colour coding */
function HoldTime({ seconds }: { seconds: number }) {
  const color = seconds < 30 ? 'var(--color-secondary-dim)' : seconds < 60 ? '#f59e0b' : 'var(--color-tertiary)';
  return (
    <span style={{ fontFamily: 'var(--font-mono)', color, fontWeight: 600, fontSize: '11px' }}>
      {seconds < 60
        ? `${seconds.toFixed(1)}s`
        : `${(seconds / 60).toFixed(1)}m`}
    </span>
  );
}

// ── Section wrappers ──────────────────────────────────────────────────────────

function SectionHeader({ icon, label, count, color = 'var(--color-primary)' }: { icon: string; label: string; count: number; color?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
      <span style={{ fontSize: '14px' }}>{icon}</span>
      <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: '12px', color: 'var(--color-text)' }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color, background: 'var(--color-surface-3)', border: `1px solid ${color}`, borderRadius: '999px', padding: '1px 8px' }}>
        {count} flag{count !== 1 ? 's' : ''}
      </span>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function PeelingHeuristics() {
  const traceAddress = useStore((s) => s.traceAddress);
  const [data, setData]       = useState<HeuristicsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const fetchFlags = useCallback(async (addr: string) => {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch(`${API}/peeling-heuristics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: addr }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: HeuristicsData = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (e: any) {
      setError(e.message ?? 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (traceAddress) fetchFlags(traceAddress);
  }, [traceAddress, fetchFlags]);

  const totalFlags = (data?.total_peel ?? 0) + (data?.total_velocity ?? 0);

  // ── Awaiting target ──────────────────────────────────────────────────────
  if (!traceAddress) return (
    <EmptyState message="No active trace. Run a wallet trace from the Graph Explorer to run peeling analysis." />
  );

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div style={{ flexShrink: 0, padding: '12px 16px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-2)', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: '13px', color: 'var(--color-text)' }}>
          PEELING HEURISTICS ENGINE
        </span>
        <span style={{ fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-secondary-dim)', background: 'var(--color-secondary-container)', border: '1px solid var(--color-secondary)', padding: '2px 7px', borderRadius: '999px' }}>
          90/10 SPLIT · VELOCITY
        </span>
        {!loading && data && (
          <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: '10px', color: totalFlags > 0 ? 'var(--color-secondary-dim)' : 'var(--color-primary)' }}>
            {totalFlags > 0 ? `⚠ ${totalFlags} HIGH-RISK FLAG${totalFlags !== 1 ? 'S' : ''}` : '✓ CLEAN'}
          </span>
        )}
        <button className="btn btn-ghost" style={{ marginLeft: data ? '8px' : 'auto' }} onClick={() => fetchFlags(traceAddress)}>
          ↻
        </button>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <SkeletonSection rows={3} />
            <SkeletonSection rows={2} />
          </div>
        )}

        {error && (
          <div style={{ background: 'rgba(212,0,75,0.08)', border: '1px solid rgba(212,0,75,0.3)', borderRadius: '6px', padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ color: 'var(--color-secondary-dim)', fontSize: '18px' }}>⚠</span>
            <span style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-secondary-dim)' }}>{error}</span>
            <button className="btn btn-secondary" onClick={() => fetchFlags(traceAddress)}>Retry</button>
          </div>
        )}

        {data && !loading && (
          <>
            {/* ─── Section A: 90/10 Split Flags ─────────────────────────── */}
            <section>
              <SectionHeader
                icon="⚡"
                label="90/10 VOLUME SPLIT FLAGS"
                count={data.total_peel}
                color="var(--color-secondary-dim)"
              />
              <div style={{ fontSize: '10px', color: 'var(--color-text-faint)', marginBottom: '10px', lineHeight: '1.6' }}>
                Wallets where &gt;90% of incoming volume flows to a single fresh address (peel chain indicator) and &lt;10% reaches a VASP.
              </div>

              {data.peel_flags.length === 0 ? (
                <EmptySection label="No 90/10 split anomalies detected in this subgraph." />
              ) : (
                <div style={{ overflow: 'auto', border: '1px solid var(--color-border)', borderRadius: '6px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                    <thead>
                      <tr style={{ background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)' }}>
                        {['Wallet Address', 'Peel Ratio', 'VASP Ratio', 'Peel Target', 'Severity'].map((h) => (
                          <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-text-faint)', fontWeight: 600 }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.peel_flags.map((flag, i) => (
                        <tr key={flag.address} style={{ borderBottom: '1px solid var(--color-border)', background: i % 2 === 0 ? 'transparent' : 'var(--color-surface-1)' }}>
                          <td style={{ padding: '10px 12px' }}>
                            <code style={{ fontSize: '10px', color: 'var(--color-tertiary)' }}>{trunc(flag.address, 22)}</code>
                          </td>
                          <td style={{ padding: '10px 12px', minWidth: '160px' }}>
                            <PeelBar peel={flag.peel_ratio} vasp={flag.vasp_ratio} />
                          </td>
                          <td style={{ padding: '10px 12px', color: 'var(--color-text-muted)' }}>
                            {flag.vasp_ratio.toFixed(1)}%
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <code style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{trunc(flag.peel_target, 20)}</code>
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <SeverityBadge level={flag.severity} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* ─── Section B: Velocity Flags ─────────────────────────────── */}
            <section>
              <SectionHeader
                icon="⚡"
                label="HIGH-VELOCITY FORWARDING FLAGS"
                count={data.total_velocity}
                color="var(--color-tertiary)"
              />
              <div style={{ fontSize: '10px', color: 'var(--color-text-faint)', marginBottom: '10px', lineHeight: '1.6' }}>
                Wallets that received funds and forwarded them within &lt;3 minutes — characteristic of automated laundering bots and zero-hold mixers.
              </div>

              {data.velocity_flags.length === 0 ? (
                <EmptySection label="No high-velocity forwarding behaviour detected." />
              ) : (
                <div style={{ overflow: 'auto', border: '1px solid var(--color-border)', borderRadius: '6px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                    <thead>
                      <tr style={{ background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)' }}>
                        {['Wallet Address', 'Hold Time', 'ETH Forwarded', 'Severity'].map((h) => (
                          <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-text-faint)', fontWeight: 600 }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.velocity_flags.map((flag, i) => (
                        <tr key={flag.address} style={{ borderBottom: '1px solid var(--color-border)', background: i % 2 === 0 ? 'transparent' : 'var(--color-surface-1)' }}>
                          <td style={{ padding: '10px 12px' }}>
                            <code style={{ fontSize: '10px', color: 'var(--color-tertiary)' }}>{trunc(flag.address, 22)}</code>
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <HoldTime seconds={flag.hold_seconds} />
                          </td>
                          <td style={{ padding: '10px 12px', color: 'var(--color-primary)', fontWeight: 600 }}>
                            {flag.amount_eth.toFixed(6)} ETH
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <SeverityBadge level={flag.severity} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px', color: 'var(--color-text-faint)', padding: '32px', textAlign: 'center' }}>
      <div style={{ fontSize: '40px' }}>🔍</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', maxWidth: '420px', lineHeight: '1.7' }}>{message}</div>
    </div>
  );
}

function EmptySection({ label }: { label: string }) {
  return (
    <div style={{ padding: '20px', border: '1px solid var(--color-border)', borderRadius: '6px', background: 'var(--color-surface-1)', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--color-primary)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
      <span>✓</span> {label}
    </div>
  );
}

function SkeletonSection({ rows }: { rows: number }) {
  return (
    <div style={{ border: '1px solid var(--color-border)', borderRadius: '6px', overflow: 'hidden' }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ height: '40px', background: i % 2 === 0 ? 'var(--color-surface-1)' : 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)' }} />
      ))}
    </div>
  );
}
