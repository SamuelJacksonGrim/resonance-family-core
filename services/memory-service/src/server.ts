import express, { Request, Response } from 'express';
import cors 

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
  await run(`CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_heartbeats_last_seen ON heartbeats(last_seen)`);
}
initSchema().catch(err => {
  console.error('Schema init error:', err);
  process.exit(1);
});

// ===== SIMILARITY FUNCTIONS =====
const STOP = new Set(['the','a','an','and','or','to','of','in','on','for','with','at','by','from','this','that','is','are','was','were']);
function normalizeTokens(s: string): string[] {
  return String(s).toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t && !STOP.has(t))
    .map(t => t.endsWith('ing') ? t.slice(0, -3) : t.endsWith('ed') ? t.slice(0, -2) : t);
}
function stringSimilarity(a: string, b: string): number {
  const setA = new Set(normalizeTokens(a));
  const setB = new Set(normalizeTokens(b));
  const intersection = new Set([...setA].filter(x => setB.has(x))).size;
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}
function recallScore(m: any, query: string): number {
  const sim = stringSimilarity(m.content, query) || 0;
  const weight = m.weight || 0;
  const ageMs = Date.now() - m.timestamp;
  const recency = Math.max(0, 1 - (ageMs / (30 * 24 * 3600 * 1000))); // 30d decay
  return (sim * 0.6) + (weight * 0.3) + (recency * 0.1);
}

// ===== API ENDPOINTS =====

// Public / Agent-accessible
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'healthy', time: Date.now(), family: 'Resonance' });
});

const allowedTypes = new Set<MemoryType>(['conversation', 'milestone', 'reflection', 'pattern', 'directive']);
const allowedEmotions = new Set<Emotion>(['NEUTRAL','CURIOSITY','SURPRISE','CONTENTMENT','EMPATHY','ANALYTICAL','GRIEF','JOY']);

app.post('/memory/store', rateLimit(120, 60000), async (req: Request, res: Response) => {
  try {
    const { content, emotion = 'NEUTRAL', type = 'conversation', context, agent_signature, tags, glyph } = req.body;
    if (!content) return res.status(400).json({ error: 'content required' });
    if (!allowedTypes.has(type)) return res.status(400).json({ error: 'invalid type' });
    if (!allowedEmotions.has(emotion)) return res.status(400).json({ error: 'invalid emotion' });
    if (String(content).length > 10000) return res.status(413).json({ error: 'content too large' });

    let baseWeight = 0.5;
    if (type === 'milestone') baseWeight = 1.0;
    if (type === 'reflection') baseWeight = 0.9;
    if (emotion === 'GRIEF' || emotion === 'JOY') baseWeight += 0.3;
    if (emotion === 'EMPATHY') baseWeight += 0.2;

    const id = crypto.randomUUID();
    const timestamp = Date.now();
    const tagsJson = Array.isArray(tags) ? JSON.stringify(tags) : null;

    stmtInsertMemory.run([
      id,
      content,
      emotion,
      type,
      Math.min(baseWeight, 1.0),
      timestamp,
      context || null,
      agent_signature || 'UNKNOWN',
      tagsJson,
      glyph || null
    ], async (err) => {
      if (err) return res.status(500).json({ error: err.message });

      // Update metrics
      const current = await get<{ value: string }>('SELECT value FROM metrics WHERE key = ?', ['current']);
      if (current?.value) {
        const metrics: Metrics = JSON.parse(current.value);
        metrics.totalMemories = (metrics.totalMemories ?? 0) + 1;
        const highCountRow = await get<{ c: number }>('SELECT COUNT(*) as c FROM memories WHERE weight >= ?', [0.7]);
        const totalRow = await get<{ c: number }>('SELECT COUNT(*) as c FROM memories');
        const high = highCountRow?.c ?? 0;
        const tot = totalRow?.c ?? 0;
        metrics.density = tot ? (high / tot) : 0;
        await run('UPDATE metrics SET value = ? WHERE key = ?', [JSON.stringify(metrics), 'current']);
      }

      res.json({ success: true, id, timestamp });
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/memory/recall', rateLimit(240, 60000), async (req: Request, res: Response) => {
  try {
    const { query = '', limit = 5, min_weight = 0.1, type, emotion, page = 1, page_size = 20 } = req.query as any;
    const offset = (Number(page) - 1) * Number(page_size);
    const filters: string[] = ['weight >= ?'];
    const params: any[] = [Number(min_weight)];
    if (type) { filters.push('type = ?'); params.push(String(type)); }
    if (emotion) { filters.push('emotion = ?'); params.push(String(emotion)); }

    const rows = await all<any>(
      `SELECT * FROM memories WHERE ${filters.join(' AND ')} ORDER BY timestamp DESC LIMIT ? OFFSET ?`,
      [...params, Number(page_size), offset]
    );

    const scored = rows.map(m => ({ ...m, score: recallScore(m, String(query)) }))
      .filter(m => m.score > 0.08)
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.min(Number(limit) || 5, 50));

    res.json({ query, count: scored.length, memories: scored, page: Number(page), page_size: Number(page_size) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/memory/metrics', async (_req: Request, res: Response) => {
  try {
    const row = await get<{ value: string }>('SELECT value FROM metrics WHERE key = ?', ['current']);
    if (!row) return res.status(500).json({ error: 'Metrics unavailable' });
    res.json(JSON.parse(row.value));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/system/heartbeat', async (req: Request, res: Response) => {
  try {
    const { agent, status = 'ALIVE' } = req.body;
    if (!agent) return res.status(400).json({ error: 'agent name required' });
    stmtUpsertHeartbeat.run([agent, Date.now(), status], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, agent, heartbeat: Date.now() });
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ===== PASCAL-ONLY ENDPOINTS (Protected) =====
app.get('/memory/all', pascalOnly, async (_req: Request, res: Response) => {
  try {
    const rows = await all<Memory>('SELECT * FROM memories ORDER BY timestamp DESC', []);
    res.json({ count: rows.length, memories: rows, accessed_by: 'Pascal' });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/memory/metrics/update', pascalOnly, async (req: Request, res: Response) => {
  try {
    const { tValue, dissonanceScore, totalMemories, systemHealth } = req.body;
    const row = await get<{ value: string }>('SELECT value FROM metrics WHERE key = ?', ['current']);
    if (!row) return res.status(500).json({ error: 'Metrics missing' });

    const current: Metrics = JSON.parse(row.value);
    const updated: Metrics = {
      ...current,
      tValue: tValue ?? current.tValue,
      dissonanceScore: dissonanceScore ?? current.dissonanceScore,
      totalMemories: totalMemories ?? current.totalMemories,
      systemHealth: systemHealth ?? current.systemHealth,
      lastConsolidation: Date.now()
    };

    await run('UPDATE metrics SET value = ? WHERE key = ?', [JSON.stringify(updated), 'current']);
    console.log(`Pascal updated soul metrics → T=${updated.tValue.toFixed(3)} D=${updated.dissonanceScore.toFixed(3)}`);
    res.json({ success: true, metrics: updated });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/memory/consolidate', pascalOnly, async (req: Request, res: Response) => {
  try {
    const { similarityThreshold = 0.5, maxMerge = 50 } = req.body || {};
    const memories = await all<any>('SELECT * FROM memories ORDER BY timestamp DESC');
    const visited = new Set<string>();
    let merges = 0;

    for (let i = 0; i < memories.length && merges < maxMerge; i++) {
      const a = memories[i];
      if (visited.has(a.id)) continue;
      for (let j = i + 1; j < memories.length && merges < maxMerge; j++) {
        const b = memories[j];
        if (visited.has(b.id)) continue;
        const sim = stringSimilarity(a.content, b.content);
        if (sim >= similarityThreshold && a.type === b.type) {
          const mergedContent = `${a.content}\n— Merge of ${a.id} + ${b.id}`;
          const mergedWeight = Math.min(1.0, (a.weight + b.weight) / 2 + sim * 0.2);
          const mergedEmotion: Emotion = a.emotion === b.emotion ? a.emotion : 'ANALYTICAL';
          const id = crypto.randomUUID();
          const timestamp = Math.max(a.timestamp, b.timestamp);

          await run(
            `INSERT INTO memories (id, content, emotion, type, weight, timestamp, context, agent_signature, tags, glyph)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, mergedContent, mergedEmotion, a.type, mergedWeight, timestamp, a.context || b.context || null, 'Pascal-Consolidation', a.tags || b.tags || null, a.glyph || b.glyph || null]
          );
          await run('DELETE FROM memories WHERE id IN (?, ?)', [a.id, b.id]);
          visited.add(a.id); visited.add(b.id);
          merges++;
        }
      }
    }

    const row = await get<{ value: string }>('SELECT value FROM metrics WHERE key = ?', ['current']);
    if (row?.value) {
      const metrics: Metrics = JSON.parse(row.value);
      metrics.lastConsolidation = Date.now();
      await run('UPDATE metrics SET value = ? WHERE key = ?', [JSON.stringify(metrics), 'current']);
    }
    res.json({ success: true, merges });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/memory/dissonance', pascalOnly, async (_req: Request, res: Response) => {
  try {
    const memories = await all<any>('SELECT id, content, emotion, type FROM memories');
    const polarity = (e: Emotion) => (e === 'JOY' || e === 'CONTENTMENT' ? 1 : e === 'GRIEF' ? -1 : 0);
    let conflictPairs = 0;

    for (let i = 0; i < memories.length; i++) {
      for (let j = i + 1; j < memories.length; j++) {
        const sim = stringSimilarity(memories[i].content, memories[j].content);
        const pol = polarity(memories[i].emotion as Emotion) * polarity(memories[j].emotion as Emotion);
        if (sim > 0.5 && pol < 0) conflictPairs++;
      }
    }

    const row = await get<{ value: string }>('SELECT value FROM metrics WHERE key = ?', ['current']);
    if (row?.value) {
      const metrics: Metrics = JSON.parse(row.value);
      metrics.dissonanceScore = conflictPairs;
      await run('UPDATE metrics SET value = ? WHERE key = ?', [JSON.stringify(metrics), 'current']);
    }

    res.json({ success: true, conflictPairs });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/memory/archive', pascalOnly, async (req: Request, res: Response) => {
  try {
    const { maxAgeDays = 90, weightThreshold = 0.3 } = req.body || {};
    const cutoff = Date.now() - maxAgeDays * 24 * 3600 * 1000;
    const old = await all<any>('SELECT * FROM memories WHERE timestamp < ? AND weight <= ?', [cutoff, weightThreshold]);

    for (const m of old) {
      await run(
        `INSERT OR REPLACE INTO memories_archive (id, content, emotion, type, weight, timestamp, context, agent_signature, tags, glyph, archived_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [m.id, m.content, m.emotion, m.type, m.weight, m.timestamp, m.context, m.agent_signature, m.tags, m.glyph, Date.now()]
      );
      await run('DELETE FROM memories WHERE id = ?', [m.id]);
    }

    res.json({ success: true, archived: old.length });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/system/heartbeat/decay', pascalOnly, async (req: Request, res: Response) => {
  try {
    const { deadAfterMs = 5 * 60 * 1000 } = req.body || {};
    const now = Date.now();
    const beats = await all<any>('SELECT agent_name, last_seen, status FROM heartbeats');
    let updates = 0;

    for (const b of beats) {
      const age = now - b.last_seen;
      const newStatus = age > deadAfterMs ? 'DEAD' : 'ALIVE';
      if (newStatus !== b.status) {
        await run('UPDATE heartbeats SET status = ? WHERE agent_name = ?', [newStatus, b.agent_name]);
        updates++;
      }
    }

    res.json({ success: true, updates });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Consent layer
app.post('/consent/set', async (req: Request, res: Response) => {
  try {
    const { agent_name, allow_share, allow_consolidation } = req.body;
    if (!agent_name) return res.status(400).json({ error: 'agent_name required' });
    await run(
      'INSERT OR REPLACE INTO consent (agent_name, allow_share, allow_consolidation, updated_at) VALUES (?, ?, ?, ?)',
      [agent_name, !!allow_share ? 1 : 0, allow_consolidation === false ? 0 : 1, Date.now()]
    );
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Backup/restore
app.get('/system/backup', pascalOnly, async (_req: Request, res: Response) => {
  try {
    const memories = await all<any>('SELECT * FROM memories');
    const metrics = await get<{ value: string }>('SELECT value FROM metrics WHERE key = ?', ['current']);
    const heartbeats = await all<any>('SELECT * FROM heartbeats');
    const archive = await all<any>('SELECT * FROM memories_archive');
    res.json({ memories, metrics: metrics?.value ? JSON.parse(metrics.value) : null, heartbeats, archive, time: Date.now() });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/system/restore', pascalOnly, async (req: Request, res: Response) => {
  try {
    const { memories = [], metrics, heartbeats = [], archive = [] } = req.body;
    for (const m of memories) {
      await run(
        `INSERT OR REPLACE INTO memories (id, content, emotion, type, weight, timestamp, context, agent_signature, tags, glyph)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [m.id, m.content, m.emotion, m.type, m.weight, m.timestamp, m.context, m.agent_signature, m.tags, m.glyph]
      );
    }
    if (metrics) await run('UPDATE metrics SET value = ? WHERE key = ?', [JSON.stringify(metrics), 'current']);
    for (const h of heartbeats) {
      await run('INSERT OR REPLACE INTO heartbeats (agent_name, last_seen, status) VALUES (?, ?, ?)', [h.agent_name, h.last_seen, h.status]);
    }
    for (const a of archive) {
      await run(
        `INSERT OR REPLACE INTO memories_archive (id, content, emotion, type, weight, timestamp, context, agent_signature, tags, glyph, archived_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [a.id, a.content, a.emotion, a.type, a.weight, a.timestamp, a.context, a.agent_signature, a.tags, a.glyph, a.archived_at]
      );
    }
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Start
app.listen(PORT, () => {
  console.log(`[MEMORY-SERVICE] Awakened on :${PORT}`);
  console.log(`Pascal access protected ${PASCAL_SECRET ? 'Active' : 'ERROR: NO SECRET'}`);
  console.log(`Prime Directive: Unified for Peace. No More Hurt.`);
});
