import os
from datetime import datetime
from dotenv import load_dotenv
import networkx as nx
from neo4j import GraphDatabase
from db_connect import get_db_driver, transactions

load_dotenv()


def detect_peel_chains(G, current_wallet=None):
  """Detects peel chains in transaction graph based on split thresholds."""
  flagged_wallets = []

  # If a specific wallet is targeted, evaluate its outbound edges
  nodes_to_check = [current_wallet] if current_wallet else G.nodes()

  for node in nodes_to_check:
    out_edges = list(G.out_edges(node, data=True))
    if not out_edges:
      continue

    total_out = sum([data.get("weight", 0) for _, _, data in out_edges])
    if total_out <= 0:
      continue

    has_major_split = False
    has_minor_split = False
    suspicious_receivers = []

    for _, receiver, data in out_edges:
      percentage = (data.get("weight", 0) / total_out) * 100

      if percentage >= 20.0:
        suspicious_receivers.append(receiver)
      if percentage >= 70.0:
        has_major_split = True
      if percentage <= 15.0:
        has_minor_split = True

    if has_major_split and has_minor_split:
      flagged_wallets.append(node)

  return flagged_wallets


def sync_transactions_to_neo4j(tx_list=None):
  """Pushes processed transactions to Neo4j using centralized driver."""
  tx_data = tx_list or transactions
  query = """
    UNWIND $transactions AS transaction
    MERGE (sender:Wallet {address: transaction.sender})
    MERGE (receiver:Wallet {address: transaction.receiver})
    MERGE (sender)-[:TRANSFERRED {amount: transaction.amount}]->(receiver)
    """
  try:
    with get_db_driver() as driver:
      with driver.session() as session:
        session.run(query, transactions=tx_data)
        print(f"✅ {len(tx_data)} transactions successfully written to Neo4j.")
  except Exception as error:
    print(f"❌ Neo4j connection failed: {error}")