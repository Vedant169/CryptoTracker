import networkx as nx
import os

from dotenv import load_dotenv
from neo4j import GraphDatabase

load_dotenv()

# ==========================================
# 1. MOCK DATA GENERATION (The Graph Input)
# ==========================================
# Yeh hamara fake transaction data hai. 
# Dhyan se dekho: 'Scammer_1' ne 100 ETH receive kiye, 
# 92 ETH aage bhej diye (Burner_2 ko) aur 8 ETH Binance par nikal liye. (Yeh ek Peel Chain hai!)
transactions = [
    {"sender": "Victim_Wallet", "receiver": "Scammer_1", "amount": 100.0},
    {"sender": "Scammer_1", "receiver": "Burner_2", "amount": 92.0},
    {"sender": "Scammer_1", "receiver": "Binance_Hot_Wallet", "amount": 8.0},
    {"sender": "Burner_2", "receiver": "Burner_3", "amount": 85.0},
    {"sender": "Burner_2", "receiver": "WazirX_Hot_Wallet", "amount": 7.0},
    {"sender": "Burner_3", "receiver": "Burner_4", "amount": 85.0}
]

# Known exchanges ki list jo hum trace karna chahte hain
KNOW_VASPS = ["Binance_Hot_Wallet", "WazirX_Hot_Wallet"]

# ==========================================
# 2. APPLY NETWORKX (Graph Construction)
# ==========================================
# Directed Graph (DiGraph) banayenge kyunki paisa ek hi direction mein flow hota hai
G = nx.DiGraph()

# Graph mein Edges (lines) aur Nodes (wallets) add kar rahe hain
for tx in transactions:
    G.add_edge(tx["sender"], tx["receiver"], weight=tx["amount"])

print("--- GRAPH CREATED SUCCESSFULLY ---")
print(f"Total Wallets (Nodes): {G.number_of_nodes()}")
print(f"Total Transactions (Edges): {G.number_of_edges()}\n")

# ==========================================
# 3. DSA LOGIC: SHORTEST PATH (BFS)
# ==========================================
# Humara goal hai Victim se Exchange tak ka sabse chota raasta (Shortest Path) dhoondhna
print("--- 🔍 TRACING PATH TO EXCHANGES ---")
start_node = "Victim_Wallet"

for vasp in KNOW_VASPS:
    try:
        # NetworkX ka in-built shortest path algorithm (BFS based)
        path = nx.shortest_path(G, source=start_node, target=vasp)
        print(f"🚨 Path found to {vasp}:")
        print(" -> ".join(path))
    except nx.NetworkXNoPath:
        print(f"No path found to {vasp}")
print("\n")

# ==========================================
# 4. PROBLEM-SOLVING LOGIC: PEEL CHAIN DETECTION (Heuristics)
# ==========================================
# Logic: Agar ek wallet apna 90%+ fund ek naye wallet mein bhejta hai aur 
# baaki <10% kisi aur jagah (exchange) par, toh wo Peel Chain hai.

print("--- 🕵️‍♂️ RUNNING HEURISTIC: PEEL CHAIN DETECTION ---")

def detect_peel_chains(graph):
    flagged_wallets = []
    
    # Har node (wallet) ko check karenge
    for node in graph.nodes():
        # Sirf unhi wallets ko check karo jinhone aage 2 ya zyada jagah paise bheje hain
        out_edges = list(graph.out_edges(node, data=True))
        
        if len(out_edges) >= 2:
            # Total paisa kitna bahar gaya is node se?
            total_out = sum([data['weight'] for _, _, data in out_edges])
            
            has_major_split = False
            has_minor_split = False
            
            for _, receiver, data in out_edges:
                percentage = (data['weight'] / total_out) * 100
                
                # Check for > 90% split (moving to next burner)
                if percentage >= 85.0:  # Threshold thoda 85-90% ke beech rakhte hain real-world mein
                    has_major_split = True
                
                # Check for < 15% split (cashing out to exchange)
                if percentage <= 15.0:
                    has_minor_split = True
            
            # Agar dono conditions true hain, toh yeh mathematical proof hai Peel Chain ka
            if has_major_split and has_minor_split:
                flagged_wallets.append(node)
                
    return flagged_wallets

# Function call karke result print karo
suspicious_nodes = detect_peel_chains(G)

if suspicious_nodes:
    print(f"⚠️ PEEL CHAIN DETECTED! High-Risk Wallets Flagged: {suspicious_nodes}")
else:
    print("✅ No Peel Chains detected in this graph.")

# ==========================================
# 5. NEO4J INTEGRATION (Pushing to Database)
# ==========================================
print("--- 💾 SENDING DATA TO NEO4J ---")

URI = "neo4j://localhost:7687"
password = os.environ.get("NEO4J_PASSWORD")

if password:
    query = """
    UNWIND $transactions AS transaction
    MERGE (sender:Wallet {address: transaction.sender})
    MERGE (receiver:Wallet {address: transaction.receiver})
    MERGE (sender)-[:TRANSFERRED {amount: transaction.amount}]->(receiver)
    """

    try:
        with GraphDatabase.driver(URI, auth=("neo4j", password)) as driver:
            driver.execute_query(query, transactions=transactions)
        print(f"✅ {len(transactions)} transactions successfully written to Neo4j.")
    except Exception as error:
        print(f"❌ Neo4j connection failed: {error}")
else:
    print("ℹ️ Neo4j skipped. Set NEO4J_PASSWORD to write transactions to the database.")