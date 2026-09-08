import React, { useState } from 'react';
import { Copy, CheckCheck, AlertTriangle, Globe, Eye } from 'lucide-react';
import { useStore } from '../../store/useStore';

export function InvestigationBanner() {
  const traceResult = useStore((s) => s.traceResult);
  const result = traceResult;
  const activeCase = useStore((s) => s.activeCase);
  const [copied, setCopied] = useState(false);

  if (!traceResult) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(traceResult.rootAddress).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const riskScore = result.riskScore;
  const riskColor = riskScore >= 80 ? 'var(--color-secondary-dim)' : riskScore >= 50 ? '#f59e0b' : 'var(--color-primary)';

  const stages = [
    { n: '1', label: 'Raw Data Extract', sub: 'ALCH: ETHERSCAN', stat: `1,482 WALLETS\n3,428 ACTIVE EDGES`, ok: true },
    { n: '2', label: 'Neo4j Graph DB', sub: 'GDS LOUVAIN', stat: `1,482 WALLETS\n3,428 ACTIVE EDGES`, ok: true },
    { n: '3', label: 'Heuristic Engine', sub: '90/10 SPLIT POSITIVE\nCASCADE CONFIRMED', stat: '', ok: true },
    { n: '4', label: 'ML Fraud Clusters', sub: `${result.clusters.length} CLUSTERS DETECTED\nGDS JACCARD SIMILARITY`, stat: '', ok: true },
  ];

  return (
    <div style={{
      background: 'var(--color-surface-2)',
      borderBottom: '1px solid var(--color-border)',
      padding: '0.625rem 1rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1.25rem' }}>

        {/* Risk score gauge */}
        <div style={{ flexShrink: 0, textAlign: 'center' }}>
          <svg width="72" height="72" viewBox="0 0 72 72">
            <circle cx="36" cy="36" r="28" fill="none" stroke="var(--color-surface-3)" strokeWidth="6" />
            <circle
              cx="36" cy="36" r="28" fill="none"
              stroke={riskColor}
              strokeWidth="6"
              strokeDasharray={`${(riskScore / 100) * 175.9} 175.9`}
              strokeLinecap="round"
              transform="rotate(-90 36 36)"
            />
            <text x="36" y="33" textAnchor="middle" fill={riskColor} fontFamily="Space Grotesk" fontWeight="800" fontSize="16">{riskScore}</text>
            <text x="36" y="45" textAnchor="middle" fill="var(--color-text-faint)" fontFamily="JetBrains Mono" fontSize="6" letterSpacing="0.08em">RISK</text>
          </svg>
          <div className="label-sm" style={{ color: riskColor, marginTop: '-4px' }}>
            {riskScore >= 80 ? 'CRITICAL' : riskScore >= 50 ? 'ELEVATED' : 'LOW'}
          </div>
        </div>

        {/* Case metadata */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.375rem', flexWrap: 'wrap' }}>
            <div className="label-sm" style={{ color: 'var(--color-text-faint)' }}>CASE ID:</div>
            <span className="code-terminal" style={{ color: 'var(--color-tertiary)', fontWeight: 600 }}>{result.caseId}</span>

            <div style={{ marginLeft: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <span className="code-terminal" style={{ color: 'var(--color-text)', fontSize: '11px' }}>
                {result.rootAddress.slice(0,14)}...{result.rootAddress.slice(-8)}
              </span>
              <button
                id="copy-address-btn"
                onClick={handleCopy}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? 'var(--color-primary)' : 'var(--color-text-faint)', padding: '0' }}
              >
                {copied ? <CheckCheck size={11} /> : <Copy size={11} />}
              </button>
            </div>

            {/* Watchlist badges */}
            {result.watchlists.map((wl) => (
              <span key={wl} className="badge-base badge-secondary">{wl}</span>
            ))}
            <span className="badge-base badge-tertiary">
              <Globe size={8} />{result.jurisdiction}
            </span>
          </div>

          {/* Threat vector */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.375rem', marginBottom: '0.5rem' }}>
            <AlertTriangle size={11} color="var(--color-secondary-dim)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div className="label-sm" style={{ color: 'var(--color-text-faint)' }}>THREAT VECTOR:</div>
            <span className="code-terminal" style={{ color: 'var(--color-text)', lineHeight: '1.4' }}>{result.threatVector}</span>
          </div>

          {/* Pipeline stages */}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {stages.map((s, i) => (
              <div key={i} style={{
                flex: 1, background: 'var(--color-surface-1)', border: '1px solid var(--color-border)',
                borderRadius: '0.25rem', padding: '0.375rem 0.5rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginBottom: '2px' }}>
                  <span className="label-sm" style={{ color: 'var(--color-text-faint)' }}>{s.n}.</span>
                  <span className="label-sm" style={{ color: 'var(--color-text)' }}>{s.label}</span>
                  <span className={`status-dot ${s.ok ? 'status-dot-active' : 'status-dot-warn'}`} style={{ marginLeft: 'auto' }} />
                </div>
                <div className="code-terminal" style={{ color: 'var(--color-text-faint)', whiteSpace: 'pre-line' }}>{s.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

