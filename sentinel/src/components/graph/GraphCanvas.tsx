import React, { useRef, useCallback, useEffect, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { useStore } from '../../store/useStore';
import type { FGNode, FGLink, WalletNode, NodeType } from '../../types/graph';

// Node visual config by type
const NODE_CONFIG: Record<NodeType | 'pool', { color: string; size: number; shape: string }> = {
  suspect:      { color: '#ffd700',            size: 10, shape: 'star' },
  intermediate: { color: '#5a6a7a',            size: 6,  shape: 'circle' },
  mixer:        { color: '#d4004b',            size: 9,  shape: 'diamond' },
  sybil:        { color: '#ff6b35',            size: 8,  shape: 'square' },
  vasp:         { color: '#00e55b',            size: 11, shape: 'hexagon' },
  pool:         { color: '#4cd7f6',            size: 7,  shape: 'circle' },
};

const EDGE_COLORS: Record<string, string> = {
  peel:    'rgba(212,0,75,0.85)',
  offramp: 'rgba(0,229,91,0.85)',
  normal:  'rgba(90,106,122,0.6)',
};

function drawNode(ctx: CanvasRenderingContext2D, node: FGNode, globalScale: number, isSelected: boolean) {
  const cfg = NODE_CONFIG[node.type] || NODE_CONFIG.intermediate;
  const r = cfg.size / globalScale;
  const x = node.x ?? 0;
  const y = node.y ?? 0;

  ctx.save();

  // Selection glow
  if (isSelected) {
    ctx.shadowColor = cfg.color;
    ctx.shadowBlur = 16;
  }

  // Flagged pulse ring
  if (node.flagged) {
    ctx.beginPath();
    ctx.arc(x, y, r * 1.5, 0, 2 * Math.PI);
    ctx.strokeStyle = cfg.color + '44';
    ctx.lineWidth = 1.5 / globalScale;
    ctx.stroke();
  }

  ctx.fillStyle = cfg.color;
  ctx.strokeStyle = isSelected ? '#ffffff' : cfg.color + 'cc';
  ctx.lineWidth = isSelected ? 2 / globalScale : 1 / globalScale;

  switch (cfg.shape) {
    case 'diamond': {
      ctx.beginPath();
      ctx.moveTo(x, y - r * 1.2);
      ctx.lineTo(x + r, y);
      ctx.lineTo(x, y + r * 1.2);
      ctx.lineTo(x - r, y);
      ctx.closePath();
      break;
    }
    case 'square': {
      ctx.beginPath();
      ctx.rect(x - r, y - r, r * 2, r * 2);
      break;
    }
    case 'hexagon': {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 6;
        const px = x + r * Math.cos(angle);
        const py = y + r * Math.sin(angle);
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      break;
    }
    case 'star': {
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const angle = (Math.PI / 5) * i - Math.PI / 2;
        const rr = i % 2 === 0 ? r * 1.2 : r * 0.5;
        const px = x + rr * Math.cos(angle);
        const py = y + rr * Math.sin(angle);
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      break;
    }
    default: {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 2 * Math.PI);
    }
  }

  ctx.fill();
  ctx.stroke();

  // Label
  if (globalScale > 0.6) {
    const fontSize = Math.max(8, 10 / globalScale);
    ctx.font = `600 ${fontSize}px JetBrains Mono`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.shadowBlur = 0;
    ctx.fillText(node.label.slice(0, 12), x, y + r + 2 / globalScale);
  }

  ctx.restore();
}

export function GraphCanvas() {
  const traceResult = useStore((s) => s.traceResult);
  const result = traceResult;
  const loading = useStore((s) => s.traceLoading);
  const hops = useStore((s) => s.traceHops);
  const selectedNode = useStore((s) => s.selectedNode);
  const selectNode = useStore((s) => s.selectNode);
  const filterThreats = useStore((s) => s.filterThreats);

  const graphRef = useRef<any>(null);
  const [dims, setDims] = useState({ width: 600, height: 400 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Responsive sizing
  useEffect(() => {
    const obs = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setDims({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  // Build graph data from trace result (respects filterThreats)
  const graphData = React.useMemo(() => {
    if (!result) return { nodes: [], links: [] };

    const nodes: FGNode[] = (filterThreats
      ? result.nodes.filter((n) => n.flagged)
      : result.nodes
    ).map((n) => ({ ...n }));

    const nodeIds = new Set(nodes.map((n) => n.id));

    const links: FGLink[] = result.edges
      .filter((e) => nodeIds.has(e.source as string) && nodeIds.has(e.target as string))
      .map((e) => ({ ...e }));

    return { nodes, links };
  }, [result, filterThreats]);

  const handleNodeClick = useCallback((node: any) => {
    selectNode(node as WalletNode);
  }, [selectNode]);

  const nodeCanvasObject = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    drawNode(ctx, node as FGNode, globalScale, selectedNode?.id === node.id);
  }, [selectedNode]);

  const linkCanvasObject = useCallback((link: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const start = link.source;
    const end = link.target;
    if (!start?.x || !end?.x) return;

    const color = EDGE_COLORS[link.type] ?? EDGE_COLORS.normal;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = (link.type === 'offramp' ? 2.5 : 1.5) / globalScale;
    if (link.type === 'peel') {
      ctx.setLineDash([4 / globalScale, 3 / globalScale]);
    }
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Edge label (amount + %)
    if (globalScale > 0.7) {
      const mx = (start.x + end.x) / 2;
      const my = (start.y + end.y) / 2;
      const fontSize = Math.max(7, 9 / globalScale);
      ctx.font = `${fontSize}px JetBrains Mono`;
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${link.amount.toFixed(1)} ETH (${link.percent}%)`, mx, my - 4 / globalScale);
    }
    ctx.restore();
  }, []);

  const handleReCenter = () => {
    graphRef.current?.zoomToFit(400, 60);
  };

  return (
   <div
      ref={containerRef}
      className="graph-canvas-wrap"
      style={{
        position: 'absolute',
        inset: 0,
      }}>
      {/* Loading overlay */}
      {loading && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 20,
          background: 'rgba(11,15,18,0.8)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem',
        }}>
          <svg width="48" height="48" viewBox="0 0 48 48">
            <circle cx="24" cy="24" r="20" fill="none" stroke="var(--color-surface-3)" strokeWidth="3" />
            <circle cx="24" cy="24" r="20" fill="none" stroke="var(--color-primary)" strokeWidth="3"
              strokeDasharray="31 95" strokeLinecap="round">
              <animateTransform attributeName="transform" type="rotate" from="0 24 24" to="360 24 24" dur="0.9s" repeatCount="indefinite" />
            </circle>
          </svg>
          <div className="headline-sm" style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-sans)' }}>TRACING WALLET...</div>
          <div className="code-terminal" style={{ color: 'var(--color-text-faint)' }}>Expanding graph {useStore.getState().traceHops} hops</div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !result && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 10,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
        }}>
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
            <circle cx="32" cy="32" r="28" stroke="var(--color-surface-4)" strokeWidth="1.5" strokeDasharray="4 4" />
            <circle cx="32" cy="32" r="8" fill="var(--color-surface-3)" stroke="var(--color-surface-4)" strokeWidth="1" />
            <circle cx="32" cy="16" r="3" fill="var(--color-surface-4)" />
            <circle cx="32" cy="48" r="3" fill="var(--color-surface-4)" />
            <circle cx="16" cy="32" r="3" fill="var(--color-surface-4)" />
            <circle cx="48" cy="32" r="3" fill="var(--color-surface-4)" />
          </svg>
          <div className="headline-sm" style={{ color: 'var(--color-text-faint)', fontFamily: 'var(--font-sans)' }}>NO ACTIVE TRACE</div>
          <div className="code-terminal" style={{ color: 'var(--color-text-faint)', textAlign: 'center' }}>
            Enter a wallet address above<br />and click TRACE WALLET to begin
          </div>
        </div>
      )}

      {/* Force Graph */}
      {result && !loading && (
        <ForceGraph2D
          ref={graphRef}
          graphData={graphData}
          width={dims.width}
          height={dims.height}
          backgroundColor="transparent"
          nodeCanvasObject={nodeCanvasObject}
          nodeCanvasObjectMode={() => 'replace'}
          linkCanvasObject={linkCanvasObject}
          linkCanvasObjectMode={() => 'replace'}
          onNodeClick={handleNodeClick}
          nodeLabel={(n: any) => `${n.label}\n${n.address}\nRisk: ${n.riskScore}`}
          cooldownTime={3000}
          linkDirectionalArrowLength={5}
          linkDirectionalArrowRelPos={0.85}
          linkDirectionalArrowColor={(l: any) => EDGE_COLORS[l.type] ?? EDGE_COLORS.normal}
        />
      )}

      {/* Controls overlay */}
      <div style={{
        position: 'absolute', bottom: '0.75rem', right: '0.75rem',
        display: 'flex', gap: '0.25rem', zIndex: 15,
      }}>
        <button
          id="recenter-graph-btn"
          className="btn btn-ghost"
          onClick={handleReCenter}
          style={{ padding: '0.25rem 0.5rem', fontSize: '9px' }}
          disabled={!result}
        >
          ⊕ RE-CENTER
        </button>
      </div>

      {/* Coordinates display */}
      {result && (
        <div style={{
          position: 'absolute', bottom: '0.75rem', left: '0.75rem', zIndex: 15,
        }}>
          <span className="code-terminal" style={{ color: 'var(--color-text-faint)' }}>
            NODES: {graphData.nodes.length} | EDGES: {graphData.links.length}
            {filterThreats ? ' | FILTER: THREATS ONLY' : ''}
          </span>
        </div>
      )}
    </div>
  );
}

