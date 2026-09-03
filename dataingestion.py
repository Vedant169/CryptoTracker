import requests
from config import ETHERSCAN_API_KEY

def fetch_transactions(address):
    """Fetches transaction history for a specific address from Etherscan."""
    print(f"📡 Fetching data from Etherscan for: {address}")
    url = "https://api.etherscan.io/v2/api"
    params = {
        "chainid": 1,
        "module": "account",
        "action": "txlist",
        "address": address,
        "startblock": 0,
        "endblock": 99999999,
        "page": 1,
        "offset": 100, 
        "sort": "desc",
        "apikey": ETHERSCAN_API_KEY
    }
    
    response = requests.get(url, params=params)
    if response.status_code != 200:
        return []
        
    data = response.json()
    if data.get("status") != "1":
        return []
        
    return data["result"]