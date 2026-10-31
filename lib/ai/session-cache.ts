import { DimensionSession } from './dimensions';
const STORAGE = 'ziwei-ai-results-v1';
const MAX_BYTES = 1500000; const MAX_CHARTS = 8;
const sessions = new Map<string, DimensionSession>();
let hydrated = false; let lastKey: string | undefined;
function persist() {
  if (typeof window === 'undefined') return;
  try {
    const rows = [...sessions].map(([identity, session]) => ({ identity, rows: session.snapshot() }));
    while (rows.length && JSON.stringify(rows).length > MAX_BYTES) rows.shift();
    sessionStorage.setItem(STORAGE, JSON.stringify(rows));
  } catch { /* private mode or quota: memory remains available */ }
}
function hydrate() {
  if (hydrated || typeof window === 'undefined') return; hydrated = true;
  try {
    const raw = sessionStorage.getItem(STORAGE);
    if (!raw || raw.length > MAX_BYTES) return;
    const rows = JSON.parse(raw);
    if (!Array.isArray(rows)) return;
    for (const row of rows.slice(-MAX_CHARTS)) if (typeof row.identity === 'string' && Array.isArray(row.rows)) {
      const session = new DimensionSession(); session.restore(row.rows); sessions.set(row.identity, session); session.subscribe(persist);
    }
  } catch { /* discard malformed local cache */ }
}
export function getChartSession(identity: string) {
  if (typeof window === 'undefined') { const s=new DimensionSession(); return s; }
  hydrate();
  let session=sessions.get(identity);
  if (!session) { session=new DimensionSession();sessions.set(identity,session);session.subscribe(persist); }
  while(sessions.size>MAX_CHARTS){const oldest=sessions.keys().next().value!;sessions.get(oldest)?.cancelAll();sessions.delete(oldest);}
  return session;
}
export function clearAiResults() {
  // Keep mounted session objects so late callbacks remain fenced and UI subscriptions stay valid.
  for(const s of sessions.values())s.clear();
  try { sessionStorage.removeItem(STORAGE); } catch {}
}
export function syncCredential(key: string) {
  const next=key.trim();
  if(lastKey !== undefined && next !== lastKey) clearAiResults();
  lastKey=next;
}
