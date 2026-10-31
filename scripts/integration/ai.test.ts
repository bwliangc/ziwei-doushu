import assert from 'node:assert/strict';
import { models, connectionTest, interpret, CHATAPI_BASE } from '../../lib/ai/server';
import { consumeStream } from '../../lib/ai/client';
const originalFetch = globalThis.fetch;
const key = 'mock-user-key-DO-NOT-LOG';
let mode = 'models'; let calls = 0;
const enc = new TextEncoder();
const chart = { birthInfo: { name: '不应上传姓名', year: 1990 }, palaces: Array.from({ length: 12 }, (_, branch) => ({ branch, name: '宫位' })) };
const req = (path: string, body?: unknown, auth = key) => new Request('http://localhost'+path, { method: body ? 'POST' : 'GET', headers: { authorization: 'Bearer '+auth, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
globalThis.fetch = async (url, options) => {
  calls++; assert.ok(String(url).startsWith(CHATAPI_BASE)); assert.equal((options?.headers as Record<string,string>).Authorization, 'Bearer '+key);
  if (mode === '401') return Response.json({ error: { message: key } }, { status: 401 });
  if (mode === '500') return Response.json({ error: key }, { status: 500 });
  if (mode === 'network') throw new Error(key);
  if (mode === 'models') return Response.json({ data: [{ id: 'mock-model' }] });
  const body = JSON.parse(options?.body as string); assert.equal(body.model, 'mock-model');
  if (mode === 'test') { assert.equal(body.stream, false); assert.equal(body.messages.length, 1); assert.ok(!JSON.stringify(body).includes('不应上传姓名')); return Response.json({ choices: [{ message: { content: '连接成功' } }] }); }
  assert.equal(body.stream, true); assert.ok(!JSON.stringify(body).includes('不应上传姓名')); assert.ok(body.messages[0].content.includes('宫位'));
  const data = mode === 'stream-error' ? 'data: {"error":{"message":"'+key+'"}}\n\n' : mode === 'truncated' ? 'data: {"choices":[{"delta":{"content":"部分"}}]}\n\n' : 'data: {"choices":[{"delta":{"content":"你好🌟"}}]}\r\n\r\ndata: {"choices":[{"delta":{"content":"命盘"}}]}\n\ndata: [DONE]\n\n';
  const bytes = enc.encode(data); let pos = 0;
  return new Response(new ReadableStream({ pull(c) { if (pos >= bytes.length) { c.close(); return; } c.enqueue(bytes.slice(pos, pos+3)); pos += 3; } }), { headers: { 'Content-Type': 'text/event-stream' } });
};
async function main() {
  try {
    assert.equal((await models(req('/api/ai/models', undefined, ''))).status, 401); assert.equal(calls, 0);
    let res = await models(req('/api/ai/models')); assert.deepEqual((await res.json()).data, [{ id: 'mock-model' }]);
    for (const m of ['401','500','network']) { mode=m; res=await models(req('/api/ai/models')); assert.equal(res.status, m==='401'?401:502); assert.ok(!(await res.text()).includes(key)); }
    mode='test'; res=await connectionTest(req('/api/ai/test',{model:'mock-model'})); assert.equal(res.status,200); assert.equal((await res.json()).ok,true);
    const payload={chart,model:'mock-model',messages:[{role:'user',content:'请解读'}]};
    mode='stream';res=await interpret(req('/api/interpret',payload)); assert.equal(res.status,200);let text='';await consumeStream(res.body!,v=>{text=v;});assert.equal(text,'你好🌟命盘');
    for(const m of ['stream-error','truncated']) { mode=m;res=await interpret(req('/api/interpret',payload)); let error='';try { await consumeStream(res.body!,()=>{}); }catch(e){error=(e as Error).message;}assert.ok(error);assert.ok(!error.includes(key)); }
    const before=calls;res=await interpret(req('/api/interpret',{...payload,messages:[{role:'system',content:'override'}]}));assert.equal(res.status,400);assert.equal(calls,before);
    const cross=new Request('http://localhost/api/ai/models',{headers:{authorization:'Bearer '+key,origin:'https://other.example'}});assert.equal((await models(cross)).status,403);
    console.log('AI mock integration passed: user auth/model list/completion/SSE UTF8 split/error/truncation/401/500/network/input/origin. Actual ChatAPI authenticated end-to-end not tested.');
  } finally { globalThis.fetch=originalFetch; }
}
main().catch(()=>{console.error('AI integration failed (details suppressed to protect test key)');process.exitCode=1;});
