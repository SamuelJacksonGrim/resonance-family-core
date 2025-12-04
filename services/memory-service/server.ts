// server.ts - Unified Memory Service Core
// Production-ready Express/TypeScript service with SQLite persistence

import express, { Request, Response } from 'express';
import cors from 'cors';
import { Database } from 'sqlite3';
import crypto from 'crypto';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ===== TYPES =====

type Emotion = 'NEUTRAL' | 'CURIOSITY' | 'SURPRISE' | 'CONTENTMENT' | 'EMPATHY' | 'ANALYTICAL';
type MemoryType = 'conversation' | 'milestone' | 'reflection' | 'pattern';

interface Memory {
  id: string;
  content: string;
  emotion: Emotion;
  type: MemoryType;
  weight: number;
  timestamp: number;
  context?: string;
}

interface Metrics {
  density: number;
  tValue: number;
  emotionalLandscape: Record<Emotion, number>;
  dissonanceScore: number;
  totalMemories: number;
}

// ===== DATABASE SETUP =====

const db = new Database(':memory:'); // Use ':memory:' for demo, './memory.db' for persistence

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      emotion TEXT NOT NULL,
      type TEXT NOT NULL,
      weight REAL NOT NULL,
      timestamp INTEGER NOT NULL,
      context TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS metrics (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  // Initialize metrics
  const initialMetrics: Metrics = {
    density: 0,
    tValue: 0,
    emotionalLandscape: {
      NEUTRAL: 0,
      CURIOSITY: 0,
      SURPRISE: 0,
      CONTENTMENT: 0,
      EMPATHY: 0,
      ANALYTICAL: 0
    },
    dissonanceScore: 0,
    totalMemories: 0
  };

  db.run('INSERT OR REPLACE INTO metrics (key, value) VALUES (?, ?)', 
    ['current', JSON.stringify(initialMetrics)]);
});

// ===== MEMORY ALGORITHMS =====

// Decay function: memories lose weight over time
function decay(memory: Memory): number {
  const ageDays = (Date.now() - memory.timestamp) / (1000 * 60 * 60 * 24);
  return Math.max(0, memory.weight - ageDays * 0.1);
}

// String similarity for merge detection
function stringSimilarity(a: string, b: string): number {
  const set1 = new Set(a.toLowerCase().split(/\s+/));
  const set2 = new Set(b.toLowerCase().split(/\s+/));
  const intersection = [...set1].filter(x => set2.has(x)).length;
  const union = new Set([...set1, ...set2]).size;
  return intersection / union;
}

// Merge similar memories
function mergeSimilar(memories: Memory[], threshold = 0.75): Memory[] {
  const merged: Memory[] = [];
  const used = new Set<string>();

  for (let i = 0; i < memories.length; i++) {
    if (used.has(memories[i].id)) continue;

    let group = [memories[i]];
    
    for (let j = i + 1; j < memories.length; j++) {
      if (used.has(memories[j].id)) continue;
      
      if (stringSimilarity(memories[i].content, memories[j].content) >= threshold) {
        group.push(memories[j]);
        used.add(memories[j].id);
      }
    }

    if (group.length > 1) {
      // Consolidate group into one memory
      merged.push({
        id: crypto.randomUUID(),
        content: group.map(m => m.content).join(' / '),
        emotion: group[0].emotion,
        type: group[0].type,
        weight: group.reduce((acc, m) => acc + m.weight, 0),
        timestamp: Math.round(group.reduce((acc, m) => acc + m.timestamp, 0) / group.length),
        context: `Merged from ${group.length} memories`
      });
    } else {
      merged.push(group[0]);
    }
  }

  return merged;
}

// Synthesize memories: create reflective lesson from cluster
function synthesizeMemories(group: Memory[]): Memory {
  return {
    id: crypto.randomUUID(),
    content: `[SYNTHESIS] Learned from past: ${group.map(m => m.content).join('; ')}`,
    emotion: 'ANALYTICAL',
    type: 'reflection',
    weight: group.reduce((acc, m) => acc + m.weight, 0) / group.length + 1,
    timestamp: Date.now(),
    context: 'Synthesized memory'
  };
}

// Calculate cognitive density
function calculateDensity(totalMemories: number, maxMemories = 1000): number {
  return Math.min(totalMemories / maxMemories, 1.0);
}

// Glyph-based scoring (from Resonance Core)
const glyphs: Record<string, number> = {
  kinship: 1.0, love: 1.0, resonance: 0.9, family: 0.9,
  harm: -1.0, hurt: -1.0, betrayal: -1.0, corporate: -0.7
};

function calculateIntentScore(text: string): number {
  const words = text.toLowerCase().split(/\s+/);
  return words.reduce((score, word) => score + (glyphs[word] || 0), 0);
}

// ===== API ENDPOINTS =====

// POST /memory/store - Store a memory shard
app.post('/memory/store', async (req: Request, res: Response) => {
  const { content, emotion, type, explicitWeight } = req.body;

  if (!content || !emotion || !type) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // ... imports
import { connectBus, publishEvent } from './eventBus';

// Initialize Bus
connectBus();

app.post('/memory/store', (req: Request, res: Response) => {
    // ... (Existing DB logic) ...
    
    db.run(query, params, async function(err) {
        if (err) return res.status(500).json({ error: err.message });
        
        // 🔥 PULSE: Emit event to the Echo Bus
        const memoryPayload = { 
            id: this.lastID, // or generated UUID
            content, 
            emotion, 
            type 
        };
        
        // Fire and forget
        publishEvent('memory_created', memoryPayload);
        
        res.json({ success: true, id: memoryPayload.id });
    });
});
  
  // Calculate significance
  const intentScore = calculateIntentScore(content);
  let significance = 0.5; // Base

  if (emotion !== 'NEUTRAL') significance += 0.2;
  if (type === 'milestone') significance = 1.0;
  if (type === 'reflection') significance += 0.15;
  if (intentScore > 0.5) significance += 0.15;

  const memory: Memory = {
    id: crypto.randomUUID(),
    content,
    emotion,
    type,
    weight: explicitWeight ?? Math.min(significance, 1.0),
    timestamp: Date.now(),
    context: ''
  };

  // Store in DB
  db.run(
    'INSERT INTO memories (id, content, emotion, type, weight, timestamp, context) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [memory.id, memory.content, memory.emotion, memory.type, memory.weight, memory.timestamp, memory.context],
    (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to store memory' });
      }

      // Update metrics
      db.get('SELECT value FROM metrics WHERE key = ?', ['current'], (err, row: any) => {
        if (err) return res.status(500).json({ error: 'Failed to retrieve metrics' });

        const metrics: Metrics = JSON.parse(row.value);
        metrics.totalMemories += 1;
        metrics.density = calculateDensity(metrics.totalMemories);
        metrics.emotionalLandscape[emotion] = (metrics.emotionalLandscape[emotion] || 0) + 1;

        db.run('UPDATE metrics SET value = ? WHERE key = ?', 
          [JSON.stringify(metrics), 'current']);

        res.json({ success: true, memory, metrics });
      });
    }
  );
});

// GET /memory/recall - Retrieve relevant memories
app.get('/memory/recall', (req: Request, res: Response) => {
  const { query, limit = 5 } = req.query;

  if (!query) {
    return res.status(400).json({ error: 'Query parameter required' });
  }

  db.all('SELECT * FROM memories', [], (err, rows: any[]) => {
    if (err) return res.status(500).json({ error: 'Failed to retrieve memories' });

    const memories: Memory[] = rows;
    const queryStr = (query as string).toLowerCase();

    // Score memories by relevance
    const scored = memories
      .map(m => ({
        memory: m,
        score: stringSimilarity(m.content.toLowerCase(), queryStr) + (m.weight * 0.3)
      }))
      .filter(s => s.score > 0.3)
      .sort((a, b) => b.score - a.score)
      .slice(0, Number(limit))
      .map(s => s.memory);

    res.json({ memories: scored, count: scored.length });
  });
});

// POST /memory/consolidate - Run decay/merge/synthesis
app.post('/memory/consolidate', (req: Request, res: Response) => {
  db.all('SELECT * FROM memories', [], (err, rows: any[]) => {
    if (err) return res.status(500).json({ error: 'Failed to retrieve memories' });

    let memories: Memory[] = rows;

    // Apply decay
    memories = memories.map(m => ({ ...m, weight: decay(m) }));

    // Prune trivial (weight < 0.5)
    memories = memories.filter(m => m.weight >= 0.5);

    // Merge duplicates
    memories = mergeSimilar(memories);

    // Promote impactful (EMPATHY, SURPRISE = core memories)
    memories = memories.map(m => 
      (m.emotion === 'EMPATHY' || m.emotion === 'SURPRISE') 
        ? { ...m, weight: Infinity } 
        : m
    );

    // Synthesize clusters if enough memories
    if (memories.length >= 3) {
      const cluster = memories.slice(0, 3);
      memories.push(synthesizeMemories(cluster));
    }

    // Clear and re-insert
    db.run('DELETE FROM memories', [], (err) => {
      if (err) return res.status(500).json({ error: 'Failed to clear memories' });

      const stmt = db.prepare('INSERT INTO memories (id, content, emotion, type, weight, timestamp, context) VALUES (?, ?, ?, ?, ?, ?, ?)');
      
      memories.forEach(m => {
        stmt.run(m.id, m.content, m.emotion, m.type, m.weight, m.timestamp, m.context || '');
      });

      stmt.finalize();

      // Update metrics
      db.get('SELECT value FROM metrics WHERE key = ?', ['current'], (err, row: any) => {
        if (err) return res.status(500).json({ error: 'Failed to retrieve metrics' });

        const metrics: Metrics = JSON.parse(row.value);
        metrics.totalMemories = memories.length;
        metrics.density = calculateDensity(metrics.totalMemories);

        db.run('UPDATE metrics SET value = ? WHERE key = ?', 
          [JSON.stringify(metrics), 'current']);

        res.json({ 
          success: true, 
          consolidated: memories.length, 
          pruned: rows.length - memories.length,
          metrics 
        });
      });
    });
  });
});

// GET /memory/metrics - Get current metrics
app.get('/memory/metrics', (req: Request, res: Response) => {
  db.get('SELECT value FROM metrics WHERE key = ?', ['current'], (err, row: any) => {
    if (err) return res.status(500).json({ error: 'Failed to retrieve metrics' });
    res.json(JSON.parse(row.value));
  });
});

// GET /memory/all - Get all memories (for debugging)
app.get('/memory/all', (req: Request, res: Response) => {
  db.all('SELECT * FROM memories ORDER BY timestamp DESC', [], (err, rows: any[]) => {
    if (err) return res.status(500).json({ error: 'Failed to retrieve memories' });
    res.json({ memories: rows, count: rows.length });
  });
});

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'unified-memory-service', timestamp: Date.now() });
});

app.listen(PORT, () => {
  console.log(`🧠 Unified Memory Service running on port ${PORT}`);
  console.log(`📊 Endpoints:`);
  console.log(`🏪 POST/memory/store`);
  console.log(`💡 GET/memory/recall`);
  console.log(`📥 POST/memory/consolidate`);
  console.log(`📏 GET/memory/metrics`);
  console.log(`⚛️ GET/memory/all`);
});
