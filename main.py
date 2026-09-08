import time
import os
from collections import deque
from config import KNOWN_VASPS
from dataingestion import fetch_transactions
from db_connect import get_db_driver, store_in_neo4j, get_networkx_from_neo4j
from logic import check_for_vasp, detect_next_suspicious_wallets
from feature_extraction import get_ml_features

# --- ML Model Loading ---
# Pure LightGBM model saved in native text format.
# We only need the lightgbm package to load and predict.
model = None
MODEL_PATH = os.path.join(os.path.dirname(__file__), 'pure_crypto_fraud_model.txt')
try:
    import lightgbm as lgb
    if os.path.exists(MODEL_PATH):
        model = lgb.Booster(model_file=MODEL_PATH)
        print("ML Model (LightGBM Booster) loaded successfully. Inference enabled.")
    else:
        print(f"Notice: '{MODEL_PATH}' not found. Running in heuristic-only mode.")
except ImportError:
    print("Notice: lightgbm not installed. Run 'pip install lightgbm'. Heuristic-only mode.")


def trace_funds(initial_victim, max_depth=3):
    """The main loop that controls fetching, storing, and analyzing."""
    driver = get_db_driver()
    if not driver:
        return

    queue = deque([(initial_victim.lower(), 0)])
    visited = set()

    print(f"\nStarting Automated Trace for Victim: {initial_victim}")

    while queue:
        current_wallet, depth = queue.popleft()

        if depth > max_depth:
            print(f"Reached max depth ({max_depth}) on branch {current_wallet}. Stopping branch.")
            continue

        if current_wallet in visited:
            continue

        visited.add(current_wallet)
        print(f"\n--- Investigating (Depth {depth}): {current_wallet} ---")

        # 1. Ingest Data (Normal + ERC20)
        tx_data = fetch_transactions(current_wallet)

        # 2. Store in Neo4j
        store_in_neo4j(driver, tx_data)

        # 3. ML Behaviour Profiling (if model is available)
        if model:
            features_df = get_ml_features(driver, current_wallet)
            # LightGBM Booster.predict() returns raw probabilities (fraud probability).
            fraud_probability = model.predict(features_df)[0]
            prediction = 1 if fraud_probability >= 0.5 else 0
            confidence = fraud_probability if prediction == 1 else (1 - fraud_probability)
            if prediction == 1:
                print(f"  ML ALERT: Wallet flagged as FRAUD (confidence: {confidence:.2%})")
            else:
                print(f"  ML Check: Wallet appears legitimate (confidence: {confidence:.2%})")

        # 4. Sync Graph for Heuristic Analysis
        G = get_networkx_from_neo4j(driver)

        # 5. Run DSA logic (Check if hit VASP)
        if check_for_vasp(G, initial_victim):
            print("\nTrace Complete. Exchange identified.")
            driver.close()
            return

        # 6. Heuristic Analysis (Find next hops)
        next_targets = detect_next_suspicious_wallets(G, current_wallet)

        for target in next_targets:
            if target not in visited and target not in [v.lower() for v in KNOWN_VASPS]:
                print(f"  Identified suspicious hop: {target}")
                queue.append((target, depth + 1))

        # Respect API rate limits
        time.sleep(0.5)

    print("\nTrace finished. Max depth reached or trail went cold.")
    driver.close()

# ==========================================
# FASTAPI SERVER PIPELINE (FRONTEND TEAM)
# ==========================================
from fastapi import FastAPI, BackgroundTasks
from routers import analysis
from fastapi.middleware.cors import CORSMiddleware
from neo4j import GraphDatabase

app = FastAPI(title="Crypto Fraud Tracing API")
app.include_router(analysis.router)

# CORS setup (Taaki React frontend block na ho)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Neo4j Database details from the frontend team's code
URI = "neo4j://127.0.0.1:7687"
AUTH = ("neo4j", "Ved@1609") # Yahan apna database password daalna

@app.get("/")
def home():
    return {"message": "Crypto API Server is Live!"}

@app.post("/analyze-wallet")
def analyze_wallet(tx_data: dict):
    wallet_id = tx_data.get("txId", "Unknown")
    
    nodes = []
    edges = []
    
    # Database se direct graph data lana
  # UPDATE: Humne 'Account' label aur 'eth_address' property add kar di hai
    cypher_query = """
    MATCH path = (start:Account)-[*1..2]-(m)
    WHERE start.eth_address = $wallet_id
    UNWIND relationships(path) AS r
    RETURN startNode(r) AS n, r, endNode(r) AS m LIMIT 200
    """

    try:
        with GraphDatabase.driver(URI, auth=AUTH) as driver:
            # Yahan hum query mein wallet_id pass kar rahe hain!
            records, _, _ = driver.execute_query(cypher_query, wallet_id=wallet_id)
            
            # Data ko ReactFlow format mein convert karna
            for record in records:
                n = record["n"]
                m = record["m"]
                r = record["r"]
                
                # Sender Node
                if not any(node['id'] == str(n.element_id) for node in nodes):
                    nodes.append({"id": str(n.element_id), "position": {"x": 100, "y": 100}, "data": {"label": n.get('address', 'Unknown')}})
                
                # Receiver Node
                if not any(node['id'] == str(m.element_id) for node in nodes):
                    nodes.append({"id": str(m.element_id), "position": {"x": 400, "y": 100}, "data": {"label": m.get('address', 'Unknown')}})
                
                # Transaction Edge
                edges.append({"id": str(r.element_id), "source": str(n.element_id), "target": str(m.element_id), "label": f"{r.get('amount', 0)} ETH"})
    except Exception as e:
        print("Neo4j Error:", e)

    return {
        "wallet_analyzed": wallet_id,
        "graph_data": {"nodes": nodes, "edges": edges}
    }

if __name__ == "__main__":
    import uvicorn
    # Let's default to running the server, or testing the ML standalone
    print("Run module via uvicorn for frontend API: uvicorn main:app --reload")
    # For a quick manual test of the ML logic independent of the API:
    # VICTIM_WALLET = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
    # trace_funds(VICTIM_WALLET, max_depth=3)