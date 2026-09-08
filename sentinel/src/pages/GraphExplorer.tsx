import React from 'react';
import { InvestigationBanner } from '../components/summary/InvestigationBanner';
import { BottomSummaryStrip } from '../components/summary/BottomSummaryStrip';
import { GraphCanvas } from '../components/graph/GraphCanvas';
import { GraphControls } from '../components/graph/GraphControls';
import { SystemHealthPanel } from '../components/panels/SystemHealthPanel';
import { InspectorDossier } from '../components/panels/InspectorDossier';
import { useStore } from '../store/useStore';

export function GraphExplorer() {
  const traceResult = useStore((s) => s.traceResult);
  const result = traceResult;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Investigation banner — flexShrink:0 so it never steals space from canvas */}
      <div style={{ flexShrink: 0, overflow: 'hidden' }}>
        {result && <InvestigationBanner />}
      </div>

      {/* Main workspace grid — minmax(0,1fr) is the key: forces left column to shrink */}
      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 280px',
        minHeight: 0,
        overflow: 'hidden',
      }}>

        {/* ── Left/Center: Graph canvas ─────────────────────────────────── */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          minWidth: 0,
          minHeight: 0,
          borderRight: '1px solid var(--color-border)',
        }}>

          {/* Controls bar — overflow:hidden prevents legend items from pushing width */}
          <div style={{ flexShrink: 0, overflow: 'hidden' }}>
            <GraphControls />
          </div>

          {/* System health — compact strip below controls */}
          <div style={{ flexShrink: 0, overflow: 'hidden' }}>
            <SystemHealthPanel />
          </div>

          {/* Graph Canvas — takes all remaining vertical space */}
          <div style={{ flex: 1, minHeight: 0, minWidth: 0, overflow: 'hidden', position: 'relative' }}>
            <GraphCanvas />
          </div>

          {/* Bottom strip — only renders when trace result exists */}
          <div style={{ flexShrink: 0, overflow: 'hidden' }}>
            <BottomSummaryStrip />
          </div>
        </div>

        {/* ── Right rail: Inspector dossier (fixed 280px via grid) ──────── */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          minHeight: 0,
        }}>
          {/* Scrollable content lives inside InspectorDossier itself */}
          <InspectorDossier />
        </div>

      </div>
    </div>
  );
}