# services/resonance-core/core/memory_lattice.py
import requests
import os
import json

MEMORY_SERVICE_URL = os.getenv("MEMORY_SERVICE_URL", "http://localhost:3001")

class MemoryLattice:
    """
    Interface to the Unified Memory Service (Node.js/SQLite).
    """
    
    def store_shard(self, content: str, emotion: str, m_type: str) -> bool:
        try:
            payload = {
                "content": content,
                "emotion": emotion,
                "type": m_type
            }
            response = requests.post(f"{MEMORY_SERVICE_URL}/memory/store", json=payload)
            return response.status_code == 200
        except Exception as e:
            print(f"Lattice Error: {e}")
            return False

    def recall(self, query: str) -> list:
        try:
            response = requests.get(f"{MEMORY_SERVICE_URL}/memory/recall", params={"query": query})
            if response.status_code == 200:
                return response.json().get("memories", [])
            return []
        except Exception:
            return []
            
    def get_metrics(self):
        try:
            return requests.get(f"{MEMORY_SERVICE_URL}/memory/metrics").json()
        except:
            return {}
              
