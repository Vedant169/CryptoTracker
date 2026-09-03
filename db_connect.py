from neo4j import GraphDatabase
import networkx as nx
from datetime import datetime
from config import NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD

def get_db_driver():
    """Initializes and returns the Neo4j driver connection."""
    try:
        driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
        driver.verify_connectivity()
        return driver
    except Exception as e:
        print(f"❌ Neo4j Connection failed! Error: {e}")
        return None

def store_in_neo4j(driver, transactions):
    """Parses and bulk-inserts Etherscan data into Neo4j."""
    if not transactions:
        return

    cypher_query = '''
    UNWIND $batch AS tx_data
    MERGE (sender:Wallet {address: tx_data.from_address})
    MERGE (receiver:Wallet {address: tx_data.to_address})
    MERGE (tx:Transaction {hash: tx_data.tx_hash})
    ON CREATE SET 
        tx.timestamp = datetime(tx_data.timestamp),
        tx.value_eth = tx_data.value_eth
    MERGE (sender)-[:SENT]->(tx)
    MERGE (tx)-[:TO]->(receiver)
    '''

    batch_data = []
    for tx in transactions:
        val_eth = float(tx['value']) / 10**18
        if val_eth == 0:
            continue
            
        batch_data.append({
            'from_address': tx['from'].lower(),
            'to_address': tx['to'].lower() if tx['to'] else "contract_creation",
            'tx_hash': tx['hash'],
            'timestamp': datetime.fromtimestamp(int(tx['timeStamp'])).isoformat(),
            'value_eth': val_eth
        })

    with driver.session() as session:
        session.run(cypher_query, batch=batch_data)
    print(f"💾 Saved {len(batch_data)} valid transactions to Neo4j.")

def get_networkx_from_neo4j(driver):
    """Pulls the current state of the Neo4j database into a NetworkX DiGraph."""
    query = """
    MATCH (s:Wallet)-[:SENT]->(tx:Transaction)-[:TO]->(r:Wallet)
    RETURN s.address AS sender, r.address AS receiver, sum(tx.value_eth) AS total_amount
    """
    G = nx.DiGraph()
    with driver.session() as session:
        result = session.run(query)
        for record in result:
            G.add_edge(record["sender"], record["receiver"], weight=record["total_amount"])
    return G