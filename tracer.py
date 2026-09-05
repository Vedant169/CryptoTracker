import time
from collections import deque
from config import KNOWN_VASPS
from dataingestion import fetch_transactions
from db_connect import get_db_driver, store_in_neo4j, get_networkx_from_neo4j
from logic import check_for_vasp, detect_next_suspicious_wallets

def trace_funds(initial_victim, max_depth=3):
    """The main loop that controls fetching, storing, and analyzing."""
    driver = get_db_driver()
    if not driver:
        return

    queue = deque([(initial_victim.lower(), 0)])
    visited = set()

    print(f"🚀 Starting Automated Trace for Victim: {initial_victim}")

    while queue:
        current_wallet, depth = queue.popleft()
        
        if depth > max_depth:
            print(f"🛑 Reached max depth ({max_depth}) on branch {current_wallet}. Stopping branch.")
            continue
            
        if current_wallet in visited:
            continue
            
        visited.add(current_wallet)
        print(f"\n--- Investigating (Depth {depth}): {current_wallet} ---")

        # 1. Ingest Data
        tx_data = fetch_transactions(current_wallet)
        
        # 2. Store in Neo4j
        store_in_neo4j(driver, tx_data)
        
        # 3. Sync Graph for Analysis
        G = get_networkx_from_neo4j(driver)
        
        # 4. Run DSA logic (Check if hit VASP)
        if check_for_vasp(G, initial_victim):
            print("\n✅ Trace Complete. Exchange identified.")
            driver.close()
            return

        # 5. Heuristic Analysis (Find next hops)
        next_targets = detect_next_suspicious_wallets(G, current_wallet)
        
        for target in next_targets:
            if target not in visited and target not in [v.lower() for v in KNOWN_VASPS]:
                print(f"🕵️‍♂️ Identified suspicious hop: {target}")
                queue.append((target, depth + 1))
                
        # Respect API rate limits
        time.sleep(0.5)

    print("\n⚠️ Trace finished. Max depth reached or trail went cold.")
    driver.close()

if __name__ == "__main__":
    VICTIM_WALLET = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e" 
    trace_funds(VICTIM_WALLET, max_depth=3)