import requests
from config import ETHERSCAN_API_KEY


def _call_etherscan(address, action):
    """Internal helper that hits a single Etherscan endpoint."""
    url = "https://api.etherscan.io/v2/api"
    params = {
        "chainid": 1,
        "module": "account",
        "action": action,
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


def fetch_transactions(address):
    """Fetches Normal, Internal, ERC20, ERC721, and ERC1155 token transactions for a wallet."""
    print(f"Fetching transaction data from Etherscan for: {address}")

    normal_txs = _call_etherscan(address, "txlist")
    internal_txs = _call_etherscan(address, "txlistinternal")
    erc20_txs = _call_etherscan(address, "tokentx")
    erc721_txs = _call_etherscan(address, "tokennfttx")
    erc1155_txs = _call_etherscan(address, "token1155tx")

    print(f"  Retrieved {len(normal_txs)} normal, {len(internal_txs)} internal, "
          f"{len(erc20_txs)} ERC20, {len(erc721_txs)} ERC721, {len(erc1155_txs)} ERC1155 transactions.")
    return {
        "normal": normal_txs,
        "internal": internal_txs,
        "erc20": erc20_txs,
        "erc721": erc721_txs,
        "erc1155": erc1155_txs
    }