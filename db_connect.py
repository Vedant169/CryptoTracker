from neo4j import GraphDatabase
import os

# Neo4j database connection details
URI = "neo4j://127.0.0.1:7687"

# Set NEO4J_PASSWORD in the environment before running this script.
AUTH = ("neo4j", os.environ["NEO4J_PASSWORD"])

transactions = [
    {"sender": "Victim_Wallet", "receiver": "Scammer_1", "amount": 100.0},
    {"sender": "Scammer_1", "receiver": "Burner_2", "amount": 92.0},
    {"sender": "Scammer_1", "receiver": "Binance_Hot_Wallet", "amount": 8.0},
    {"sender": "Burner_2", "receiver": "Burner_3", "amount": 85.0},
    {"sender": "Burner_2", "receiver": "WazirX_Hot_Wallet", "amount": 7.0},
    {"sender": "Burner_3", "receiver": "Burner_4", "amount": 85.0},
]


def create_mock_graph():
    cypher_query = """
    UNWIND $transactions AS transaction
    MERGE (sender:Wallet {address: transaction.sender})
    MERGE (receiver:Wallet {address: transaction.receiver})
    MERGE (sender)-[transfer:TRANSFERRED {amount: transaction.amount}]->(receiver)
    ON CREATE SET transfer.sender = transaction.sender,
                  transfer.receiver = transaction.receiver
    """
    
    try:
        # Database se connect karke query run kar rahe hain
        with GraphDatabase.driver(URI, auth=AUTH) as driver:
            driver.execute_query(cypher_query, transactions=transactions)
            print(f"✅ {len(transactions)} transactions saved to Neo4j Database!")
    except Exception as e:
        print("❌ Connection failed! Error:", e)

if __name__ == "__main__":
    create_mock_graph()