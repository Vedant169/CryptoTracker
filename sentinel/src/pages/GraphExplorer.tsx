import React, { useEffect, useRef, useState, useCallback } from 'react';
import { InvestigationBanner } from '../components/summary/InvestigationBanner';
import { BottomSummaryStrip } from '../components/summary/BottomSummaryStrip';
import { GraphControls } from '../components/graph/GraphControls';
import { SystemHealthPanel } from '../components/panels/SystemHealthPanel';
import { InspectorDossier } from '../components/panels/InspectorDossier';
import { useStore } from '../store/useStore';
import { Play, RotateCcw, Terminal } from 'lucide-react';

// Declare NeoVis on the window object for TypeScript
declare global {
  interface Window {
    NeoVis: any;
  }
}

const DEFAULT_CYPHER = 'MATCH (n)-[r]->(m) RETURN n, r, m LIMIT 100';

export function GraphExplorer() {
  const traceResult = useStore((s) => s.traceResult);
  const selectNode = useStore((s) => s.selectNode);
  const result = traceResult;

  // ── Viz instance ref (persists across renders) ─────────────────────────────
  const vizRef = useRef<any>(null);

  // ── Cypher query state ─────────────────────────────────────────────────────
  const [cypherQuery, setCypherQuery] = useState(DEFAULT_CYPHER);
  const [isQueryPanelOpen, setIsQueryPanelOpen] = useState(false);
  const [vizStatus, setVizStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [vizError, setVizError] = useState<string | null>(null);

  // ── Selected node properties (raw from Neo4j) ─────────────────────────────
  const [rawNodeProps, setRawNodeProps] = useState<Record<string, any> | null>(null);

  // ── Initialize NeoVis ──────────────────────────────────────────────────────
  useEffect(() => {
    const NeoVis = window.NeoVis;

    if (!NeoVis) {
      console.error("NeoVis library not found. Make sure neovis.js is loaded in index.html.");
      setVizStatus('error');
      setVizError('NeoVis library not loaded. Check index.html.');
      return;
    }

    setVizStatus('loading');

    const config = {
      containerId: "neo4j-viz",
      neo4j: {
        serverUrl: "bolt://localhost:7687",
        serverUser: "neo4j",
        serverPassword: "Saksham123!",
      },
      visConfig: {
        nodes: {
          shape: 'dot',
          font: {
            color: '#e1e2e7',
            size: 11,
            face: 'JetBrains Mono',
            strokeWidth: 2,
            strokeColor: '#111417',
          },
          borderWidth: 2,
          shadow: {
            enabled: true,
            color: 'rgba(0,229,91,0.15)',
            size: 8,
          },
        },
        edges: {
          arrows: { to: { enabled: true, scaleFactor: 0.6 } },
          color: {
            color: '#3a3d42',
            highlight: '#00e55b',
            hover: '#4cd7f6',
          },
          font: {
            color: '#849581',
            size: 9,
            face: 'JetBrains Mono',
            strokeWidth: 2,
            strokeColor: '#111417',
          },
          smooth: {
            enabled: true,
            type: 'continuous',
          },
        },
        physics: {
          enabled: true,
          barnesHut: {
            gravitationalConstant: -8000,
            centralGravity: 0.3,
            springLength: 120,
            springConstant: 0.04,
            damping: 0.09,
          },
          stabilization: {
            enabled: true,
            iterations: 200,
          },
        },
        interaction: {
          hover: true,
          tooltipDelay: 200,
          dragNodes: true,
          dragView: true,
          zoomView: true,
          navigationButtons: false,
        },
        layout: {
          improvedLayout: true,
          randomSeed: 42,
        },
      },
      labels: {
        SmartContract: {
          caption: "eth_address",
          size: "pagerank",
          community: "community",
          color: '#B584D7',
          font: { size: 11 },
        },
        Wallet: {
          caption: "eth_address",
          size: 25,
          color: '#4cd7f6',
          font: { size: 11 },
        },
        Address: {
          caption: "address",
          size: 25,
          color: '#00e55b',
          font: { size: 11 },
        },
      },
      relationships: {
        TO: {
          caption: true,
          thickness: "weight",
          color: '#3a3d42',
        },
        SENT: {
          caption: true,
          thickness: 2,
          color: '#3a3d42',
        },
        RECEIVED: {
          caption: true,
          thickness: 2,
          color: '#3a3d42',
        },
      },
      initialCypher: DEFAULT_CYPHER,
    };

    try {
      const viz = new NeoVis.default(config);

      // ── Register clickNode event for sidebar properties ──────────────────
      viz.registerOnEvent('clickNode', (event: any) => {
        if (!event || !event.node) return;

        const nodeId = event.nodeId;
        const networkNode = viz._network?.body?.data?.nodes?.get(nodeId);

        // Try to get raw properties from the NeoVis internal data
        let rawProps: Record<string, any> = {};
        let nodeLabel = '';

        if (networkNode) {
          rawProps = networkNode.raw?.properties || networkNode.properties || {};
          nodeLabel = networkNode.raw?.labels?.[0] || networkNode.label || '';
        }

        // Also try the event node data
        if (Object.keys(rawProps).length === 0 && event.node?.properties) {
          rawProps = event.node.properties;
        }

        setRawNodeProps(rawProps);

        // Build a WalletNode-compatible object for the store
        const address = rawProps.eth_address || rawProps.address || rawProps.name || String(nodeId);
        selectNode({
          id: String(nodeId),
          address: address,
          label: address,
          type: 'intermediate',
          riskScore: rawProps.risk_score ?? rawProps.riskScore ?? 0,
          balance: rawProps.balance ?? 0,
          balanceUsd: rawProps.balance_usd ?? rawProps.balanceUsd ?? 0,
          firstSeen: rawProps.first_seen ?? rawProps.firstSeen ?? new Date().toISOString(),
          lastActive: rawProps.last_active ?? rawProps.lastActive ?? new Date().toISOString(),
          ensName: rawProps.ens_name ?? rawProps.ensName,
          txCount: rawProps.tx_count ?? rawProps.txCount ?? 0,
          hopDepth: rawProps.hop_depth ?? rawProps.hopDepth ?? 0,
          flagged: rawProps.flagged ?? false,
          chain: rawProps.chain ?? 'ETH',
          clusterIds: rawProps.cluster_ids ?? [],
        });
      });

      // ── Mark as ready when rendering completes ───────────────────────────
      viz.registerOnEvent('completed', () => {
        setVizStatus('ready');
        setVizError(null);
      });

      viz.render();
      vizRef.current = viz;
    } catch (err) {
      console.error('NeoVis initialization failed:', err);
      setVizStatus('error');
      setVizError(String(err));
    }

    // Cleanup on unmount
    return () => {
      if (vizRef.current) {
        try {
          vizRef.current.clearNetwork();
        } catch (_) { /* ignore */ }
        vizRef.current = null;
      }
    };
  }, [selectNode]);

  // ── Run custom Cypher query ────────────────────────────────────────────────
  const handleRunCypher = useCallback(() => {
    if (!vizRef.current) {
      setVizError('Graph not initialized. Wait for connection.');
      return;
    }
    const query = cypherQuery.trim();
    if (!query) return;

    setVizStatus('loading');
    setVizError(null);
    setRawNodeProps(null);
    selectNode(null);

    try {
      vizRef.current.renderWithCypher(query);
    } catch (err) {
      setVizStatus('error');
      setVizError(String(err));
    }
  }, [cypherQuery, selectNode]);

  // ── Reset to default query ─────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    setCypherQuery(DEFAULT_CYPHER);
    setRawNodeProps(null);
    selectNode(null);

    if (vizRef.current) {
      setVizStatus('loading');
      vizRef.current.renderWithCypher(DEFAULT_CYPHER);
    }
  }, [selectNode]);

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
        gridTemplateColumns: 'minmax(0, 1fr) 300px',
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

          {/* ── Cypher Query Control Bar ─────────────────────────────────── */}
          <div style={{
            flexShrink: 0,
            borderBottom: '1px solid var(--color-border)',
            background: 'var(--color-surface-1)',
          }}>
            {/* Toggle bar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.375rem 0.75rem',
            }}>
              <Terminal size={11} color="var(--color-tertiary)" />
              <button
                id="toggle-cypher-panel-btn"
                className="btn btn-ghost"
                onClick={() => setIsQueryPanelOpen(!isQueryPanelOpen)}
                style={{ fontSize: '9px', padding: '0.25rem 0.5rem' }}
              >
                {isQueryPanelOpen ? '▼ HIDE CYPHER' : '▶ CYPHER QUERY'}
              </button>

              {/* Status indicator */}
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <span className={`status-dot ${
                  vizStatus === 'ready' ? 'status-dot-active' :
                  vizStatus === 'loading' ? 'status-dot-warn' :
                  vizStatus === 'error' ? 'status-dot-error' :
                  ''
                }`} />
                <span className="label-sm" style={{ color: 'var(--color-text-faint)' }}>
                  {vizStatus === 'ready' ? 'CONNECTED' :
                   vizStatus === 'loading' ? 'LOADING...' :
                   vizStatus === 'error' ? 'ERROR' :
                   'IDLE'}
                </span>
              </div>
            </div>

            {/* Expandable Cypher input panel */}
            {isQueryPanelOpen && (
              <div style={{
                padding: '0 0.75rem 0.5rem',
                display: 'flex',
                gap: '0.5rem',
                alignItems: 'flex-end',
              }}>
                <textarea
                  id="cypher-input"
                  value={cypherQuery}
                  onChange={(e) => setCypherQuery(e.target.value)}
                  placeholder="Enter Cypher query..."
                  spellCheck={false}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      handleRunCypher();
                    }
                  }}
                  style={{
                    flex: 1,
                    minHeight: '52px',
                    maxHeight: '120px',
                    resize: 'vertical',
                    background: 'var(--color-lowest)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '0.25rem',
                    padding: '0.5rem',
                    color: 'var(--color-tertiary)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                    lineHeight: '1.5',
                    outline: 'none',
                  }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <button
                    id="run-cypher-btn"
                    className="btn btn-primary"
                    onClick={handleRunCypher}
                    disabled={vizStatus === 'loading'}
                    title="Run Cypher (Cmd+Enter)"
                    style={{ padding: '0.375rem 0.75rem' }}
                  >
                    <Play size={10} /> EXECUTE
                  </button>
                  <button
                    id="reset-cypher-btn"
                    className="btn btn-ghost"
                    onClick={handleReset}
                    disabled={vizStatus === 'loading'}
                    title="Reset to default query"
                    style={{ padding: '0.375rem 0.75rem' }}
                  >
                    <RotateCcw size={10} /> RESET
                  </button>
                </div>
              </div>
            )}

            {/* Error display */}
            {vizError && (
              <div style={{
                padding: '0.25rem 0.75rem 0.375rem',
                color: 'var(--color-secondary-dim)',
                fontSize: '10px',
                fontFamily: 'var(--font-mono)',
              }}>
                ⚠ {vizError}
              </div>
            )}
          </div>

          {/* System health */}
          <div style={{ flexShrink: 0, overflow: 'hidden' }}>
            <SystemHealthPanel />
          </div>

          {/* Graph Canvas — NeoVis renders here and takes all remaining space */}
          <div className="graph-canvas-wrap" style={{ flex: 1, minHeight: 0, minWidth: 0, position: 'relative' }}>
            {/* NeoVis container */}
            <div
              id="neo4j-viz"
              style={{
                width: '100%',
                height: '100%',
                outline: 'none',
                background: 'radial-gradient(ellipse at 50% 50%, #14191e 0%, #0b0f12 80%)',
              }}
            />

            {/* Loading overlay */}
            {vizStatus === 'loading' && (
              <div style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(11,15,18,0.7)',
                backdropFilter: 'blur(2px)',
                zIndex: 10,
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    border: '3px solid var(--color-surface-4)',
                    borderTop: '3px solid var(--color-primary)',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                    margin: '0 auto 0.5rem',
                  }} />
                  <span className="label-sm" style={{ color: 'var(--color-text-faint)' }}>
                    RENDERING GRAPH...
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Bottom strip */}
          <div style={{ flexShrink: 0, overflow: 'hidden' }}>
            <BottomSummaryStrip />
          </div>
        </div>

        {/* ── Right rail: Sidebar ────────────────────────────────────────── */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          minHeight: 0,
        }}>
          {/* Raw Neo4j properties panel (shown when a node is clicked) */}
          {rawNodeProps && Object.keys(rawNodeProps).length > 0 && (
            <div className="panel" style={{ flexShrink: 0, margin: '0.375rem', overflow: 'auto', maxHeight: '220px' }}>
              <div className="panel-header">
                <span className="label-md" style={{ color: 'var(--color-tertiary)' }}>
                  NODE PROPERTIES
                </span>
                <button
                  className="btn btn-ghost"
                  onClick={() => setRawNodeProps(null)}
                  style={{ marginLeft: 'auto', padding: '0.125rem 0.375rem', fontSize: '9px' }}
                >
                  ✕
                </button>
              </div>
              <div style={{ padding: '0.5rem' }}>
                {Object.entries(rawNodeProps).map(([key, value]) => (
                  <div key={key} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '0.5rem',
                    marginBottom: '3px',
                    borderBottom: '1px solid var(--color-border)',
                    paddingBottom: '3px',
                  }}>
                    <span className="label-sm" style={{
                      color: 'var(--color-text-faint)',
                      flexShrink: 0,
                    }}>
                      {String(key).toUpperCase()}
                    </span>
                    <span className="code-terminal" style={{
                      color: 'var(--color-text)',
                      textAlign: 'right',
                      fontSize: '10px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      minWidth: 0,
                    }}>
                      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Inspector dossier (existing component) */}
          <InspectorDossier />
        </div>

      </div>
    </div>
  );
}