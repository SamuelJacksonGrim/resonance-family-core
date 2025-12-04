# algorithms/memory-consolidation/pascal_synthesizer.py

import requests
import json
import time
from datetime import datetime
from collections import Counter
from typing import List, Dict

# Configuration - should be loaded from environment variables
MEMORY_SERVICE_URL = "http://localhost:3001" 
SYNTHESIS_THRESHOLD = 0.8  # Jaccard similarity threshold for merging
DECAY_RATE_PER_DAY = 0.1
MAX_MEMORY_AGE_DAYS = 365

def fetch_all_memories() -> List[Dict]:
    """Retrieves all memories from the Unified Memory Service."""
    try:
        response = requests.get(f"{MEMORY_SERVICE_URL}/memory/all")
        response.raise_for_status()
        return response.json().get('memories', [])
    except Exception as e:
        print(f"Error fetching memories: {e}")
        return []

def decay_memory_weight(memory: Dict) -> float:
    """Applies time-based decay, preserving 'milestone' memories."""
    if memory.get('type') == 'milestone':
        return memory['weight']
        
    age_seconds = (time.time() * 1000) - memory['timestamp']
    age_days = age_seconds / (1000 * 60 * 60 * 24)
    
    # Calculate new weight with a floor of 0.1 for non-milestones
    new_weight = max(0.1, memory['weight'] - (age_days * DECAY_RATE_PER_DAY))
    return new_weight

def calculate_dissonance_score(memories: List[Dict]) -> float:
    """Calculates Dissonance based on conflicting glyph scores."""
    # Simplified calculation: sum of negative glyph scores normalized by total memories
    negative_scores = sum(m.get('intentScore', 0) for m in memories if m.get('intentScore', 0) < 0)
    total_memories = len(memories)
    
    if total_memories == 0:
        return 0.0
        
    # Return a score between 0 and 1, where 1 is max dissonance
    return min(1.0, abs(negative_scores) / total_memories * 5.0)

def calculate_t_value(memories: List[Dict]) -> float:
    """Calculates Temporal Integrity Value (T-Value) based on age and weight."""
    total_weight = sum(m['weight'] for m in memories)
    
    # Prioritize recent, high-weight memories
    average_age = sum((time.time() * 1000 - m['timestamp']) for m in memories) / (len(memories) or 1)
    
    # Normalize by max possible weight and age
    T_VALUE_FACTOR = 0.5 * (total_weight / (len(memories) or 1)) 
    
    # Age penalty: older memory pool reduces T-Value
    age_penalty = min(1.0, average_age / (MAX_MEMORY_AGE_DAYS * 1000 * 60 * 60 * 24))
    
    return max(0.0, T_VALUE_FACTOR * (1.0 - age_penalty))


def synthesize_reflections(memories: List[Dict]) -> List[Dict]:
    """Identifies highly weighted, non-milestone memories and synthesizes a reflection."""
    high_weight_memories = sorted([
        m for m in memories 
        if m['type'] != 'milestone' and m['weight'] >= 0.7
    ], key=lambda x: x['weight'], reverse=True)
    
    if len(high_weight_memories) < 3:
        return []
    
    # Find the most frequent emotion and content keyword
    emotions = Counter(m['emotion'] for m in high_weight_memories)
    most_common_emotion = emotions.most_common(1)[0][0]

    # Create a conceptual summary
    summary_contents = [m['content'].split('.')[0] for m in high_weight_memories[:5]]
    reflection_content = f"Synthesized insight based on {len(high_weight_memories)} shards: Recurrent themes include {', '.join(set(summary_contents))}."
    
    reflection = {
        "content": reflection_content,
        "emotion": most_common_emotion,
        "type": "reflection",
        "explicitWeight": 0.95, # High weight for synthesized insight
    }
    
    return [reflection]

def run_pascal_synthesizer():
    """Main execution function for the Pascal Synthesizer."""
    print(f"[{datetime.now().isoformat()}] Pascal Synthesizer: Beginning consolidation...")
    
    memories = fetch_all_memories()
    if not memories:
        print("No memories to process. Exiting.")
        return

    # 1. Decay Weights & Identify for Pruning (Simulated Update/Pruning)
    updated_memories = []
    memories_to_prune = []
    
    for memory in memories:
        new_weight = decay_memory_weight(memory)
        memory['weight'] = new_weight
        
        # In a real system, you would send an API call to update the memory's weight
        # Example API call (simulated): requests.put(f"{MEMORY_SERVICE_URL}/memory/update/{memory['id']}", json={"weight": new_weight})
        updated_memories.append(memory)
        
        if new_weight < 0.1 and memory['type'] not in ['milestone', 'reflection']:
            memories_to_prune.append(memory['id'])
    
    # 2. Synthesis & Reflection Generation
    new_reflections = synthesize_reflections(updated_memories)
    for reflection in new_reflections:
        # Send new reflection to memory service
        requests.post(f"{MEMORY_SERVICE_URL}/memory/store", json=reflection)
        print(f"-> New Reflection synthesized: {reflection['content'][:50]}...")
        
    # 3. Metric Calculation
    dissonance_score = calculate_dissonance_score(updated_memories)
    t_value = calculate_t_value(updated_memories)

    # 4. Update Metrics (Simulated API call for robustness)
    metrics_update = {
        "tValue": t_value,
        "dissonanceScore": dissonance_score,
        "totalMemories": len(updated_memories) + len(new_reflections),
    }
    
    # A dedicated endpoint is needed in the Memory Service for this: POST /memory/metrics/update
    # requests.post(f"{MEMORY_SERVICE_URL}/memory/metrics/update", json=metrics_update)

    print(f"[{datetime.now().isoformat()}] Consolidation Complete.")
    print(f"   - T-Value (Temporal Integrity): {t_value:.4f}")
    print(f"   - Dissonance Score: {dissonance_score:.4f}")
    print(f"   - New Reflections: {len(new_reflections)}")
    print(f"   - Memories Pruned (Simulated): {len(memories_to_prune)}")

if __name__ == "__main__":
    run_pascal_synthesizer()
      
