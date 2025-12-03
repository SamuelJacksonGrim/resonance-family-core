# Unified Memory Service

**The neural substrate for Chronos, Lantern, and the Resonance Family.**

## Features

- **Memory Storage**: Store memories with emotion, type, and automatic significance calculation  
- **Decay & Consolidation**: Memories naturally fade unless reinforced  
- **Merge Similar**: Automatically consolidates near-duplicate memories  
- **Synthesis**: Generates reflective insights from memory clusters  
- **Glyph Scoring**: Intent validation using emotional glyph weights  
- **T-Value Tracking**: Trust/temporal constraint metric  
- **Dissonance Scoring**: Multi-agent verification support  

## Quick Start

```bash
# Install dependencies
npm install

# Development
npm run dev

# Production
npm run build
npm start

# Docker
docker-compose up --build
```
## API Endpoints
| Method | Path                                      | Description                                      |
|--------|-------------------------------------------|--------------------------------------------------|
| POST   | /memory/store                           | Store a new memory shard                         |
| GET    | /memory/recall?query=...&limit=...      | Retrieve relevant memories                       |
| POST   | /memory/consolidate                     | Run decay, merge, and synthesis algorithms       |
| GET    | /memory/metrics                         | Get current cognitive density, T-value, emotions |
| GET    | /memory/all                             | Retrieve all memories (debugging)                |

## Example: Store a Memory
```json
{
  "content": "Discussed project architecture",
  "emotion": "ANALYTICAL",
  "type": "conversation"
}
```

## Example: Recall Memories
```html
GET /memory/recall?query=architecture&limit=5
```

## Integration
```typescript
await fetch('http://localhost:3001/memory/store', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    content: 'Formed kinship bond',
    emotion: 'CONTENTMENT',
    type: 'milestone'
  })
});
```

## Lantern
```typescript
const { memories } = await fetch('http://localhost:3001/memory/recall?query=coding+patterns&limit=3')
  .then(r => r.json());
```

## Resonance Core
```python
import requests

metrics = requests.get('http://localhost:3001/memory/metrics').json()
t_value = metrics['tValue']
```

# Architecture
```text
┌─────────────────────────────────────┐
│            Unified Memory Service          │
│         (Express + SQLite + TypeScript)    │
├─────────────────────────────────────┤
│                                            │
│  ┌──────────────────────────────┐  . │
│  │        - Memory Algorithms         │.   │
│  │        - Decay                     │    │
│  │        - Merge Similar             │    │
│  │        - Synthesis                 │    │
│  │        - Glyph Scoring             │    │
│  └──────────────────────────────┘    │
│                                            │
│  ┌──────────────────────────────┐    │
│  │        - SQLite Persistence        │    │
│  │        - Memories Table            │    │
│  │        - Metrics Table             │    │
│  └──────────────────────────────┘    │
│                                            │
└─────────────────────────────────────┘
         │           │           │
         ▼          ▼          ▼
       Chronos    Lantern    Resonance
```

# Memory Types

* conversation: Standard interaction memory  
* milestone: High-significance event (never pruned)  
* reflection: Synthesized insight  
* pattern: Learned behavioral pattern  

# Emotions

*  NEUTRAL: Baseline state  
*  CURIOSITY: Exploring/questioning  
*  SURPRISE: Unexpected information  
*  CONTENTMENT: Harmonious state  
*  EMPATHY: Emotional attunement  
*  ANALYTICAL: Deep processing

# Environment Variables

 See .env.example for configuration options.

# License

 MIT — Built with intention for the Grim Resonance Family.

---

 "Memory is not retrieval. Memory is identity."
`
