import React from 'react';
import { FileText, Code, Lock, AlertTriangle, Clock, Wallet, ExternalLink } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { PeelRatioChart } from './PeelRatioChart';

export function InspectorDossier() {
  const selectedNode = useStore((s) => s.selectedNode);
  const traceResult = useStore((s) => s.traceResult);
  const result = traceResult;

  const riskColor = (score: number | undefined) => {
    const s = score ?? 0;
    return s >= 80 ? 'var(--color-secondary-dim)' :
           s >= 50 ? '#f59e0b' :
           'var(--color-primary)';
  };

  // Find cluster membership
  const nodeClusters = result?.clusters.filter(
    (c) => selectedNode && c.walletIds.includes(selectedNode.id)
  ) ?? [];

  // Find VASP match
  const vaspMatch = result?.vaspMatches.find((v) => v.nodeId === selectedNode?.id);

  // Get peel chain
  const hasPeel = selectedNode?.type === 'suspect' || selectedNode?.type === 'intermediate';
  const peelHops = hasPeel ? (result?.peelChain ?? []) : [];

  return (
    <div className="panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', minWidth: 0 }}>
      <div className="panel-header">
        <Wallet size={11} color="var(--color-primary)" />
        <span className="label-md" style={{ color: 'var(--color-text)' }}>INSPECTOR</span>
        {selectedNode && (
          <span className="badge-base badge-primary" style={{ marginLeft: 'auto' }}>PRIMARY NODE</span>
        )}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '0.625rem' }}>
        {!selectedNode ? (
          <div style={{ textAlign: 'center', paddingTop: '2rem' }}>
            <div style={{ color: 'var(--color-text-faint)', marginBottom: '0.5rem' }}>
              <Wallet size={24} color="var(--color-surface-4)" />
            </div>
            <div className="body-sm" style={{ color: 'var(--color-text-faint)' }}>
              Click a node in the graph<br />to inspect its details
            </div>
          </div>
        ) : (
          <>
            {/* Address block */}
            <div style={{ marginBottom: '0.75rem', padding: '0.5rem', background: 'var(--color-surface-2)', borderRadius: '0.25rem', border: '1px solid var(--color-border)' }}>
              <div className="label-sm" style={{ color: 'var(--color-text-faint)', marginBottom: '2px' }}>TARGET WALLET</div>
              <div className="code-terminal" style={{ color: 'var(--color-tertiary)', wordBreak: 'break-all', fontSize: '10px' }}>
                {selectedNode.address || selectedNode.id || 'Unknown'}
              </div>
              {selectedNode.ensName && (
                <div className="code-terminal" style={{ color: 'var(--color-primary)', marginTop: '2px' }}>
                  {selectedNode.ensName}
                </div>
              )}
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.375rem' }}>
                <span className="badge-base badge-neutral">{selectedNode.chain || 'ETH'}</span>
                <span className="badge-base" style={{
                  background: riskColor(selectedNode.riskScore) + '22',
                  color: riskColor(selectedNode.riskScore),
                  border: `1px solid ${riskColor(selectedNode.riskScore)}`,
                }}>
                  RISK {selectedNode.riskScore ?? 0}
                </span>
                {selectedNode.flagged && (
                  <span className="badge-base badge-secondary">
                    <AlertTriangle size={8} /> FLAGGED
                  </span>
                )}
              </div>
            </div>

            {/* Node metadata */}
            <div style={{ marginBottom: '0.75rem' }}>
              <MetaRow label="RESOLUTION" value={`dep:pool.ramnaeth`} />
              <MetaRow label="FIRST SEEN" value={selectedNode.firstSeen ? new Date(selectedNode.firstSeen).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }) + ' UTC' : '—'} />
              <MetaRow label="LAST ACTIVE" value={selectedNode.lastActive ? timeSince(selectedNode.lastActive) : '—'} highlight />
              <MetaRow label="HOLDINGS" value={`${(selectedNode.balance ?? 0).toFixed(2)} ETH ($${(selectedNode.balanceUsd ?? 0).toLocaleString()})`} />
              <MetaRow label="TX COUNT" value={(selectedNode.txCount ?? 0).toLocaleString()} />
              <MetaRow label="HOP DEPTH" value={`${selectedNode.hopDepth ?? 0}`} />
            </div>

            {/* Peel ratio */}
            {peelHops.length > 0 && (
              <div style={{ marginBottom: '0.75rem', padding: '0.5rem', background: 'var(--color-surface-2)', borderRadius: '0.25rem', border: '1px solid var(--color-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span className="label-sm" style={{ color: 'var(--color-text-faint)' }}>RULE 90/10 PEEL RATIO</span>
                  <span className="badge-base badge-secondary">96.7% MATCH</span>
                </div>
                <div className="code-terminal" style={{ color: 'var(--color-text-faint)', marginBottom: '0.375rem' }}>
                  Automated peel chain: 90% retained in storage address, 10% routed to intermediaries for off-ramping.
                </div>
                <PeelRatioChart hops={peelHops} />
              </div>
            )}

            {/* Cluster membership */}
            {nodeClusters.length > 0 && (
              <div style={{ marginBottom: '0.75rem', padding: '0.5rem', background: 'rgba(76,215,246,0.05)', borderRadius: '0.25rem', border: '1px solid rgba(76,215,246,0.2)' }}>
                <div className="label-sm" style={{ color: 'var(--color-tertiary)', marginBottom: '0.375rem' }}>ML CLUSTER DETAILS</div>
                {nodeClusters.map((c) => (
                  <div key={c.id} className="code-terminal" style={{ color: 'var(--color-text-faint)', marginBottom: '2px' }}>
                    Target linked to {c.name} via correlated mempool hash (std dev &lt; 0.2σ) across {c.walletCount} distinct addresses.
                  </div>
                ))}
              </div>
            )}

            {/* VASP match */}
            {vaspMatch && (
              <div style={{ marginBottom: '0.75rem', padding: '0.5rem', background: 'rgba(0,229,91,0.05)', borderRadius: '0.25rem', border: '1px solid rgba(0,229,91,0.2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span className="label-sm" style={{ color: 'var(--color-primary)' }}>VASP IDENTIFIED</span>
                  <span className="badge-base badge-primary">{vaspMatch.confidence}% CONF</span>
                </div>
                <MetaRow label="EXCHANGE" value={vaspMatch.exchange} />
                <MetaRow label="JURISDICTION" value={vaspMatch.jurisdiction} />
                <MetaRow label="ML LABEL" value={vaspMatch.mlLabel} />
                {vaspMatch.frozen && <span className="badge-base badge-secondary"><Lock size={8} /> FROZEN — {vaspMatch.freezeAuthority}</span>}
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', marginBottom: '0.75rem' }}>
              <button id="generate-pdf-btn" className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center', opacity: 0.5 }} disabled title="PDF generation coming soon">
                <FileText size={10} /> GENERATE PDF DOSSIER
              </button>
              <div style={{ display: 'flex', gap: '0.375rem' }}>
                <button id="export-cypher-btn" className="btn btn-tertiary" style={{ flex: 1, justifyContent: 'center', opacity: 0.5 }} disabled title="Cypher export coming soon">
                  <Code size={10} /> EXPORT CYPHER
                </button>
                <button id="freeze-vasp-btn" className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center', opacity: 0.5 }} disabled title="Requires VASP liaison integration">
                  <Lock size={10} /> FREEZE VASP
                </button>
              </div>
            </div>

            {/* Chain of custody */}
            {result && (
              <div style={{ padding: '0.5rem', background: 'var(--color-lowest)', borderRadius: '0.25rem', border: '1px solid var(--color-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span className="label-sm" style={{ color: 'var(--color-text-faint)' }}>EVIDENCE CHAIN OF CUSTODY</span>
                  <span className="badge-base badge-primary">
                    ECRIA<br />VERIFIED
                  </span>
                </div>
                <div className="code-terminal" style={{ color: 'var(--color-text-faint)', wordBreak: 'break-all', fontSize: '9px', lineHeight: '1.5' }}>
                  {result.chainOfCustodyHash}
                </div>
                <div className="code-terminal" style={{ color: 'var(--color-text-faint)', marginTop: '4px' }}>
                  SIGNED BY AGENT: #{result.caseId} | {new Date().toLocaleDateString('en-GB')}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function MetaRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px', gap: '0.5rem' }}>
      <span className="label-sm" style={{ color: 'var(--color-text-faint)', flexShrink: 0 }}>{label}</span>
      <span className="code-terminal" style={{ color: highlight ? '#f59e0b' : 'var(--color-text)', textAlign: 'right', fontSize: '10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{value}</span>
    </div>
  );
}

function timeSince(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes} MINS AGO`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}H AGO`;
  return `${Math.floor(hours / 24)}D AGO`;
}

