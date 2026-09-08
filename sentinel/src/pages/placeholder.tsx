import React from 'react';
// Panels used by the two existing pages
import { TerminalPanel } from '../components/panels/TerminalPanel';
import { MlClusterPanel } from '../components/panels/MlClusterPanel';

// ── Re-export fully-built modules from their own files ────────────────────────
export { PeelingHeuristics } from './PeelingHeuristics';
export { VaspOfframps }      from './VaspOfframps';
export { EvidenceDossier }   from './EvidenceDossier';

// ── Cypher Console ────────────────────────────────────────────────────────────
export function CypherConsole() {
  return (
    <div style={{ height: '100%', padding: '1rem', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <h2 style={{ color: 'var(--color-text)', marginBottom: '1rem', fontFamily: 'var(--font-sans)' }}>
        &gt;_ NEO4J CYPHER CONSOLE
      </h2>
      <div style={{ flex: 1, minHeight: 0, border: '1px solid var(--color-border)', borderRadius: '4px', overflow: 'hidden' }}>
        <TerminalPanel />
      </div>
    </div>
  );
}

// ── Fraud Rings & ML ──────────────────────────────────────────────────────────
export function FraudRings() {
  return (
    <div style={{ height: '100%', padding: '1rem', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <h2 style={{ color: 'var(--color-text)', marginBottom: '1rem', fontFamily: 'var(--font-sans)' }}>
        Fraud Rings &amp; ML Clustering Engine
      </h2>
      <div style={{ flex: 1, minHeight: 0, border: '1px solid var(--color-border)', borderRadius: '4px', overflow: 'hidden' }}>
        <MlClusterPanel />
      </div>
    </div>
  );
}