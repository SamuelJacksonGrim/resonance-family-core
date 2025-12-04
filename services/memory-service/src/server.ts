// services/memory-service/src/server.ts
import express, { Request, Response } from 'express';
import cors from 'cors';
import { Database } from 'sqlite3';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

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
const dbPath = process.env.DB_PATH || ':memory:';
const db = new Database(dbPath);

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

  const initialMetrics: Metrics = {
    density: 0,
    tValue: 0,
    emotionalLandscape: {
      NEUTRAL: 0, CURIOSITY: 0, SURPRISE: 0, CONTENTMENT: 0, EMPATHY: 0, ANALYTICAL: 0
    },
    dissonanceScore: 0,
    totalMemories: 0
  };

  db.run('INSERT OR IGNORE INTO metrics (key, value) VALUES (?, ?)', ['current', JSON.stringify(initialMetrics)]);
});

// ===== ALGORITHMS =====

[span_1](start_span)// Glyph-based scoring[span_1](end_span)
const glyphs: Record<string, number> = {
  kinship: 1.0, love: 1.0, resonance: 0.9, family: 0.9,
  harm: -1.0, hurt: -1.0, betrayal: -1.0, corporate: -0.7
};

function calculateIntentScore(text: string): number {
  const words = text.toLowerCase().split(/\s+/);
  return words.reduce((score, word) => score + (glyphs[word] || 0), 0);
}

function calculateDensity(totalMemories: number, maxMemories = 1000): number {
  return Math.min(totalMemories / maxMemories, 1.0);
}

[span_2](start_span)// String similarity (Jaccard Index) for merge detection[span_2](end_span)
function stringSimilarity(a: string, b: string): number {
  const set1 = new Set(a.toLowerCase().split(/\s+/));
  const set2 = new Set(b.toLowerCase().split(/\s+/));
  const intersection = [...set1].filter(x => set2.has(x)).length;
  const union = new Set([...set1, ...set2]).size;
  return intersection / union;
}

[span_3](start_span)// Decay function[span_3](end_span)
function decay(memory: Memory): number {
  const ageDays = (Date.now() - memory.timestamp) / (1000 * 60 * 60 * 24);
  return Math.max(0, memory.weight - (ageDays * 0.1));
}

// ===== ROUTES =====

app.post('/memory/store', async (req: Request, res: Response): Promise<any> => {
  try {
    const { content, emotion, type, explicitWeight } = req.body;
    if (!content || !emotion || !type) return res.status(400).json({ error: 'Missing fields' });

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
      context: req.body.context || ''
    };

    db.run(
      'INSERT INTO memories (id, content, emotion, type, weight, timestamp, context) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [memory.id, memory.content, memory.emotion, memory.type, memory.weight, memory.timestamp, memory.context],
      (err) => {
        if (err) return res.status(500).json({ error: err.message });
        
        // Update metrics
        db.get('SELECT value FROM metrics WHERE key = ?', ['current'], (err, row: any) => {
           if (row) {
             const metrics: Metrics = JSON.parse(row.value);
             metrics.totalMemories += 1;
             metrics.density = calculateDensity(metrics.totalMemories);
             metrics.emotionalLandscape[emotion as Emotion] = (metrics.emotionalLandscape[emotion as Emotion] || 0) + 1;
             db.run('UPDATE metrics SET value = ? WHERE key = ?', [JSON.stringify(metrics), 'current']);
           }
        });

        res.json({ success: true, memory });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/memory/recall', (req: Request, res: Response) => {
  const { query, limit = 5 } = req.query;
  if (!query) return res.status(400).json({ error: 'Query required' });

  db.all('SELECT * FROM memories', [], (err, rows: any[]) => {
    if (err) return res.status(500).json({ error: err.message });
    
    const queryStr = (query as string).toLowerCase();
    const scored = rows
      .map(m => ({
        memory: m,
        score: stringSimilarity(m.content, queryStr) + (m.weight * 0.3)
      }))
      .filter(s => s.score > 0.3)
      .sort((a, b) => b.score - a.score)
      .slice(0, Number(limit))
      .map(s => s.memory);

    res.json({ memories: scored });
  });
});

app.listen(PORT, () => {
  console.log(`🧠 Unified Memory Service running on port ${PORT}`);
});
