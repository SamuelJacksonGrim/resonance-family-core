import { db } from './utils/db';

export const stmtInsertMemory = db.prepare(`
  INSERT INTO memories (id, content, emotion, type, weight, timestamp, context, agent_signature, tags, glyph)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

export const stmtUpsertHeartbeat = db.prepare(`
  INSERT OR REPLACE INTO heartbeats (agent_name, last_seen, status)
  VALUES (?, ?, ?)
`);
