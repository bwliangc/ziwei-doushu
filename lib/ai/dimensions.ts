export type Status = 'idle' | 'loading' | 'complete' | 'error' | 'cancelled';
export interface Turn { label: string; answer: string }
export interface DimensionEntry {
  dimension: string; title: string; status: Status; turns: Turn[];
  messages: { role: 'user' | 'assistant'; content: string }[];
  pending?: { prompt: string; label: string; text: string; error: string };
  requestId: number;
}
export interface Lease { scope: string; dimension: string; id: number; signal: AbortSignal; messages: DimensionEntry['messages'] }
function stable(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.entries(value).filter(([,v]) => v !== undefined).sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => JSON.stringify(k)+':'+stable(v)).join(',') + '}';
  return JSON.stringify(value) ?? 'null';
}
export function chartIdentity(chart: unknown) {
  if (!chart || typeof chart !== 'object') return stable(chart);
  const copy = { ...chart as Record<string, unknown> };
  if (copy.birthInfo && typeof copy.birthInfo === 'object') { const { name: _name, ...birth } = copy.birthInfo as Record<string, unknown>; copy.birthInfo = birth; }
  return stable(copy);
}
// Memory only. Scope contains chart, model and an opaque credential generation, never the API Key.
export class DimensionSession {
  private scope = ''; private chart = ''; private credential = 0; private seq = 0; private revision = 0;
  private entries = new Map<string, Map<string, DimensionEntry>>();
  private controllers = new Map<number, AbortController>();
  private autoClaimed = false;
  private listeners = new Set<() => void>();
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getVersion = () => this.revision;
  private notify() { this.revision++; this.listeners.forEach(fn => fn()); }
  setContext(chart: string, model: string, credential: number) {
    const next = JSON.stringify([chart, model, credential]); if (next === this.scope) return;
    this.cancelAll();
    if (credential !== this.credential) this.entries.clear();
    if (chart !== this.chart) this.autoClaimed = false;
    this.chart = chart; this.credential = credential; this.scope = next;
    if (!this.entries.has(next)) this.entries.set(next, new Map()); this.notify();
  }
  claimAuto(eligibleAtBirth: boolean) { if (this.autoClaimed) return false; this.autoClaimed = true; return eligibleAtBirth; }
  get(dimension: string) { return this.entries.get(this.scope)?.get(dimension); }
  list() { return [...(this.entries.get(this.scope)?.values() || [])]; }
  begin(dimension: string, title: string, prompt: string, label: string, options: { force?: boolean; followup?: boolean; retry?: boolean } = {}): Lease | null {
    const entries = this.entries.get(this.scope); if (!entries) return null;
    let entry = entries.get(dimension);
    if (entry?.status === 'loading') return null;
    if (!options.force && !options.retry) {
      if (!options.followup && entry) return null;
      if (options.followup && entry?.messages.some(m => m.role === 'user' && m.content.trim() === prompt.trim())) return null;
      if (entry?.pending?.prompt.trim() === prompt.trim()) return null;
    }
    if (!entry || options.force) { entry = { dimension, title, status: 'idle', turns: [], messages: [], requestId: 0 }; entries.set(dimension, entry); }
    const id = ++this.seq; const controller = new AbortController(); this.controllers.set(id, controller);
    entry.requestId = id; entry.status = 'loading'; entry.pending = { prompt, label, text: '', error: '' };
    const messages = [...entry.messages, { role: 'user' as const, content: prompt }].slice(-29);
    this.notify(); return { scope: this.scope, dimension, id, signal: controller.signal, messages };
  }
  private target(lease: Lease) { const entry = this.entries.get(lease.scope)?.get(lease.dimension); return entry?.requestId === lease.id && entry.status === 'loading' ? entry : undefined; }
  update(lease: Lease, text: string) { const e = this.target(lease); if (!e?.pending) return; e.pending.text = text; this.notify(); }
  complete(lease: Lease) { const e = this.target(lease); if (!e?.pending) return; e.turns.push({ label: e.pending.label, answer: e.pending.text }); e.messages = [...lease.messages, { role: 'assistant', content: e.pending.text }]; e.pending = undefined; e.status = 'complete'; this.controllers.delete(lease.id); this.notify(); }
  fail(lease: Lease, message: string) { const e = this.target(lease); if (!e?.pending) return; e.pending.error = message; e.status = 'error'; this.controllers.delete(lease.id); this.notify(); }
  cancel(dimension: string) { const e = this.get(dimension); if (!e || e.status !== 'loading') return; this.controllers.get(e.requestId)?.abort(); this.controllers.delete(e.requestId); e.status = 'cancelled'; if (e.pending) e.pending.error = '已取消，未完成内容不会作为完整缓存。'; this.notify(); }
  cancelAll() { for (const entries of this.entries.values()) for (const e of entries.values()) if (e.status === 'loading') { this.controllers.get(e.requestId)?.abort(); e.status = 'cancelled'; if (e.pending) e.pending.error = '请求已取消，未完成内容不会作为完整缓存。'; } this.controllers.clear(); }
  snapshot() {
    return [...this.entries].map(([scope, entries]) => ({ scope, entries: [...entries.values()].map(e => ({ ...e, status: e.status === 'loading' ? 'cancelled' : e.status, pending: e.pending ? { ...e.pending, text: '', error: '上次解读未完成，请显式重试。' } : undefined })) }));
  }
  restore(rows: ReturnType<DimensionSession['snapshot']>) {
    for (const row of rows) {
      if (typeof row.scope !== 'string' || !Array.isArray(row.entries)) continue;
      const map = new Map<string, DimensionEntry>();
      for (const e of row.entries) if (typeof e.dimension === 'string' && Array.isArray(e.turns) && Array.isArray(e.messages) && ['complete','cancelled','error'].includes(e.status)) map.set(e.dimension, { ...e, requestId: 0 });
      this.entries.set(row.scope, map);
    }
    this.notify();
  }
  clear() { this.cancelAll(); this.entries.clear(); this.entries.set(this.scope, new Map()); this.notify(); }
}
