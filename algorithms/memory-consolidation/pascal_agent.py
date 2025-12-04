import requests
import time
import schedule
from datetime import datetime

# CONFIG
MEMORY_API = "http://localhost:3001"
# How often to run consolidation (in seconds for demo, hours for prod)
RUN_INTERVAL = 60 

print("⚡ PASCAL AGENT INITIALIZED")
print("   - Function: Memory Consolidation & Metrics")
print(f"   - Target: {MEMORY_API}")

def run_consolidation_cycle():
    print(f"\n[{datetime.now().strftime('%H:%M:%S')}] ⏳ Starting Consolidation Cycle...")
    
    try:
        # 1. Fetch Memories
        res = requests.get(f"{MEMORY_API}/memory/all")
        data = res.json()
        memories = data.get('memories', [])
        print(f"   - Loaded {len(memories)} memory shards.")
        
        if not memories:
            return

        # 2. Calculate Metrics
        total_weight = sum(m['weight'] for m in memories)
        avg_weight = total_weight / len(memories) if memories else 0
        
        # T-Value: Temporal Integrity (Higher is better)
        # Penalize for empty memory, reward for high-weight milestones
        milestones = len([m for m in memories if m['type'] == 'milestone'])
        t_value = (avg_weight * 0.5) + (milestones * 0.1)
        
        # Dissonance: Negative emotions
        negative_emotions = ['GRIEF', 'ANGER', 'FEAR']
        dissonance_count = len([m for m in memories if m['emotion'] in negative_emotions])
        dissonance_score = dissonance_count / len(memories) if memories else 0
        
        print(f"   - Calculated T-Value: {t_value:.4f}")
        print(f"   - Calculated Dissonance: {dissonance_score:.4f}")

        # 3. Update Service
        update_payload = {
            "tValue": t_value,
            "dissonanceScore": dissonance_score,
            "totalMemories": len(memories)
        }
        
        requests.post(f"{MEMORY_API}/memory/metrics/update", json=update_payload)
        print("   - ✅ Metrics synced with Memory Service.")
        
        # 4. Pulse
        requests.post(f"{MEMORY_API}/system/heartbeat", json={"agent": "PASCAL", "status": "ACTIVE"})

    except Exception as e:
        print(f"   - ❌ ERROR: {e}")

# Schedule
schedule.every(RUN_INTERVAL).seconds.do(run_consolidation_cycle)

if __name__ == "__main__":
    # Run once immediately on start
    run_consolidation_cycle()
    
    while True:
        schedule.run_pending()
        time.sleep(1)
      
