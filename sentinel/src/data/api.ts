// ─── Sentinel — Mock API layer ────────────────────────────────────────────────
// traceWallet() is the single integration point.
// To connect a real backend: replace the body of this function.
// The return type (TraceResult) is stable — mock and live share the same shape.

import type { TraceResult } from '../types/graph';
import { ALL_TRACES, TRACE_TORNADO_PEEL } from './mockTraces';

// Simulated network latency (ms)
const MOCK_DELAY = 1600;

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/**
 * Trace a wallet address N hops deep.
 * Currently returns mock data — drop in a real fetch() call to wire up the backend.
 *
 * @param address - The root wallet address to trace
 * @param hops    - How many hops out to follow (1–5)
 * @returns       Promise<TraceResult>
 */
export async function traceWallet(address: string, hops: number): Promise<TraceResult> {
  await sleep(MOCK_DELAY);

  // Pick best matching trace from mock data
  const addrLower = address.toLowerCase();

  const exact = ALL_TRACES.find(
    (t) => t.rootAddress.toLowerCase() === addrLower
  );
  if (exact) {
    return trimToHops(exact, hops);
  }

  // Address doesn't exactly match — use first trace as default and swap root address
  const base = JSON.parse(JSON.stringify(TRACE_TORNADO_PEEL)) as TraceResult;
  base.rootAddress = address;
  if (base.nodes.length > 0) {
    base.nodes[0].address = address;
  }
  return trimToHops(base, hops);
}

/**
 * Prune graph data to only include nodes/edges reachable within `hops` depth.
 */
function trimToHops(trace: TraceResult, hops: number): TraceResult {
  const maxHop = Math.max(1, Math.min(hops, 5));
  const cloned = JSON.parse(JSON.stringify(trace)) as TraceResult;

  const validNodes = cloned.nodes.filter((n) => n.hopDepth <= maxHop);
  const validIds = new Set(validNodes.map((n) => n.id));
  const validEdges = cloned.edges.filter(
    (e) => validIds.has(e.source) && validIds.has(e.target)
  );
  const validClusterIds = new Set(validNodes.flatMap((n) => n.clusterIds ?? []));
  const validClusters = cloned.clusters.filter((c) =>
    c.walletIds.some((wid) => validIds.has(wid))
  );
  const validVasps = cloned.vaspMatches.filter((v) => validIds.has(v.nodeId));

  return {
    ...cloned,
    hops: maxHop,
    nodes: validNodes,
    edges: validEdges,
    clusters: validClusters.filter((c) => validClusterIds.has(c.id)),
    vaspMatches: validVasps,
  };
}
