import React, { useState, useEffect } from "react";
import {
  Search, Download, User, Clock,
  Wifi, Database, Cpu, AlertTriangle,
} from "lucide-react";
import { useStore } from "../../store/useStore";

export function TopHeader() {
  const traceResult   = useStore((s) => s.traceResult);
  const traceLoading  = useStore((s) => s.traceLoading);
  const runTrace      = useStore((s) => s.runTrace);
  const activeCase    = useStore((s) => s.activeCase);

  const [inputAddr, setInputAddr] = useState("");
  const [inputHops, setInputHops] = useState(5);
  const [time, setTime]           = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const handleTrace = () => {
    if (inputAddr.trim()) runTrace(inputAddr.trim(), inputHops);
  };

  const riskScore = traceResult?.riskScore ?? 0;
  const riskColor =
    riskScore >= 80 ? "var(--color-secondary-dim)" :
    riskScore >= 50 ? "#f59e0b" :
    "var(--color-primary)";

  return (
    <div style={{ background: "var(--color-surface-1)" }}>

      {/* Row 1: Status bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0.25rem 0.75rem",
        borderBottom: "1px solid var(--color-border)",
        overflow: "hidden", minWidth: 0,
        background: "var(--color-surface-2)",
      }}>
        {/* Left: connection pills */}
        <div style={{ display: "flex", gap: "0.375rem", overflow: "hidden", minWidth: 0 }}>
          <StatusPill icon={<Wifi size={9} />}     label="NODE RUNNER"   value="ACTIVE"     ok />
          <StatusPill icon={<Database size={9} />} label="NEO4J CLUSTER" value="CONNECTED"  ok />
          <StatusPill icon={<Cpu size={9} />}      label="ML ENGINE"     value="V3.1 ONLINE" ok />
        </div>

        {/* Right: clock + case + user */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
            <Clock size={9} color="var(--color-text-faint)" />
            <span className="label-sm" style={{ color: "var(--color-text-muted)" }}>
              {time.toLocaleTimeString("en-US", { hour12: false })} UTC
            </span>
          </div>
          <div style={{
            display: "flex", alignItems: "center", gap: "0.375rem",
            padding: "0.15rem 0.5rem",
            background: "var(--color-surface-3)", borderRadius: "0.25rem",
            border: "1px solid var(--color-border)",
          }}>
            <span className="label-sm" style={{ color: "var(--color-text-faint)" }}>CASE</span>
            <span className="code-terminal" style={{ color: "var(--color-tertiary)" }}>{activeCase.id}</span>
            <span className="label-sm" style={{ color: "var(--color-text-faint)" }}>OP:</span>
            <span className="code-terminal" style={{ color: "var(--color-text)" }}>{activeCase.operation}</span>
          </div>
          <button id="download-dossier-btn" className="btn btn-ghost" disabled={!traceResult}
            style={{ padding: "0.2rem 0.5rem", fontSize: "9px" }}>
            <Download size={9} /> DOSSIER
          </button>
          <div style={{
            display: "flex", alignItems: "center", gap: "0.25rem",
            padding: "0.15rem 0.5rem",
            background: "var(--color-surface-3)", borderRadius: "999px",
            border: "1px solid var(--color-border)",
          }}>
            <User size={9} color="var(--color-text-faint)" />
            <span className="label-sm" style={{ color: "var(--color-text)" }}>DARKPEEL</span>
          </div>
        </div>
      </div>

      {/* Row 2: Wallet trace command bar */}
      <div style={{
        display: "flex", alignItems: "center", gap: "0.5rem",
        padding: "0.5rem 0.75rem",
        borderBottom: "1px solid var(--color-border)",
        overflow: "hidden", minWidth: 0,
      }}>
        {/* Address input */}
        <div style={{
          flex: 1, display: "flex", alignItems: "center", gap: "0.5rem",
          background: "var(--color-surface-2)",
          border: "1px solid var(--color-border)",
          borderRadius: "0.375rem",
          padding: "0.4rem 0.75rem",
          minWidth: 0,
        }}>
          <Search size={12} color="var(--color-text-faint)" style={{ flexShrink: 0 }} />
          <input
            id="wallet-address-input"
            type="text"
            value={inputAddr}
            onChange={(e) => setInputAddr(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleTrace()}
            placeholder="Enter wallet / contract address  (0x...  or  bc1...)"
            style={{
              flex: 1,
              background: "none", border: "none", outline: "none",
              color: "var(--color-tertiary)", fontFamily: "var(--font-mono)",
              fontSize: "12px", minWidth: 0,
            }}
          />
          {inputAddr && (
            <button onClick={() => setInputAddr("")} style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--color-text-faint)", padding: 0, lineHeight: 1,
              fontSize: "12px", flexShrink: 0,
            }}>✕</button>
          )}
        </div>

        {/* Hops selector */}
        <div style={{
          display: "flex", alignItems: "center", gap: "0.375rem",
          background: "var(--color-surface-2)",
          border: "1px solid var(--color-border)",
          borderRadius: "0.375rem",
          padding: "0.4rem 0.625rem",
          flexShrink: 0,
        }}>
          <span className="label-sm" style={{ color: "var(--color-text-faint)" }}>HOPS</span>
          <select id="hop-count-select" value={inputHops}
            onChange={(e) => setInputHops(Number(e.target.value))}
            style={{ background: "none", border: "none", outline: "none",
              color: "var(--color-text)", fontFamily: "var(--font-mono)", fontSize: "12px", cursor: "pointer" }}>
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>

        {/* Trace button */}
        <button id="trace-wallet-btn" className="btn btn-primary" onClick={handleTrace}
          disabled={traceLoading || !inputAddr.trim()}
          style={{ flexShrink: 0, padding: "0.4rem 1.25rem", fontSize: "11px" }}>
          {traceLoading ? "TRACING..." : "TRACE WALLET"}
        </button>
      </div>

      {/* Row 3: Trace stats */}
      <div style={{
        display: "flex", alignItems: "center", gap: "0.75rem",
        padding: "0.25rem 0.75rem",
        background: "var(--color-surface-2)",
        minHeight: "26px", overflow: "hidden", minWidth: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", flexShrink: 0 }}>
          <span className="label-sm" style={{ color: "var(--color-text-faint)" }}>TARGET:</span>
          {traceResult ? (
            <span className="code-terminal" style={{ color: "var(--color-tertiary)" }}>
              {traceResult.rootAddress.slice(0, 10)}...{traceResult.rootAddress.slice(-5)}
            </span>
          ) : (
            <span className="code-terminal" style={{ color: "var(--color-text-faint)" }}>—</span>
          )}
        </div>

        {traceResult ? (
          <>
            <div style={{
              display: "flex", alignItems: "center", gap: "0.375rem",
              padding: "0.1rem 0.5rem",
              background: riskScore >= 80 ? "rgba(212,0,75,0.15)" : "rgba(0,229,91,0.08)",
              border: `1px solid ${riskColor}`, borderRadius: "999px",
            }}>
              <AlertTriangle size={9} color={riskColor} />
              <span className="label-sm" style={{ color: riskColor }}>
                {riskScore >= 80 ? "HIGH RISK" : riskScore >= 50 ? "MEDIUM RISK" : "LOW RISK"} ({riskScore}/100)
              </span>
              {traceResult.threatVector && (
                <span className="code-terminal" style={{ color: "var(--color-text-muted)", marginLeft: "0.25rem" }}>
                  — {traceResult.threatVector.slice(0, 50)}{traceResult.threatVector.length > 50 ? "..." : ""}
                </span>
              )}
            </div>
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "1rem", flexShrink: 0 }}>
              <StatChip label="GRAPH DEPTH" value={`${traceResult.hops} HOPS`} />
              <StatChip label="NODES"       value={`${traceResult.nodes.length.toLocaleString()}`} />
              <StatChip label="EDGES"       value={`${traceResult.edges.length.toLocaleString()}`} />
            </div>
          </>
        ) : (
          <span className="code-terminal" style={{ color: "var(--color-text-faint)" }}>
            {traceLoading ? "TRACE IN PROGRESS..." : "NO ACTIVE TRACE — ENTER ADDRESS AND PRESS TRACE WALLET"}
          </span>
        )}
      </div>

    </div>
  );
}

function StatusPill({ icon, label, value, ok }: { icon: React.ReactNode; label: string; value: string; ok?: boolean }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "0.3rem",
      padding: "0.15rem 0.5rem",
      background: "var(--color-surface-1)",
      border: "1px solid var(--color-border)", borderRadius: "0.25rem",
      flexShrink: 0,
    }}>
      <span style={{ color: ok ? "var(--color-primary)" : "var(--color-secondary)" }}>{icon}</span>
      <span className="label-sm" style={{ color: "var(--color-text-faint)" }}>{label}</span>
      <span className={`status-dot ${ok ? "status-dot-active" : "status-dot-error"}`} />
      <span className="label-sm" style={{ color: ok ? "var(--color-primary)" : "var(--color-secondary-dim)" }}>{value}</span>
    </div>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
      <span className="label-sm" style={{ color: "var(--color-text-faint)" }}>{label}</span>
      <span className="code-terminal" style={{ color: "var(--color-tertiary)", fontWeight: 600 }}>{value}</span>
    </div>
  );
}
