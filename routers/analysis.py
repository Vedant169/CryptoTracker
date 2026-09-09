"""
routers/analysis.py
────────────────────────────────────────────────────────────────────────────
Sentinel — Analysis Endpoints
  POST /vasp-offramps       → BFS + Dijkstra VASP discovery
  POST /peeling-heuristics  → 90/10 split + velocity flag analysis
  POST /generate-dossier    → ReportLab PDF dossier (StreamingResponse)
"""

from __future__ import annotations

import hashlib
import io
from collections import deque
from datetime import datetime
from typing import Any

import networkx as nx
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from config import KNOWN_VASPS, NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD
from db_connect import get_db_driver, get_networkx_from_neo4j

router = APIRouter()

# ── Request/Response schemas ─────────────────────────────────────────────────

class WalletRequest(BaseModel):
    address: str

class DossierRequest(BaseModel):
    address: str
    case_id: str = "CASE-0000"
    officer_name: str = "Investigating Officer"
    case_notes: str = ""


# ── Shared helpers ───────────────────────────────────────────────────────────

VASP_LABELS: dict[str, str] = {
    "0x28c6c06298d514db089934071355e5743bf21d60": "Binance Hot Wallet",
    "0x56eddb7aa87536c09ccc2793473599fd21a8b17f": "WazirX Cold Wallet",
}

def _label(address: str) -> str:
    return VASP_LABELS.get(address.lower(), f"VASP-{address[:6].upper()}")


def _bfs_reachable(G: nx.DiGraph, start: str, max_depth: int = 5) -> dict[str, int]:
    """BFS from start node; returns {node: hop_depth}."""
    start = start.lower()
    if start not in G.nodes:
        return {}
    visited: dict[str, int] = {start: 0}
    q: deque[tuple[str, int]] = deque([(start, 0)])
    while q:
        node, depth = q.popleft()
        if depth >= max_depth:
            continue
        for neighbor in G.successors(node):
            if neighbor not in visited:
                visited[neighbor] = depth + 1
                q.append((neighbor, depth + 1))
    return visited


def _get_graph() -> nx.DiGraph | None:
    driver = get_db_driver()
    if not driver:
        return None
    G = get_networkx_from_neo4j(driver)
    driver.close()
    return G


def _fetch_tx_timestamps(address: str) -> list[dict[str, Any]]:
    """Pull raw tx timestamps for forwarding velocity analysis."""
    from neo4j import GraphDatabase
    cypher = """
    MATCH (s {eth_address: $addr})-[r:TO]->(rec)
    WHERE r.eth_value IS NOT NULL
    RETURN
        s.eth_address  AS sender,
        rec.eth_address  AS receiver,
        toFloat(r.eth_value) AS amount_eth,
        r.timestamp AS ts
    ORDER BY r.timestamp
    """
    records_out = []
    try:
        driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
        with driver.session() as session:
            result = session.run(cypher, addr=address.lower())
            for rec in result:
                records_out.append({
                    "sender":    rec["sender"],
                    "receiver":  rec["receiver"],
                    "amount_eth": rec["amount_eth"] or 0.0,
                    "ts":        rec["ts"],
                })
        driver.close()
    except Exception as e:
        print(f"[analysis] timestamp query error: {e}")
    return records_out


def _fetch_deep_txs(address: str, hops: int = 5) -> list[dict[str, Any]]:
    """Pull raw transactions up to N hops deep for the dossier."""
    from neo4j import GraphDatabase
    cypher = f"""
    MATCH path = (start {{eth_address: $addr}})-[:TO*1..{hops}]->(end)
    WITH start, end, relationships(path) AS rels
    UNWIND rels AS r
    WITH start, end, r LIMIT 200
    RETURN
        start.eth_address  AS from_addr,
        end.eth_address    AS to_addr,
        toFloat(r.eth_value) AS value_eth,
        r.timestamp AS ts
    """
    rows = []
    try:
        driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
        with driver.session() as session:
            result = session.run(cypher, addr=address.lower())
            for rec in result:
                rows.append({
                    "from":       rec["from_addr"],
                    "to":         rec["to_addr"],
                    "value_eth":  rec["value_eth"] or 0.0,
                    "timestamp":  rec["ts"],
                })
        driver.close()
    except Exception as e:
        print(f"[analysis] deep tx query error: {e}")
    return rows


# ══════════════════════════════════════════════════════════════════════════════
# ENDPOINT 1 — VASP Offramps
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/vasp-offramps")
def vasp_offramps(req: WalletRequest):
    address = req.address.strip().lower()
    if not address:
        return {"vasps": [], "error": "No address provided"}

    G = _get_graph()
    if G is None or G.number_of_nodes() == 0:
        return {"vasps": [], "error": "Graph unavailable or empty"}

    reachable = _bfs_reachable(G, address, max_depth=5)
    found_vasps = []

    known_lower = [v.lower() for v in KNOWN_VASPS]

    for vasp_addr in known_lower:
        if vasp_addr not in reachable:
            continue

        hop_depth = reachable[vasp_addr]

        # Shortest path (Dijkstra on inverse-weight for highest-value route)
        try:
            path = nx.shortest_path(G, source=address, target=vasp_addr)
        except (nx.NetworkXNoPath, nx.NodeNotFound):
            path = []

        # Total ETH deposited to this VASP directly (sum of edge weights into it)
        total_eth = sum(
            G[u][vasp_addr].get("weight", 0.0)
            for u in G.predecessors(vasp_addr)
            if u in reachable
        )

        risk = "CRITICAL" if hop_depth <= 2 else ("HIGH" if hop_depth <= 4 else "MEDIUM")

        found_vasps.append({
            "exchange":   _label(vasp_addr),
            "address":    vasp_addr,
            "hops":       hop_depth,
            "path":       path,
            "total_eth":  round(total_eth, 6),
            "risk_level": risk,
        })

    found_vasps.sort(key=lambda x: x["hops"])
    return {"vasps": found_vasps, "total_found": len(found_vasps)}


# ══════════════════════════════════════════════════════════════════════════════
# ENDPOINT 2 — Peeling Heuristics
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/peeling-heuristics")
def peeling_heuristics(req: WalletRequest):
    address = req.address.strip().lower()
    if not address:
        return {"peel_flags": [], "velocity_flags": [], "error": "No address provided"}

    G = _get_graph()
    if G is None or G.number_of_nodes() == 0:
        return {"peel_flags": [], "velocity_flags": [], "error": "Graph unavailable"}

    reachable = _bfs_reachable(G, address, max_depth=5)
    known_lower = set(v.lower() for v in KNOWN_VASPS)

    # ── Rule 1: 90/10 Split ───────────────────────────────────────────────────
    peel_flags: list[dict] = []

    for node in reachable:
        out_edges = list(G.out_edges(node, data=True))
        if len(out_edges) < 2:
            continue

        total_out = sum(d.get("weight", 0.0) for _, _, d in out_edges)
        if total_out == 0:
            continue

        # Largest single outflow = candidate "peel" edge
        max_edge = max(out_edges, key=lambda e: e[2].get("weight", 0.0))
        peel_ratio = (max_edge[2].get("weight", 0.0) / total_out) * 100

        # VASP-directed outflow
        vasp_out = sum(
            d.get("weight", 0.0)
            for _, tgt, d in out_edges
            if tgt in known_lower
        )
        vasp_ratio = (vasp_out / total_out) * 100

        if peel_ratio >= 90.0 and vasp_ratio < 10.0:
            severity = "CRITICAL" if peel_ratio >= 97 else "CONFIRMED"
            peel_flags.append({
                "address":    node,
                "peel_ratio": round(peel_ratio, 1),
                "vasp_ratio": round(vasp_ratio, 1),
                "peel_target": max_edge[1],
                "severity":   severity,
            })

    # ── Rule 2: Velocity (< 3 min hold) ─────────────────────────────────────
    velocity_flags: list[dict] = []

    txs = _fetch_tx_timestamps(address)

    # Group by sender to detect fast-forward
    from collections import defaultdict
    by_sender: dict[str, list[dict]] = defaultdict(list)
    for tx in txs:
        by_sender[tx["sender"]].append(tx)

    for wallet, wallet_txs in by_sender.items():
        if len(wallet_txs) < 2:
            continue
        # Sort by timestamp; find min time-gap between consecutive txs
        try:
            sorted_txs = sorted(wallet_txs, key=lambda t: t["ts"] or "")
            times = [
                datetime.fromisoformat(t["ts"].replace("Z", "+00:00"))
                for t in sorted_txs
                if t["ts"]
            ]
            if len(times) < 2:
                continue
            min_gap = min(
                abs((times[i + 1] - times[i]).total_seconds())
                for i in range(len(times) - 1)
            )
            if min_gap < 180:
                total_fwd = sum(t["amount_eth"] for t in wallet_txs)
                velocity_flags.append({
                    "address":      wallet,
                    "hold_seconds": round(min_gap, 1),
                    "amount_eth":   round(total_fwd, 6),
                    "severity":     "CRITICAL" if min_gap < 30 else "FLAGGED",
                })
        except Exception:
            continue

    return {
        "peel_flags":     peel_flags,
        "velocity_flags": velocity_flags,
        "total_peel":     len(peel_flags),
        "total_velocity": len(velocity_flags),
    }


# ══════════════════════════════════════════════════════════════════════════════
# ENDPOINT 3 — Generate Evidence Dossier PDF
# ══════════════════════════════════════════════════════════════════════════════

def _build_pdf(address: str, case_id: str, officer: str, notes: str,
               vasps: list, peel_flags: list, velocity_flags: list,
               transactions: list) -> bytes:
    """Build a court-ready PDF using ReportLab and return as bytes."""
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import cm
    from reportlab.platypus import (
        HRFlowable, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
    )

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        rightMargin=2 * cm,
        leftMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
        title=f"Evidence Dossier — {case_id}",
    )

    styles = getSampleStyleSheet()

    # Custom styles
    heading1 = ParagraphStyle(
        "H1", parent=styles["Heading1"],
        fontSize=16, spaceAfter=6, textColor=colors.HexColor("#1a1a2e"),
    )
    heading2 = ParagraphStyle(
        "H2", parent=styles["Heading2"],
        fontSize=12, spaceAfter=4, textColor=colors.HexColor("#16213e"),
    )
    mono = ParagraphStyle(
        "Mono", parent=styles["Normal"],
        fontName="Courier", fontSize=8, leading=12,
    )
    normal = styles["Normal"]
    normal.fontSize = 9

    # ── Chain-of-custody hash ─────────────────────────────────────────────────
    raw_payload = f"{address}{case_id}{officer}{datetime.utcnow().date()}{vasps}{peel_flags}{velocity_flags}"
    coc_hash = hashlib.sha256(raw_payload.encode()).hexdigest().upper()

    # ── Table style helper ────────────────────────────────────────────────────
    def make_table_style(header_color=colors.HexColor("#16213e")):
        return TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), header_color),
            ("TEXTCOLOR",  (0, 0), (-1, 0), colors.white),
            ("FONTNAME",   (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE",   (0, 0), (-1, 0), 8),
            ("FONTNAME",   (0, 1), (-1, -1), "Courier"),
            ("FONTSIZE",   (0, 1), (-1, -1), 7),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f0f4ff")]),
            ("GRID",       (0, 0), (-1, -1), 0.3, colors.HexColor("#cccccc")),
            ("VALIGN",     (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("LEFTPADDING",   (0, 0), (-1, -1), 4),
        ])

    def trunc(s: str, n: int = 20) -> str:
        s = str(s)
        return s[:n] + "…" if len(s) > n else s

    # ── Build story ───────────────────────────────────────────────────────────
    story = []
    hr = HRFlowable(width="100%", thickness=1, color=colors.HexColor("#16213e"))

    # Header
    story.append(Paragraph("GOVERNMENT OF INDIA", heading1))
    story.append(Paragraph("Ministry of Home Affairs — Cyber Crime Coordination Centre (I4C)", normal))
    story.append(Spacer(1, 6))
    story.append(hr)
    story.append(Spacer(1, 4))
    story.append(Paragraph(
        "ASSET PRESERVATION NOTICE — Section 94 BNSS / Section 91 CrPC", heading1
    ))
    story.append(Spacer(1, 4))
    story.append(hr)
    story.append(Spacer(1, 12))

    # Section 1 — Case Metadata
    story.append(Paragraph("1. CASE METADATA", heading2))
    meta_data = [
        ["Field", "Value"],
        ["Case ID",           case_id],
        ["Investigating Officer", officer],
        ["Date Generated",    datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")],
        ["Chain-of-Custody Hash (SHA-256)", trunc(coc_hash, 64)],
        ["Case Notes",        notes or "N/A"],
    ]
    meta_table = Table(meta_data, colWidths=[5 * cm, 12 * cm])
    meta_table.setStyle(make_table_style())
    story.append(meta_table)
    story.append(Spacer(1, 14))

    # Section 2 — Suspect Wallet & Raw Transactions
    story.append(Paragraph("2. SUSPECT WALLET & TRANSACTION TRACE (UP TO 5 HOPS)", heading2))
    story.append(Paragraph(f"<b>Root Address:</b> {address}", mono))
    story.append(Spacer(1, 6))

    if transactions:
        tx_data = [["#", "From", "To", "ETH", "Timestamp"]]
        for i, tx in enumerate(transactions[:40], 1):
            tx_data.append([
                str(i),
                trunc(tx.get("from", "—"), 18),
                trunc(tx.get("to",   "—"), 18),
                f"{tx.get('value_eth', 0.0):.6f}",
                trunc(tx.get("timestamp", "—"), 22),
            ])
        tx_table = Table(tx_data, colWidths=[0.6*cm, 4.5*cm, 4.5*cm, 2.5*cm, 4.5*cm])
        tx_table.setStyle(make_table_style(colors.HexColor("#0f3460")))
        story.append(tx_table)
    else:
        story.append(Paragraph("No transaction records found in database.", normal))
    story.append(Spacer(1, 14))

    # Section 3 — VASP Offramps
    story.append(Paragraph("3. IDENTIFIED VASP OFFRAMP DESTINATIONS", heading2))
    if vasps:
        vasp_data = [["Exchange", "Address", "Hops", "ETH Deposited", "Risk"]]
        for v in vasps:
            vasp_data.append([
                v.get("exchange", "—"),
                trunc(v.get("address", "—"), 22),
                str(v.get("hops", "—")),
                f"{v.get('total_eth', 0.0):.6f}",
                v.get("risk_level", "—"),
            ])
        vasp_table = Table(vasp_data, colWidths=[3.5*cm, 5*cm, 1.5*cm, 3*cm, 3*cm])
        vasp_table.setStyle(make_table_style(colors.HexColor("#7b0000")))
        story.append(vasp_table)
    else:
        story.append(Paragraph("No VASP offramp destinations identified.", normal))
    story.append(Spacer(1, 14))

    # Section 4 — Heuristic Risk Flags
    story.append(Paragraph("4. HEURISTIC RISK FLAGS", heading2))
    story.append(Paragraph("4a. Peel-Chain Split Flags (>90% volume on single outflow):", normal))
    story.append(Spacer(1, 4))
    if peel_flags:
        peel_data = [["Address", "Peel %", "VASP %", "Peel Target", "Severity"]]
        for p in peel_flags:
            peel_data.append([
                trunc(p.get("address", "—"), 20),
                f"{p.get('peel_ratio', 0):.1f}%",
                f"{p.get('vasp_ratio', 0):.1f}%",
                trunc(p.get("peel_target", "—"), 20),
                p.get("severity", "—"),
            ])
        peel_table = Table(peel_data, colWidths=[4.5*cm, 2*cm, 2*cm, 4.5*cm, 3*cm])
        peel_table.setStyle(make_table_style(colors.HexColor("#5c1a1a")))
        story.append(peel_table)
    else:
        story.append(Paragraph("No 90/10 split anomalies detected.", normal))

    story.append(Spacer(1, 8))
    story.append(Paragraph("4b. High-Velocity Forwarding Flags (<3 min hold time):", normal))
    story.append(Spacer(1, 4))
    if velocity_flags:
        vel_data = [["Address", "Hold Time (s)", "ETH Forwarded", "Severity"]]
        for v in velocity_flags:
            vel_data.append([
                trunc(v.get("address", "—"), 22),
                str(v.get("hold_seconds", "—")),
                f"{v.get('amount_eth', 0.0):.6f}",
                v.get("severity", "—"),
            ])
        vel_table = Table(vel_data, colWidths=[5*cm, 3*cm, 3.5*cm, 4.5*cm])
        vel_table.setStyle(make_table_style(colors.HexColor("#3d1a5c")))
        story.append(vel_table)
    else:
        story.append(Paragraph("No high-velocity forwarding anomalies detected.", normal))

    story.append(Spacer(1, 18))
    story.append(hr)
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        f"This document was auto-generated by Sentinel Forensics Engine on "
        f"{datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}. "
        f"Chain-of-Custody Hash: {coc_hash[:32]}...",
        ParagraphStyle("Footer", parent=normal, fontSize=7, textColor=colors.grey)
    ))

    doc.build(story)
    return buf.getvalue()


@router.post("/generate-dossier")
def generate_dossier(req: DossierRequest):
    address = req.address.strip().lower()

    # Gather all data internally
    vasp_result   = vasp_offramps(WalletRequest(address=address))
    peel_result   = peeling_heuristics(WalletRequest(address=address))
    transactions  = _fetch_deep_txs(address, hops=5)

    vasps         = vasp_result.get("vasps", [])
    peel_flags    = peel_result.get("peel_flags", [])
    velocity_flags = peel_result.get("velocity_flags", [])

    pdf_bytes = _build_pdf(
        address=address,
        case_id=req.case_id,
        officer=req.officer_name,
        notes=req.case_notes,
        vasps=vasps,
        peel_flags=peel_flags,
        velocity_flags=velocity_flags,
        transactions=transactions,
    )

    filename = f"dossier_{req.case_id.replace(' ', '_')}.pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
