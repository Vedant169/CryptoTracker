import React, { useEffect } from 'react';
import { InvestigationBanner } from '../components/summary/InvestigationBanner';
import { BottomSummaryStrip } from '../components/summary/BottomSummaryStrip';
// We are replacing GraphCanvas with the Neovis container directly
// import { GraphCanvas } from '../components/graph/GraphCanvas'; 
import { GraphControls } from '../components/graph/GraphControls';
import { SystemHealthPanel } from '../components/panels/SystemHealthPanel';
import { InspectorDossier } from '../components/panels/InspectorDossier';
import { useStore } from '../store/useStore';

export function GraphExplorer() {
  const traceResult = useStore((s) => s.traceResult);
  const result = traceResult;

  // Initialize the Neo4j Graph
  useEffect(() => {
    // @ts-ignore
    const NeoVis = window.NeoVis;

    if (!NeoVis) {
      console.error("Neovis library not found. Make sure it's in index.html.");
      return;
    }

    const config = {
      containerId: "neo4j-viz",
      neo4j: {
        serverUrl: "bolt://localhost:7687", 
        serverUser: "neo4j",
        serverPassword: "Ved@1609", 
      },
      labels: {
        // Targets the exact label from your image
        "SmartContract": { 
          caption: "eth_address", // Tells Neovis to display this property's text
          color: "#B584D7",       // A purple hex code to match your Neo4j browser
          size: 25
        }
        
        // Note: If you also have nodes for regular users/wallets (like the pink ones 
        // in your earlier screenshot), you can add a second block right here like this:
        //
        // "Wallet": {
        //   caption: "eth_address",
        //   color: "#ECA5C8", // Pink
        //   size: 25
        // }
      },
      relationships: {
        "TO": {
          caption: true,
          thickness: 2
        }
      },
      initialCypher: "MATCH (n)-[r]->(m) RETURN n, r, m LIMIT 100"
    };
    const viz = new NeoVis.default(config);
    viz.render();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Investigation banner */}
      <div style={{ flexShrink: 0, overflow: 'hidden' }}>
        {result && <InvestigationBanner />}
      </div>

      {/* Main workspace grid */}
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

          {/* Controls bar */}
          <div style={{ flexShrink: 0, overflow: 'hidden' }}>
            <GraphControls />
          </div>

          {/* System health */}
          <div style={{ flexShrink: 0, overflow: 'hidden' }}>
            <SystemHealthPanel />
          </div>

          {/* Graph Canvas — Neovis goes here and takes all remaining vertical space */}
          <div style={{ flex: 1, minHeight: 0, minWidth: 0, overflow: 'hidden', position: 'relative' }}>
            {/* The Neo4j container fills the parent div completely */}
            <div id="neo4j-viz" style={{ width: '100%', height: '100%', outline: 'none' }}></div>
          </div>

          {/* Bottom strip */}
          <div style={{ flexShrink: 0, overflow: 'hidden' }}>
            <BottomSummaryStrip />
          </div>
        </div>

        {/* ── Right rail: Inspector dossier ──────── */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          minHeight: 0,
        }}>
          <InspectorDossier />
        </div>

      </div>
    </div>
  );
}