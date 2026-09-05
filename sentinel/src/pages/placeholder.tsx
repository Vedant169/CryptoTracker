import React from 'react';
// Panels import kar rahe hain jo humne GraphExplorer se hataye the
import { TerminalPanel } from '../components/panels/TerminalPanel';
import { MlClusterPanel } from '../components/panels/MlClusterPanel';

// 1. Cypher Console Page (Terminal yahan aayega)
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

// 2. Fraud Rings & ML Page (ML Cluster yahan aayega)
export function FraudRings() {
  return (
    <div style={{ height: '100%', padding: '1rem', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <h2 style={{ color: 'var(--color-text)', marginBottom: '1rem', fontFamily: 'var(--font-sans)' }}>
        Fraud Rings & ML Clustering Engine
      </h2>
      <div style={{ flex: 1, minHeight: 0, border: '1px solid var(--color-border)', borderRadius: '4px', overflow: 'hidden' }}>
        <MlClusterPanel />
      </div>
    </div>
  );
}

// Baaki ke bache hue khali pages (Jab tak tum inko build nahi karte)
export function PeelingHeuristics() { 
  return <div style={{ padding: '2rem', color: 'var(--color-text-faint)' }}>Peeling Heuristics Module - Coming Soon</div>; 
}

export function VaspOfframps() { 
  return <div style={{ padding: '2rem', color: 'var(--color-text-faint)' }}>VASP Offramps Module - Coming Soon</div>; 
}

export function EvidenceDossier() { 
  return <div style={{ padding: '2rem', color: 'var(--color-text-faint)' }}>Evidence Dossier Module - Coming Soon</div>; 
}