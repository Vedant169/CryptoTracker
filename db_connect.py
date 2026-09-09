from datetime import datetime
import networkx as nx
from neo4j import GraphDatabase
from config import NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD


def get_db_driver():
    """Initializes and returns the Neo4j driver connection."""
    try:
        driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
        driver.verify_connectivity()
        print("✅ Connected to Neo4j")
        return driver
    except Exception as e:
        print(f"Neo4j Connection failed! Error: {e}")
        return None


def clear_database(driver):
    """Delete ALL nodes and relationships from Neo4j — a full reset.

    Mirrors Neo4jClient.clear_database() from the NeoJ4-Ethereum repo.
    """
    with driver.session() as session:
        session.run("MATCH (n) DETACH DELETE n")
    print("🗑️  Database cleared — all nodes and relationships deleted")


def create_indexes(driver):
    """Create database indexes for fast lookups.

    Mirrors Neo4jClient.create_indexes() from the NeoJ4-Ethereum repo.
    Creates indexes on:
        - Account.eth_address
        - SmartContract.eth_address
        - TO.hash (relationship property index)
    """
    index_queries = [
        "CREATE INDEX IF NOT EXISTS FOR (a:Account) ON (a.eth_address)",
        "CREATE INDEX IF NOT EXISTS FOR (s:SmartContract) ON (s.eth_address)",
        "CREATE INDEX IF NOT EXISTS FOR ()-[r:TO]-() ON (r.hash)",
    ]
    with driver.session() as session:
        for q in index_queries:
            session.run(q)
    print("📇 Database indexes created")


def set_node_label(driver, eth_address, label):
    """Find a node by its eth_address and set its label.

    When setting the SmartContract label, the Account label is removed
    so that a node is exclusively one or the other.

    Args:
        driver: Neo4j driver instance.
        eth_address: The Ethereum address of the node.
        label: The label to set (e.g. "Account", "SmartContract", "Initial").
    """
    if label == "SmartContract":
        query = f"MATCH (n {{eth_address: $address}}) REMOVE n:Account SET n:{label}"
    else:
        query = f"MATCH (n {{eth_address: $address}}) SET n:{label}"
    with driver.session() as session:
        session.run(query, address=eth_address)


def store_in_neo4j(driver, data):
    """Parses and bulk-inserts Etherscan data into Neo4j.

    Accepts the dict returned by fetch_transactions:
        {"normal": [...], "internal": [...], "erc20": [...], "erc721": [...], "erc1155": [...]}

    Uses the NeoJ4-Ethereum repo's graph schema:
        (:Account {eth_address})-[:TO {hash, eth_value, status}]->(:Account)

    Normal ETH transactions use `eth_value` on the :TO relationship.
    Internal transactions use `internal_value` (excluded from ML features).
    ERC20 transfers use `value_token`, `token_name`, `token_symbol`.
    ERC721/ERC1155 transfers use `token_id`, `token_type` (excluded from ML features).
    """
    if not data:
        return

    normal_txs = data.get("normal", [])
    internal_txs = data.get("internal", [])
    erc20_txs = data.get("erc20", [])
    erc721_txs = data.get("erc721", [])
    erc1155_txs = data.get("erc1155", [])

    # Track contract addresses for SmartContract labeling
    contract_addresses = set()

    # --- Normal Transactions ---
    cypher_normal = '''
    UNWIND $batch AS tx_data
    MERGE (sender:Account {eth_address: tx_data.from_address})
    MERGE (receiver:Account {eth_address: tx_data.to_address})
    MERGE (sender)-[r:TO {hash: tx_data.tx_hash}]->(receiver)
    ON CREATE SET
        r.eth_value = tx_data.eth_value,
        r.status = tx_data.status,
        r.timestamp = tx_data.timestamp,
        r.is_contract_creation = tx_data.is_contract_creation
    '''

    batch_normal = []
    for tx in normal_txs:
        try:
            val_eth = float(tx['value']) / 10**18
            if val_eth == 0:
                continue
            to_addr = tx['to'].lower() if tx['to'] else "contract_creation"
            batch_normal.append({
                'from_address': tx['from'].lower(),
                'to_address': to_addr,
                'tx_hash': tx['hash'],
                'timestamp': datetime.fromtimestamp(int(tx['timeStamp'])).isoformat(),
                'eth_value': str(val_eth),
                'status': 'OK' if tx.get('isError', '0') == '0' else 'ERROR',
                'is_contract_creation': tx.get('to') is None or tx.get('to') == ''
            })
        except Exception:
            pass

    # --- Internal Transactions (Smart Contract Executions) ---
    # Uses `internal_value` instead of `eth_value` so the ML feature query skips these.
    cypher_internal = '''
    UNWIND $batch AS tx_data
    MERGE (sender:Account {eth_address: tx_data.from_address})
    MERGE (receiver:Account {eth_address: tx_data.to_address})
    MERGE (sender)-[r:TO {hash: tx_data.tx_hash}]->(receiver)
    ON CREATE SET
        r.internal_value = tx_data.internal_value,
        r.status = tx_data.status,
        r.timestamp = tx_data.timestamp,
        r.tx_type = 'internal'
    '''

    batch_internal = []
    for tx in internal_txs:
        try:
            val_eth = float(tx['value']) / 10**18
            if val_eth == 0:
                continue
            from_addr = tx['from'].lower() if tx.get('from') else ''
            to_addr = tx['to'].lower() if tx.get('to') else ''
            if not from_addr or not to_addr:
                continue
            # Internal txs originate from contract execution — mark sender as SmartContract
            contract_addresses.add(from_addr)
            batch_internal.append({
                'from_address': from_addr,
                'to_address': to_addr,
                'tx_hash': tx.get('hash', tx.get('traceId', '')),
                'timestamp': datetime.fromtimestamp(int(tx['timeStamp'])).isoformat(),
                'internal_value': str(val_eth),
                'status': 'OK' if tx.get('isError', '0') == '0' else 'ERROR',
            })
        except Exception:
            pass

    # --- ERC20 Token Transactions ---
    cypher_erc20 = '''
    UNWIND $batch AS tx_data
    MERGE (sender:Account {eth_address: tx_data.from_address})
    MERGE (receiver:Account {eth_address: tx_data.to_address})
    MERGE (sender)-[r:TO {hash: tx_data.tx_hash}]->(receiver)
    ON CREATE SET
        r.value_token = tx_data.value_token,
        r.token_name = tx_data.token_name,
        r.token_symbol = tx_data.token_symbol,
        r.contract_address = tx_data.contract_address,
        r.status = 'OK',
        r.timestamp = tx_data.timestamp
    '''

    batch_erc20 = []
    for tx in erc20_txs:
        try:
            decimals = int(tx.get('tokenDecimal', 18))
            val_token = float(tx['value']) / (10**decimals)
            if val_token == 0:
                continue
            contract_addr = tx.get('contractAddress', '').lower()
            if contract_addr:
                contract_addresses.add(contract_addr)
            batch_erc20.append({
                'from_address': tx['from'].lower(),
                'to_address': tx['to'].lower(),
                'tx_hash': tx['hash'],
                'timestamp': datetime.fromtimestamp(int(tx['timeStamp'])).isoformat(),
                'value_token': val_token,
                'token_name': tx.get('tokenName', 'Unknown'),
                'token_symbol': tx.get('tokenSymbol', 'Unknown'),
                'contract_address': contract_addr
            })
        except Exception:
            pass

    # --- ERC721 Token Transactions (NFTs) ---
    # Uses `token_id` and `token_type` — no `value_token` or `eth_value`, so ML skips these.
    cypher_erc721 = '''
    UNWIND $batch AS tx_data
    MERGE (sender:Account {eth_address: tx_data.from_address})
    MERGE (receiver:Account {eth_address: tx_data.to_address})
    MERGE (sender)-[r:TO {hash: tx_data.tx_hash}]->(receiver)
    ON CREATE SET
        r.token_id = tx_data.token_id,
        r.token_name = tx_data.token_name,
        r.token_symbol = tx_data.token_symbol,
        r.contract_address = tx_data.contract_address,
        r.token_type = 'ERC721',
        r.status = 'OK',
        r.timestamp = tx_data.timestamp
    '''

    batch_erc721 = []
    for tx in erc721_txs:
        try:
            contract_addr = tx.get('contractAddress', '').lower()
            if contract_addr:
                contract_addresses.add(contract_addr)
            batch_erc721.append({
                'from_address': tx['from'].lower(),
                'to_address': tx['to'].lower(),
                'tx_hash': tx['hash'],
                'timestamp': datetime.fromtimestamp(int(tx['timeStamp'])).isoformat(),
                'token_id': tx.get('tokenID', ''),
                'token_name': tx.get('tokenName', 'Unknown'),
                'token_symbol': tx.get('tokenSymbol', 'Unknown'),
                'contract_address': contract_addr
            })
        except Exception:
            pass

    # --- ERC1155 Token Transactions (Multi-Token) ---
    # Uses `token_id`, `token_value`, and `token_type` — no `value_token` or `eth_value`.
    cypher_erc1155 = '''
    UNWIND $batch AS tx_data
    MERGE (sender:Account {eth_address: tx_data.from_address})
    MERGE (receiver:Account {eth_address: tx_data.to_address})
    MERGE (sender)-[r:TO {hash: tx_data.tx_hash}]->(receiver)
    ON CREATE SET
        r.token_id = tx_data.token_id,
        r.token_value = tx_data.token_value,
        r.token_name = tx_data.token_name,
        r.token_symbol = tx_data.token_symbol,
        r.contract_address = tx_data.contract_address,
        r.token_type = 'ERC1155',
        r.status = 'OK',
        r.timestamp = tx_data.timestamp
    '''

    batch_erc1155 = []
    for tx in erc1155_txs:
        try:
            contract_addr = tx.get('contractAddress', '').lower()
            if contract_addr:
                contract_addresses.add(contract_addr)
            batch_erc1155.append({
                'from_address': tx['from'].lower(),
                'to_address': tx['to'].lower(),
                'tx_hash': tx['hash'],
                'timestamp': datetime.fromtimestamp(int(tx['timeStamp'])).isoformat(),
                'token_id': tx.get('tokenID', ''),
                'token_value': tx.get('tokenValue', '0'),
                'token_name': tx.get('tokenName', 'Unknown'),
                'token_symbol': tx.get('tokenSymbol', 'Unknown'),
                'contract_address': contract_addr
            })
        except Exception:
            pass

    # --- Bulk Insert All Batches ---
    with driver.session() as session:
        if batch_normal:
            session.run(cypher_normal, batch=batch_normal)
        if batch_internal:
            session.run(cypher_internal, batch=batch_internal)
        if batch_erc20:
            session.run(cypher_erc20, batch=batch_erc20)
        if batch_erc721:
            session.run(cypher_erc721, batch=batch_erc721)
        if batch_erc1155:
            session.run(cypher_erc1155, batch=batch_erc1155)

    # --- Enhanced SmartContract Labeling ---
    # Label contract-creation targets
    for entry in batch_normal:
        if entry['to_address'] == "contract_creation":
            set_node_label(driver, "contract_creation", "SmartContract")

    # Label all discovered contract addresses as SmartContract
    for addr in contract_addresses:
        if addr:
            set_node_label(driver, addr, "SmartContract")

    print(f"Saved {len(batch_normal)} normal, {len(batch_internal)} internal, "
          f"{len(batch_erc20)} ERC20, {len(batch_erc721)} ERC721, {len(batch_erc1155)} ERC1155 "
          f"transactions to Neo4j. Labeled {len(contract_addresses)} SmartContract nodes.")


def get_networkx_from_neo4j(driver):
    """Pulls the current Neo4j graph into a NetworkX DiGraph.

    Uses the repo's schema — coalesces eth_value, internal_value, and
    value_token so that all transaction types contribute to edge weights
    for the tracing heuristics.
    """
    query = """
    MATCH (s)-[r:TO]->(rec)
    WHERE s.eth_address IS NOT NULL AND rec.eth_address IS NOT NULL
    RETURN s.eth_address AS sender, rec.eth_address AS receiver,
           sum(coalesce(toFloat(r.eth_value), toFloat(r.internal_value), toFloat(r.value_token), 0.0)) AS total_amount
    """
    G = nx.DiGraph()
    with driver.session() as session:
        result = session.run(query)
        for record in result:
            G.add_edge(record["sender"], record["receiver"], weight=record["total_amount"])
    return G