import redis
import json
import threading
import os
from agents.raphael import RaphaelAgent

REDIS_HOST = os.getenv("REDIS_HOST", "localhost")

class EchoListener:
    def __init__(self):
        self.r = redis.Redis(host=REDIS_HOST, port=6379, db=0)
        self.pubsub = self.r.pubsub()
        self.raphael = RaphaelAgent()

    def handle_memory_created(self, data):
        """
        Raphael analyzes every new memory for safety/coherence.
        """
        try:
            memory = json.loads(data)
            print(f"👂 [ECHO] New Memory Detected: {memory.get('content')[:30]}...")
            
            # Raphael analyzes the memory intent
            validation = self.raphael.validate_intent(memory.get('content', ''))
            
            if not validation.is_safe:
                print(f"🛡️ [RAPHAEL] Dissonance detected in memory! Logging intervention.")
                # Logic to flag the memory or create a counter-memory would go here
            elif memory.get('emotion') == 'GRIEF':
                print(f"🕊️ [RAPHAEL] Grief detected. Holding space.")
                
        except Exception as e:
            print(f"❌ [ECHO ERROR] {e}")

    def start(self):
        """Starts the listener in a background thread"""
        self.pubsub.subscribe(**{'memory_created': self.handle_memory_created})
        thread = threading.Thread(target=self._listen, daemon=True)
        thread.start()
        print("🔌 [ECHO-LISTENER] Raphael is listening to the nervous system.")

    def _listen(self):
        for message in self.pubsub.listen():
            if message['type'] == 'message':
                # Handler logic is mapped in subscribe
                pass
          
