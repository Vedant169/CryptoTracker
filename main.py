from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from neo4j import GraphDatabase

# Agar baad mein tracer ko API se chalana ho toh:
# from tracer import trace_funds 

app = FastAPI(title="Crypto Fraud Tracing API")

# CORS setup (Taaki React frontend block na ho)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
    cypher_query = """
    MATCH path = (start)-[*1..2]-(m)
    WHERE start.address = $wallet_id OR start.id = $wallet_id
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