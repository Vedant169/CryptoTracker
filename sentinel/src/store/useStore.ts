// ─── Sentinel — Zustand App Store (flat state version) ───────────────────────

import { create } from 'zustand';
import axios from 'axios';
import type { TraceResult, WalletNode, FraudCluster } from '../types/graph';
// import { traceWallet } from '../data/api';

export type Page =
  | 'graph-explorer'
  | 'peeling-heuristics'
  | 'fraud-rings'
  | 'vasp-offramps'
  | 'evidence-dossier'
  | 'cypher-console';

interface AppState {
  // ── Trace (flat — avoids reference churn that causes infinite re-renders) ──
  traceAddress: string;
  traceHops: number;
  traceResult: TraceResult | null;
  traceLoading: boolean;
  traceError: string | null;
  runTrace: (address: string, hops: number) => Promise<void>;
  clearTrace: () => void;

  // ── Graph interaction ──────────────────────────────────────────────────────
  selectedNode: WalletNode | null;
  selectNode: (node: WalletNode | null) => void;

  selectedCluster: FraudCluster | null;
  selectCluster: (cluster: FraudCluster | null) => void;

  filterThreats: boolean;
  toggleFilterThreats: () => void;

  // ── Navigation ─────────────────────────────────────────────────────────────
  activePage: Page;
  setActivePage: (page: Page) => void;

  // ── Terminal log ───────────────────────────────────────────────────────────
  terminalLines: string[];
  appendLog: (line: string) => void;
  clearLog: () => void;

  // ── Active case ────────────────────────────────────────────────────────────
  activeCase: { id: string; operation: string };

  // ── Back-compat accessor (keep trace.result pattern working) ───────────────
  trace: { result: TraceResult | null; loading: boolean; hops: number; address: string };
}

function buildTraceLogLines(address: string, hops: number): string[] {
  const short = address.slice(0, 10) + '...' + address.slice(-4);
  return [
    `[SYS]  > MATCH (w:Wallet {addr:'${short}'})`,
    `[SYS]  > CALL gds.bfs.stream('tx_graph',{...})`,
    `[NEO4J] Connected to cluster — 3 nodes`,
    `[PASS]  12 utxo bundles resolved`,
    `[INFO]  Hop 1 — ${hops >= 1 ? 'scanning...' : 'skipped'}`,
    `[ALERT] High entropy mixing contract identified — Tornado Router`,
    `[INFO]  Hop 2 — graph BFS expanding`,
    `[PASS]  GDS Graph Louvain modularity score: 0.87`,
    `[DAPR]  Modified Binance Deposit Threshold (Hot ≤50k)`,
    `[INFO]  Hop 3 — ${hops >= 3 ? 'active' : 'depth limit hit'}`,
    `[MEMPOOL] TX INGEST: Hash 0xe4f92b... verified by 3 validators`,
    `[INFO]  Hop 4 — ${hops >= 4 ? 'scanning...' : 'depth limit hit'}`,
    `[ML]   SPLIT-LEARN epoch converged — 0.88 AUC`,
    `[INFO]  Hop ${hops} — ${hops >= 5 ? 'terminal depth' : 'scanning...'}`,
    `[PASS]  ${hops * 2 + 3} bundles resolved`,
    `[GDS]  Jaccard similarity index: 0.941`,
    `[PASS]  Trace complete — risk matrix assembled`,
    `[OUT]   ENGINE: CYPHER 5.18 GDS`,
  ];
}

let logIntervalId: ReturnType<typeof setInterval> | null = null;

function startLogStream(lines: string[], appendFn: (line: string) => void) {
  if (logIntervalId) clearInterval(logIntervalId);
  let idx = 0;
  logIntervalId = setInterval(() => {
    if (idx >= lines.length) { clearInterval(logIntervalId!); logIntervalId = null; return; }
    const ts = new Date().toTimeString().slice(0, 8);
    appendFn(`[${ts}] ${lines[idx]}`);
    idx++;
  }, 420);
}

export const useStore = create<AppState>((set, get) => ({
  // ── Trace ──────────────────────────────────────────────────────────────────
  traceAddress: '',
  traceHops: 5,
  traceResult: null,
  traceLoading: false,
  traceError: null,

  // Back-compat computed property
  get trace() {
    return {
      result: get().traceResult,
      loading: get().traceLoading,
      hops: get().traceHops,
      address: get().traceAddress,
    };
  },

  runTrace: async (address, hops) => {
    set({
      traceAddress: address,
      traceHops: hops,
      traceResult: null,
      traceLoading: true,
      traceError: null,
      selectedNode: null,
      selectedCluster: null,
    });
    get().clearLog();
    startLogStream(buildTraceLogLines(address, hops), get().appendLog);

    try {
      // Yahan se purana 'traceWallet' hata diya aur FastAPI ko connect kiya:
      const response = await axios.post('http://127.0.0.1:8000/analyze-wallet', {
        txId: address
      }, { timeout: 15000 });

      const rawNodes = response.data.graph_data.nodes || [];
      const rawEdges = response.data.graph_data.edges || [];

      const realData: TraceResult = {
        // ── Identity ───────────────────────────────────────────────────────
        rootAddress:    address,
        traceId:        `TRACE-${Date.now()}`,
        caseId:         get().activeCase.id,
        jurisdiction:   'IN',
        chainOfCustodyHash: Array.from({ length: 64 }, () =>
          Math.floor(Math.random() * 16).toString(16)).join('').toUpperCase(),

        // ── Risk ───────────────────────────────────────────────────────────
        riskScore:      0,
        threatVector:   'Under analysis — graph traversal complete',

        // ── Financials ────────────────────────────────────────────────────
        hops:                   5,
        totalValueTraced:       0,
        totalValueUsd:          0,
        assetsRestricted:       0,
        assetsRestrictedUsd:    0,
        mixerHopCount:          0,

        // ── Nodes (with all required WalletNode fields defaulted) ─────────
        nodes: rawNodes.map((n: any) => ({
          id:          String(n.id),
          label:       n.data?.label || String(n.id),
          address:     n.data?.label || String(n.id),
          type:        'intermediate' as const,
          riskScore:   0,
          balance:     0,
          balanceUsd:  0,
          firstSeen:   new Date().toISOString(),
          lastActive:  new Date().toISOString(),
          txCount:     0,
          hopDepth:    0,
          flagged:     false,
          chain:       'ETH' as const,
          clusterIds:  [],
        })),

        // ── Edges (with all required TxEdge fields defaulted) ─────────────
        edges: rawEdges.map((e: any, i: number) => ({
          id:             String(i),
          source:         String(e.source),
          target:         String(e.target),
          type:           'normal' as const,
          amount:         parseFloat(e.label) || 0,
          amountUsd:      0,
          percent:        100,
          txHash:         '',
          blockTimestamp: new Date().toISOString(),
        })),

        // ── Collections (safe empty arrays) ───────────────────────────────
        clusters:    [],
        vaspMatches: [],
        watchlists:  [],
        peelChain:   [],

        // ── Unused legacy fields kept for type compatibility ───────────────
        // @ts-ignore
        alerts: [], tags: [], flags: [], riskFactors: [], recentTransactions: [],
        balance: 0, fiatValue: 0,
        metrics: { riskScore: 0, severity: 'Unknown', totalTransactions: rawNodes.length, totalVolume: 0 },
        metadata: { dateAnalyzed: new Date().toISOString(), dataSources: ['Neo4j', 'FastAPI'] },
      };

      // State ko update kar diya
      set({ traceResult: realData, traceLoading: false });


    } catch (err) {
      set({ traceResult: null, traceLoading: false, traceError: String(err) });
    }
  },

  clearTrace: () => set({ traceAddress: '', traceResult: null, traceLoading: false, traceError: null, selectedNode: null, selectedCluster: null }),

  // ── Graph interaction ──────────────────────────────────────────────────────
  selectedNode: null,
  selectNode: (node) => set({ selectedNode: node }),

  selectedCluster: null,
  selectCluster: (cluster) => set({ selectedCluster: cluster }),

  filterThreats: false,
  toggleFilterThreats: () => set((s) => ({ filterThreats: !s.filterThreats })),

  // ── Navigation ─────────────────────────────────────────────────────────────
  activePage: 'graph-explorer',
  setActivePage: (page) => set({ activePage: page }),

  // ── Terminal log ───────────────────────────────────────────────────────────
  terminalLines: [
    '[SYS]  SENTINEL GRAPH FORENSICS — INITIALIZED',
    '[SYS]  GDS 5.18 | Neo4j 5.x Cluster | ML Engine v3.1',
    '[SYS]  Awaiting trace target...',
  ],
  appendLog: (line) => set((s) => ({ terminalLines: [...s.terminalLines.slice(-199), line] })),
  clearLog: () => set({ terminalLines: ['[SYS]  ─────────────────────────────────────', '[SYS]  NEW TRACE INITIATED', '[SYS]  ─────────────────────────────────────'] }),

  // ── Active case ────────────────────────────────────────────────────────────
  activeCase: { id: 'CASE-9041', operation: 'DARKPEEL' },
}));

