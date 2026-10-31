export interface AiConfig { key: string; model: string }
export function validKey(key: string) { return /^[\x21-\x7e]{1,512}$/.test(key.trim()); }
export function hasAiConfig(config: AiConfig) { return validKey(config.key) && !!config.model.trim(); }
export const BASE_LABEL = 'https://chatapi.bwliangc.com/v1';
export async function readError(res: Response) { try { const j = await res.json(); return typeof j.error === 'string' ? j.error : '请求失败，请稍后重试。'; } catch { return '请求失败，请稍后重试。'; } }
export async function consumeStream(body: ReadableStream<Uint8Array>, update: (text: string) => void) {
  const reader = body.getReader(); const decoder = new TextDecoder(); let buffer = ''; let text = ''; let doneFlag = false;
  const line = (raw: string) => { if (!raw.startsWith('data:')) return; const v = raw.slice(5).trim(); if (v === '[DONE]') { doneFlag = true; return; } if (!v) return; const j = JSON.parse(v); if (j.error) throw new Error(j.error); if (typeof j.delta?.text === 'string') { text += j.delta.text; update(text); } };
  try { while (!doneFlag) { const { done, value } = await reader.read(); if (done) break; buffer += decoder.decode(value, { stream: true }); let i; while ((i = buffer.indexOf('\n')) >= 0) { line(buffer.slice(0, i).replace(/\r$/, '')); buffer = buffer.slice(i + 1); } } buffer += decoder.decode(); if (buffer.trim()) line(buffer.trim()); if (!doneFlag) throw new Error('响应中断，请重试。'); } finally { await reader.cancel().catch(() => {}); }
}
