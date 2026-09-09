import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { useStore } from '../../store/useStore';
import type { FGNode, FGLink, WalletNode, NodeType } from '../../types/graph';

const NODE_CONFIG: Record<NodeType | 'pool', { color: string; size: number; shape: string }> = {
  suspect: { color: '#ffd700', size: 10, shape: 'star' },
  intermediate: { color: '#5a6a7a', size: 6, shape: 'circle' },
  mixer: { color: '#d4004b', size: 9, shape: 'diamond' },
  sybil: { color: '#ff6b35', size: 8, shape: 'square' },
  vasp: { color: '#00e55b', size: 11, shape: 'hexagon' },
  pool: { color: '#4cd7f6', size: 7, shape: 'circle' },
};

const EDGE_COLORS: Record<string, string> = {
  peel: 'rgba(212,0,75,0.85)',
  offramp: 'rgba(0,229,91,0.85)',
  normal: 'rgba(90,106,122,0.6)',
};

function drawNode(ctx: CanvasRenderingContext2D, node: FGNode, globalScale: number, isSelected: boolean) {
  const cfg = NODE_CONFIG[node.type] || NODE_CONFIG.intermediate;
  const r = cfg.size / globalScale;
  const x = node.x ?? 0;
  const y = node.y ?? 0;

  ctx.save();
  ctx.fillStyle = cfg.color;
  ctx.strokeStyle = isSelected ? '#ffffff' : cfg.color + 'cc';
  ctx.lineWidth = isSelected ? 2 / globalScale : 1 / globalScale;

  ctx.beginPath();
  ctx.arc(x, y, r, 0, 2 * Math.PI);
  ctx.fill();
  ctx.stroke();

  // Highlight Labels
  if (globalScale > 0.6 && node.label) {
    const fontSize = Math.max(5, 8 / globalScale);
    ctx.font = `600 ${fontSize}px JetBrains Mono`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(node.label.slice(0, 12) + "...", x, y + r + 2 / globalScale);
  }
  ctx.restore();
}

export function GraphCanvas() {
  const traceResult = useStore((s) => s.traceResult);
  const loading = useStore((s) => s.traceLoading);
  const selectedNode = useStore((s) => s.selectedNode);
  const selectNode = useStore((s) => s.selectNode);

  const graphRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 800, height: 600 });

  useEffect(() => {
    const obs = new ResizeObserver((entries) => {
      if (entries[0]) {
        setDims({ width: entries[0].contentRect.width, height: entries[0].contentRect.height });
      }
    });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  // 🔥 DEEP CLONE FIX: To unfreeze Zustand data for D3 physics engine
  const graphData = useMemo(() => {
    if (!traceResult || !traceResult.nodes || !traceResult.edges) {
      return { nodes: [], links: [] };
    }

    const rawNodes = JSON.parse(JSON.stringify(traceResult.nodes));
    const rawEdges = JSON.parse(JSON.stringify(traceResult.edges));

    const nodes = rawNodes.map((n: any) => ({
      ...n,
      id: String(n.id),
      label: n.data?.label || n.label || 'Unknown',
      type: n.type || 'intermediate'
    }));

    const nodeIds = new Set(nodes.map((n: any) => n.id));

    const links = rawEdges.map((e: any) => ({
      ...e,
      source: String(e.source),
      target: String(e.target)
    })).filter((e: any) => nodeIds.has(e.source) && nodeIds.has(e.target));

    return { nodes, links };
  }, [traceResult]);

  const handleNodeClick = useCallback((node: any) => {
    selectNode(node as WalletNode);
  }, [selectNode]);

  const nodeCanvasObject = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    drawNode(ctx, node as FGNode, globalScale, selectedNode?.id === node.id);
  }, [selectedNode]);

  const linkCanvasObject = useCallback((link: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const start = link.source;
    const end = link.target;
    if (!start || !end || typeof start.x !== 'number' || typeof end.x !== 'number') return;

    const color = EDGE_COLORS[link.type] ?? EDGE_COLORS.normal;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5 / globalScale;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();

    if (globalScale > 0.8) {
      const mx = (start.x + end.x) / 2;
      const my = (start.y + end.y) / 2;
      const fontSize = Math.max(4, 6 / globalScale);
      ctx.font = `${fontSize}px JetBrains Mono`;
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const amountTxt = link.amount ? `${Number(link.amount).toFixed(1)} ETH` : 'Tx';
      ctx.fillText(amountTxt, mx, my - 4 / globalScale);
    }
    ctx.restore();
  }, []);

  const handleReCenter = () => {
    graphRef.current?.zoomToFit(400, 60);
  };

  return (
    <div ref={containerRef} style={{ position: 'absolute', inset: 0 }}>
      {loading && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 20, background: 'rgba(11,15,18,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="headline-sm" style={{ color: 'var(--color-primary)' }}>TRACING WALLET...</div>
        </div>
      )}

      {!loading && graphData.nodes.length === 0 && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="headline-sm" style={{ color: 'var(--color-text-faint)' }}>NO ACTIVE TRACE</div>
        </div>
      )}

      {!loading && graphData.nodes.length > 0 && (
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
          cooldownTime={3000}
          linkDirectionalArrowLength={5}
          linkDirectionalArrowRelPos={0.85}
          linkDirectionalArrowColor={(l: any) => EDGE_COLORS[l.type] ?? EDGE_COLORS.normal}
        />
      )}

      <div style={{ position: 'absolute', bottom: '0.75rem', right: '0.75rem', zIndex: 15 }}>
        <button className="btn btn-ghost" onClick={handleReCenter} disabled={graphData.nodes.length === 0}>⊕ RE-CENTER</button>
      </div>

      <div style={{ position: 'absolute', bottom: '0.75rem', left: '0.75rem', zIndex: 15 }}>
        <span className="code-terminal" style={{ color: 'var(--color-text-faint)' }}>
          NODES: {graphData.nodes.length} | EDGES: {graphData.links.length}
        </span>
      </div>
    </div>
  );
}