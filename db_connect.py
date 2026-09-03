import os
from datetime import datetime
from dotenv import load_dotenv
import networkx as nx
from neo4j import GraphDatabase
from config import NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD

load_dotenv()


def get_db_driver():
  """Initializes and returns the Neo4j driver connection."""
  try:
    driver = GraphDatabase.driver(
        NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD)
    )
    driver.verify_connectivity()
    return driver
  except Exception as e:
    print(f"Failed to connect to Neo4j: {e}")
    raise


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
    with get_db_driver() as driver:
      with driver.session() as session:
        session.run(cypher_query, transactions=transactions)
        print("Mock graph created successfully.")
  except Exception as e:
    print(f"Error creating mock graph: {e}")