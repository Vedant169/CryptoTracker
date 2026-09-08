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


if __name__ == "__main__":
    VICTIM_WALLET = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
    trace_funds(VICTIM_WALLET, max_depth=3)