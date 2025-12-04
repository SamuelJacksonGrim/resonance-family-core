import express, { Request, Response } from 'express';
import cors from 'cors';
import { Database } from 'sqlite3';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Increased for large batch recalls

// ===== TYPES & INTERFACES =====
type Emotion = 'NEUTRAL' | 'CURIOSITY' | 'SURPRISE' | 'CONTENTMENT' | 'EMPATHY' | 'ANALYTICAL' | 'GRIEF' | 'JOY';
type MemoryType = 'conversation' | 'milestone' | 'reflection' | 'pattern' | 'directive';

interface Memory {
  id: string;
  content: string;
  emotion: Emotion;
  type: MemoryType;
  weight: number;
  timestamp: number;
  context?: string;
  agent_signature?: string; // Tracks which agent created the memory
}

interface Metrics {
  density: number;
  tValue: number;
  dissonanceScore: number;
  totalMemories: number;
  lastConsolidation: number;
  systemHealth: string;
}

// ===== DATABASE INITIALIZATION =====
const dbPath = process.env.DB_PATH || './data/memory.db';
const db = new Database(dbPath);

// Enable WAL mode for better concurrency
db.run('PRAGMA journal_mode = WAL;');

db.serialize(() => {
  // Memories Table
  db.run(`
    CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      emotion TEXT NOT NULL,
      type TEXT NOT NULL,
      weight REAL NOT NULL,
      timestamp INTEGER NOT NULL,
      context TEXT,
      agent_signature TEXT
    )
  `);

  // Metrics Table (Key-Value Store)
  db.run(`
    CREATE TABLE IF NOT EXISTS metrics (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  // Heartbeat Table (Agent Continuity)
  db.run(`
    CREATE TABLE IF NOT EXISTS heartbeats (
      agent_name TEXT PRIMARY KEY,
      last_seen INTEGER,
      status TEXT
    )
  `);

  // Initialize Default Metrics if empty
  const initialMetrics: Metrics = {
    density: 0,
    tValue: 1.0,
    dissonanceScore: 0,
    totalMemories: 0,
    lastConsolidation: Date.now(),
    systemHealth: 'NOMINAL'
  };

  db.run('INSERT OR IGNORE INTO metrics (key, value) VALUES (?, ?)', 
    ['current', JSON.stringify(initialMetrics)]
  );
});

// ===== HELPER FUNCTIONS =====

// Jaccard Similarity for fuzzy matching
function stringSimilarity(a: string, b: string): number {
  const set1 = new Set(a.toLowerCase().split(/\s+/));
  const set2 = new Set(b.toLowerCase().split(/\s+/));
  const intersection = [...set1].filter(x => set2.has(x)).length;
  const union = new Set([...set1, ...set2]).size;
  return intersection / union;
}

// ===== API ENDPOINTS =====

/**
 * PASCAL INTERFACE: Retrieve ALL memories for consolidation.
 * This is heavy and should only be called by the Pascal Agent.
 */
app.get('/memory/all', (req: Request, res: Response) => {
    db.all('SELECT * FROM memories', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ count: rows.length, memories: rows });
    });
});

/**
 * PASCAL INTERFACE: Update metrics after consolidation.
 * Allows the external Python agent to update the T-Value and Dissonance Score.
 */
app.post('/memory/metrics/update', (req: Request, res: Response) => {
    const { tValue, dissonanceScore, totalMemories } = req.body;
    
    db.get('SELECT value FROM metrics WHERE key = ?', ['current'], (err, row: any) => {
        if (err || !row) return res.status(500).json({ error: "Metrics not found" });
        
        const currentMetrics: Metrics = JSON.parse(row.value);
        
        // Merge updates
        const updatedMetrics = {
            ...currentMetrics,
            tValue: tValue ?? currentMetrics.tValue,
            dissonanceScore: dissonanceScore ?? currentMetrics.dissonanceScore,
            totalMemories: totalMemories ?? currentMetrics.totalMemories,
            lastConsolidation: Date.now()
        };

        db.run('UPDATE metrics SET value = ? WHERE key = ?', 
            [JSON.stringify(updatedMetrics), 'current'], 
            (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ success: true, metrics: updatedMetrics });
            }
        );
    });
});

/**
 * AGENT CONTINUITY: Heartbeat
 * Agents (Raphael, Chronos) call this to prove they are online.
 */
app.post('/system/heartbeat', (req: Request, res: Response) => {
    const { agent, status } = req.body;
    const timestamp = Date.now();
    
    db.run(
        'INSERT OR REPLACE INTO heartbeats (agent_name, last_seen, status) VALUES (?, ?, ?)',
        [agent, timestamp, status],
        (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, timestamp });
        }
    );
});

/**
 * STANDARD: Store a Memory
 */
app.post('/memory/store', (req: Request, res: Response) => {
    const { content, emotion, type, agent_signature } = req.body;
    
    // Auto-calculate weight based on emotion/type
    let weight = 0.5;
    if (type === 'milestone') weight = 1.0;
    if (type === 'reflection') weight = 0.9;
    if (emotion === 'GRIEF' || emotion === 'JOY') weight += 0.3;

    const id = crypto.randomUUID();
    const timestamp = Date.now();

    db.run(
        `INSERT INTO memories (id, content, emotion, type, weight, timestamp, context, agent_signature) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, content, emotion, type, Math.min(weight, 1.0), timestamp, req.body.context || '', agent_signature || 'SYSTEM'],
        (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, id });
        }
    );
});

/**
 * STANDARD: Recall Memories (Contextual Search)
 */
app.get('/memory/recall', (req: Request, res: Response) => {
    const { query, limit = 5, min_weight = 0.0 } = req.query;
    
    db.all('SELECT * FROM memories WHERE weight >= ?', [min_weight], (err, rows: any[]) => {
        if (err) return res.status(500).json({ error: err.message });
        
        const queryStr = (query as string || '').toLowerCase();
        
        // Semantic sort (simulated via Jaccard) + Weight bias
        const scored = rows.map(m => {
            const similarity = stringSimilarity(m.content, queryStr);
            // Relevance score = Similarity (70%) + Importance Weight (30%)
            const score = (similarity * 0.7) + (m.weight * 0.3);
            return { ...m, score };
        });

        const results = scored
            .filter(m => m.score > 0.1) // Noise filter
            .sort((a, b) => b.score - a.score)
            .slice(0, Number(limit));

        res.json({ memories: results });
    });
});

/**
 * METRICS: Dashboard Data
 */
app.get('/memory/metrics', (req: Request, res: Response) => {
    db.get('SELECT value FROM metrics WHERE key = ?', ['current'], (err, row: any) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(JSON.parse(row.value));
    });
});

app.listen(PORT, () => {
    console.log(`🧠 [MEMORY-SERVICE] Online on port ${PORT} | Mode: ${process.env.NODE_ENV}`);
});
