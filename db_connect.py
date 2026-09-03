from neo4j import GraphDatabase
import os

# Neo4j database connection details
URI = "neo4j://127.0.0.1:7687"

# Set NEO4J_PASSWORD in the environment before running this script.
AUTH = ("neo4j", os.environ["NEO4J_PASSWORD"])

def create_mock_graph():
    # Yeh Cypher query hai jo database ko batayegi ki kya nodes aur edges banane hain
    cypher_query = """
    MERGE (victim:Wallet {address: 'Victim_Wallet'})
    MERGE (scammer:Wallet {address: 'Scammer_1'})
    MERGE (victim)-[tx:TRANSFERRED {amount: 100.0}]->(scammer)
    RETURN victim, scammer
    """
    
    try:
        # Database se connect karke query run kar rahe hain
        with GraphDatabase.driver(URI, auth=AUTH) as driver:
            driver.execute_query(cypher_query)
            print("✅ Data successfully saved to Neo4j Database!")
    except Exception as e:
        print("❌ Connection failed! Error:", e)

if __name__ == "__main__":
    create_mock_graph()