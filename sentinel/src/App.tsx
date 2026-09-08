import React from 'react';
import { useStore } from './store/useStore';
import { Sidebar } from './components/layout/Sidebar';
import { TopHeader } from './components/layout/TopHeader';
import { BottomTicker } from './components/layout/BottomTicker';
import { GraphExplorer } from './pages/GraphExplorer';
import { PeelingHeuristics, FraudRings, VaspOfframps, EvidenceDossier, CypherConsole } from './pages/placeholder';

const PAGES: Record<string, React.ReactNode> = {
  'graph-explorer':      <GraphExplorer />,
  'peeling-heuristics':  <PeelingHeuristics />,
  'fraud-rings':         <FraudRings />,
  'vasp-offramps':       <VaspOfframps />,
  'evidence-dossier':    <EvidenceDossier />,
  'cypher-console':      <CypherConsole />,
};

export default function App() {
  const activePage = useStore((s) => s.activePage);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'var(--spacing-sidebar) minmax(0, 1fr)',
        gridTemplateRows: 'auto 1fr auto',
        height: '100vh',
        overflow: 'hidden',
        background: 'var(--color-base)',
      }}
    >
      {/* Sidebar — spans all rows */}
      <div style={{ gridRow: '1 / 4', gridColumn: '1', borderRight: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Sidebar />
      </div>

      {/* Top header */}
      <div style={{ gridRow: '1', gridColumn: '2', borderBottom: '1px solid var(--color-border)', zIndex: 10, overflow: 'hidden', minWidth: 0 }}>
        <TopHeader />
      </div>

      {/* Main content */}
      <div style={{ gridRow: '2', gridColumn: '2', overflow: 'hidden', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {PAGES[activePage] ?? <GraphExplorer />}
      </div>

      {/* Bottom ticker */}
      <div style={{ gridRow: '3', gridColumn: '2', borderTop: '1px solid var(--color-border)', overflow: 'hidden', minWidth: 0 }}>
        <BottomTicker />
      </div>
    </div>
  );
}