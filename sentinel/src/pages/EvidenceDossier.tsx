import React, { useState } from 'react';
import { useStore } from '../store/useStore';

const API = 'http://127.0.0.1:8000';

// ── Types ─────────────────────────────────────────────────────────────────────

type DossierStatus = 'idle' | 'generating' | 'done' | 'error';

// ── Sub-components ─────────────────────────────────────────────────────────────

function Field({
  label, value, mono = false, highlight = false,
}: { label: string; value: string; mono?: boolean; highlight?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-text-faint)' }}>
        {label}
      </span>
      <span style={{
        fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)',
        fontSize: mono ? '10px' : '12px',
        color: highlight ? 'var(--color-tertiary)' : 'var(--color-text)',
        fontWeight: highlight ? 600 : 400,
        wordBreak: 'break-all',
      }}>
        {value}
      </span>
    </div>
  );
}

function SectionRow({ icon, label, value, color = 'var(--color-text-muted)' }: { icon: string; label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderBottom: '1px solid var(--color-border)' }}>
      <span style={{ fontSize: '14px', minWidth: '20px', textAlign: 'center' }}>{icon}</span>
      <span style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-text-muted)' }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color, fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function GenerateButton({ status, onClick }: { status: DossierStatus; onClick: () => void }) {
  const busy = status === 'generating';
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="btn btn-primary"
      style={{ width: '100%', padding: '14px 24px', fontSize: '12px', justifyContent: 'center', gap: '10px', letterSpacing: '0.08em', boxShadow: busy ? 'none' : '0 0 18px rgba(0,229,91,0.25)' }}
    >
      {busy ? (
        <>
          <SpinnerIcon />
          COMPILING DOSSIER...
        </>
      ) : (
        <>
          <span style={{ fontSize: '16px' }}>📄</span>
          GENERATE &amp; DOWNLOAD PDF DOSSIER
        </>
      )}
    </button>
  );
}

function SpinnerIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
      style={{ animation: 'spin 0.8s linear infinite' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

// ── Preview card ──────────────────────────────────────────────────────────────

function PreviewCard({
  address, caseId, officerName, caseNotes,
}: { address: string; caseId: string; officerName: string; caseNotes: string }) {
  const trunc = (s: string, n = 24) => s.length > n ? s.slice(0, 10) + '…' + s.slice(-8) : s;
  return (
    <div style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)', borderRadius: '6px', overflow: 'hidden' }}>
      {/* header */}
      <div style={{ background: 'var(--color-surface-2)', padding: '10px 14px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-text-faint)' }}>PDF PREVIEW — SECTION 94 BNSS NOTICE</span>
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--color-primary)' }}>
          GOVERNMENT OF INDIA · I4C · MHA
        </span>
      </div>

      {/* content */}
      <div style={{ padding: '14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        <Field label="Case ID"            value={caseId}            />
        <Field label="Investigating Officer" value={officerName || '—'} />
        <Field label="Suspect Wallet"     value={trunc(address, 28)} mono highlight />
        <Field label="Date"               value={new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} />
        {caseNotes && (
          <div style={{ gridColumn: '1 / -1' }}>
            <Field label="Case Notes" value={caseNotes} />
          </div>
        )}
      </div>

      <div style={{ borderTop: '1px solid var(--color-border)' }}>
        <SectionRow icon="2️⃣" label="Transaction Trace (up to 5 hops)"   value="Compiled from Neo4j" />
        <SectionRow icon="3️⃣" label="VASP Offramp Destinations"          value="BFS + Dijkstra scan" />
        <SectionRow icon="4️⃣" label="Heuristic Flags (Peel + Velocity)"  value="NetworkX analysis" />
        <SectionRow icon="🔏" label="Chain-of-Custody Hash (SHA-256)"    value="Auto-generated" color="var(--color-primary)" />
      </div>
    </div>
  );
}

// ── Input field helper ─────────────────────────────────────────────────────────

function LabelledInput({
  label, value, onChange, placeholder, multiline = false,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; multiline?: boolean;
}) {
  const sharedStyle: React.CSSProperties = {
    width: '100%',
    background: 'var(--color-surface-1)',
    border: '1px solid var(--color-border)',
    borderRadius: '4px',
    color: 'var(--color-text)',
    fontFamily: 'var(--font-mono)',
    fontSize: '11px',
    padding: '8px 10px',
    outline: 'none',
    resize: 'vertical',
    boxSizing: 'border-box',
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      <label style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-text-faint)' }}>
        {label}
      </label>
      {multiline ? (
        <textarea rows={3} style={sharedStyle} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input style={sharedStyle} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function EvidenceDossier() {
  const traceAddress = useStore((s) => s.traceAddress);
  const activeCase   = useStore((s) => s.activeCase);

  const [officerName, setOfficerName] = useState('');
  const [caseNotes,   setCaseNotes]   = useState('');
  const [status,      setStatus]      = useState<DossierStatus>('idle');
  const [errorMsg,    setErrorMsg]    = useState<string | null>(null);
  const [lastFilename, setLastFilename] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!traceAddress) return;
    setStatus('generating');
    setErrorMsg(null);

    try {
      const res = await fetch(`${API}/generate-dossier`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address:      traceAddress,
          case_id:      activeCase.id,
          officer_name: officerName || 'Investigating Officer',
          case_notes:   caseNotes,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Server error ${res.status}: ${text.slice(0, 120)}`);
      }

      // Trigger browser download from response blob
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      const filename = `dossier_${activeCase.id.replace(/\s/g, '_')}.pdf`;
      a.href     = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setLastFilename(filename);
      setStatus('done');
    } catch (e: any) {
      setErrorMsg(e.message ?? 'Unknown error');
      setStatus('error');
    }
  };

  // ── Awaiting target ──────────────────────────────────────────────────────
  if (!traceAddress) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px', color: 'var(--color-text-faint)', padding: '32px', textAlign: 'center' }}>
        <div style={{ fontSize: '48px' }}>📄</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', maxWidth: '420px', lineHeight: '1.7' }}>
          No active trace. Run a wallet trace from the Graph Explorer first, then return here to generate the evidence dossier.
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div style={{ flexShrink: 0, padding: '12px 16px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-2)', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: '13px', color: 'var(--color-text)' }}>
          EVIDENCE DOSSIER
        </span>
        <span style={{ fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-tertiary)', background: 'rgba(76,215,246,0.08)', border: '1px solid rgba(76,215,246,0.3)', padding: '2px 7px', borderRadius: '999px' }}>
          SEC 94 BNSS · AUTOMATED REPORT
        </span>
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-text-faint)' }}>
          {activeCase.id} · OP {activeCase.operation}
        </span>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* ── Active case banner ────────────────────────────────────────── */}
        <div style={{ background: 'rgba(0,229,91,0.04)', border: '1px solid rgba(0,229,91,0.2)', borderRadius: '6px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span className="status-dot status-dot-active" />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-text-muted)' }}>
            Active Case:
          </span>
          <code style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-primary)', fontWeight: 600 }}>
            {activeCase.id}
          </code>
          <span style={{ color: 'var(--color-text-faint)', fontSize: '10px' }}>·</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-text-muted)' }}>
            Operation <strong>{activeCase.operation}</strong>
          </span>
          <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-text-faint)' }}>
            Wallet: <code style={{ color: 'var(--color-tertiary)' }}>{traceAddress.slice(0, 10)}…{traceAddress.slice(-6)}</code>
          </span>
        </div>

        {/* ── Form inputs ───────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <LabelledInput
            label="Investigating Officer Name"
            value={officerName}
            onChange={setOfficerName}
            placeholder="e.g., Inspector R. Sharma"
          />
          <LabelledInput
            label="Case Notes (Optional)"
            value={caseNotes}
            onChange={setCaseNotes}
            placeholder="Brief context for the report..."
            multiline
          />
        </div>

        {/* ── PDF preview card ──────────────────────────────────────────── */}
        <PreviewCard
          address={traceAddress}
          caseId={activeCase.id}
          officerName={officerName || 'Investigating Officer'}
          caseNotes={caseNotes}
        />

        {/* ── Status message ────────────────────────────────────────────── */}
        {status === 'done' && lastFilename && (
          <div style={{ background: 'rgba(0,229,91,0.06)', border: '1px solid rgba(0,229,91,0.25)', borderRadius: '6px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
            <span style={{ fontSize: '16px' }}>✓</span>
            <span style={{ color: 'var(--color-primary)' }}>
              Dossier compiled and downloaded as <strong>{lastFilename}</strong>
            </span>
          </div>
        )}

        {status === 'error' && errorMsg && (
          <div style={{ background: 'rgba(212,0,75,0.08)', border: '1px solid rgba(212,0,75,0.3)', borderRadius: '6px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
            <span style={{ color: 'var(--color-secondary-dim)', fontSize: '16px' }}>⚠</span>
            <span style={{ color: 'var(--color-secondary-dim)' }}>{errorMsg}</span>
          </div>
        )}

        {/* ── CTA button ────────────────────────────────────────────────── */}
        <GenerateButton status={status} onClick={handleGenerate} />

        {/* ── Legal disclaimer ──────────────────────────────────────────── */}
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--color-text-faint)', lineHeight: '1.6', textAlign: 'center', padding: '4px 8px' }}>
          This auto-generated report is intended for use by authorised law enforcement personnel under Section 94 BNSS (formerly Section 91 CrPC).
          Chain-of-custody hash is embedded in the PDF footer. Data sourced exclusively from the live Neo4j forensic graph.
        </div>

      </div>
    </div>
  );
}
