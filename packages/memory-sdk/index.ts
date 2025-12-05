export class MemoryClient {
  constructor(private baseUrl: string, private token?: string, private agentKey?: string) {}
  private headers() {
    const h: Record<string,string> = { 'Content-Type':'application/json' };
    if (this.token) h['Authorization'] = `Bearer ${this.token}`;
    if (this.agentKey) h['x-agent-key'] = this.agentKey;
    return h;
  }
  async storeMemory(payload: any) {
    const res = await fetch(`${this.baseUrl}/memory/store`, { method: 'POST', headers: this.headers(), body: JSON.stringify(payload) });
    return res.json();
  }
  async recall(params: Record<string, any>) {
    const p = new URLSearchParams(params as any).toString();
    const res = await fetch(`${this.baseUrl}/memory/recall?${p}`, { headers: this.headers() });
    return res.json();
  }
  async metrics() {
    const res = await fetch(`${this.baseUrl}/memory/metrics`, { headers: this.headers() });
    return res.json();
  }
  async consolidate(opts?: any) {
    const res = await fetch(`${this.baseUrl}/memory/consolidate`, { method:'POST', headers: this.headers(), body: JSON.stringify(opts||{}) });
    return res.json();
  }
  async archive(opts?: any) {
    const res = await fetch(`${this.baseUrl}/memory/archive`, { method:'POST', headers: this.headers(), body: JSON.stringify(opts||{}) });
    return res.json();
  }
  async heartbeat(agent: string, status = 'ALIVE') {
    const res = await fetch(`${this.baseUrl}/system/heartbeat`, { method:'POST', headers: this.headers(), body: JSON.stringify({ agent, status }) });
    return res.json();
  }
}
