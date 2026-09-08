import React from 'react';
import {
  Network, Layers, Share2, Building2, FileText, Terminal,
  Shield, Activity, ChevronRight,
} from 'lucide-react';
import { useStore, type Page } from '../../store/useStore';

interface NavItem {
  id: Page;
  label: string;
  sublabel: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'graph-explorer',     label: 'Graph Explorer',      sublabel: 'TOPOLOGY',    icon: <Network size={14} /> },
  { id: 'peeling-heuristics', label: 'Peeling Heuristics',  sublabel: 'DSA',         icon: <Layers size={14} /> },
  { id: 'fraud-rings',        label: 'Fraud Rings & ML',    sublabel: 'CLUSTERING',  icon: <Share2 size={14} /> },
  { id: 'vasp-offramps',      label: 'VASP Offramps',       sublabel: 'EXCHANGE',    icon: <Building2 size={14} /> },
  { id: 'evidence-dossier',   label: 'Evidence Dossier',    sublabel: 'LEGAL',       icon: <FileText size={14} /> },
  { id: 'cypher-console',     label: 'Cypher Console',      sublabel: 'NEO4J',       icon: <Terminal size={14} /> },
];

export function Sidebar() {
  const activePage = useStore((s) => s.activePage);
  const setActivePage = useStore((s) => s.setActivePage);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--color-surface-1)' }}>
      {/* ── Logo ────────────────────────────────────────────────────────────── */}
      <div style={{ padding: '1rem 1rem 0.75rem', borderBottom: '1px solid var(--color-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
          <Shield size={18} color="var(--color-primary)" />
          <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: '15px', color: 'var(--color-primary)', letterSpacing: '0.08em' }}>
            SENTINEL
          </span>
        </div>
        <div style={{ paddingLeft: '1.625rem' }}>
          <div className="label-sm" style={{ color: 'var(--color-text-faint)' }}>GRAPH</div>
          <div className="label-sm" style={{ color: 'var(--color-text-faint)' }}>FORENSICS</div>
        </div>
      </div>

      {/* ── Section label ──────────────────────────────────────────────────── */}
      <div style={{ padding: '0.75rem 1rem 0.375rem' }}>
        <span className="label-sm" style={{ color: 'var(--color-text-faint)' }}>ANALYSIS SUITE</span>
      </div>

      {/* ── Nav items ──────────────────────────────────────────────────────── */}
      <nav style={{ flex: 1, overflow: 'auto', padding: '0 0.5rem' }}>
        {NAV_ITEMS.map((item) => {
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              id={`nav-${item.id}`}
              onClick={() => setActivePage(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.625rem',
                width: '100%',
                padding: '0.5rem 0.625rem',
                marginBottom: '2px',
                borderRadius: '0.25rem',
                border: 'none',
                borderLeft: isActive ? '2px solid var(--color-primary)' : '2px solid transparent',
                background: isActive ? 'rgba(0,229,91,0.07)' : 'transparent',
                color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.12s ease',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-surface-3)';
                  (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                  (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-muted)';
                }
              }}
            >
              <span style={{ flexShrink: 0 }}>{item.icon}</span>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div className="body-sm" style={{ fontWeight: isActive ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.label}
                </div>
                <div className="label-sm" style={{ color: isActive ? 'var(--color-primary-dim)' : 'var(--color-text-faint)', opacity: 0.8 }}>
                  {item.sublabel}
                </div>
              </div>
              {isActive && <ChevronRight size={10} />}
            </button>
          );
        })}
      </nav>

      {/* ── System status card ─────────────────────────────────────────────── */}
      <div style={{ padding: '0.75rem', borderTop: '1px solid var(--color-border)' }}>
        <div className="panel" style={{ padding: '0.625rem 0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.5rem' }}>
            <Activity size={10} color="var(--color-primary)" />
            <span className="label-sm" style={{ color: 'var(--color-text-faint)' }}>GDS CLUSTER</span>
            <span className="badge-base badge-primary" style={{ marginLeft: 'auto', fontSize: '8px' }}>SYNC</span>
          </div>

          <StatusRow label="GDS" value="SYNCHRONISED" ok />
          <StatusRow label="INGEST" value="42,338 TX/S" ok />

          <div style={{ marginTop: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
              <span className="label-sm" style={{ color: 'var(--color-text-faint)' }}>MEMPOOL FILL</span>
              <span className="label-sm" style={{ color: 'var(--color-primary)' }}>73%</span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: '73%' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusRow({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
      <span className="label-sm" style={{ color: 'var(--color-text-faint)' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
        <span className={`status-dot ${ok ? 'status-dot-active' : 'status-dot-error'}`} />
        <span className="code-terminal" style={{ color: ok ? 'var(--color-primary)' : 'var(--color-secondary-dim)' }}>{value}</span>
      </div>
    </div>
  );
}
