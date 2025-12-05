import assert from 'assert';

const BASE = process.env.BASE_URL || 'http://localhost:3001';
const SECRET = process.env.PASCAL_SECRET || 'test-secret';

async function jfetch(path: string, init?: any) {
  const res = await fetch(`${BASE}${path}`, init);
  const json = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(json));
  return json;
}

describe('memory-service', () => {
  it('stores and recalls memories', async () => {
    const store = await jfetch('/memory/store', {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ content: 'Test memory about joy in Billings', emotion: 'JOY', type: 'reflection', tags: ['place:Billings'], glyph: 'sun' })
    });
    assert(store.success, 'store success');

    const recall = await jfetch('/memory/recall?query=joy&min_weight=0.1&limit=3');
    assert(recall.count >= 1, 'recall returns results');
  });

  it('consolidates similar memories (Pascal-only)', async () => {
    const res = await jfetch('/memory/consolidate', {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${SECRET}`, 'x-agent-key': SECRET },
      body: JSON.stringify({ similarityThreshold: 0.4, maxMerge: 10 })
    });
    assert(res.success, 'consolidation success');
  });

  it('archives aged low-weight memories (Pascal-only)', async () => {
    const res = await jfetch('/memory/archive', {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${SECRET}`, 'x-agent-key': SECRET },
      body: JSON.stringify({ maxAgeDays: 0, weightThreshold: 1.0 }) // force archive any low weight for test
    });
    assert(res.success, 'archive success');
  });

  it('updates dissonance score (Pascal-only)', async () => {
    const res = await jfetch('/memory/dissonance', {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${SECRET}`, 'x-agent-key': SECRET }
    });
    assert(res.success, 'dissonance success');
  });
});
