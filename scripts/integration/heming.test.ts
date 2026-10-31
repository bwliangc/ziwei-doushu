import assert from 'node:assert/strict';
import { heming, CHATAPI_BASE } from '../../lib/ai/server';
import { consumeStream } from '../../lib/ai/client';
const originalFetch = globalThis.fetch;
const userKey = 'mock-heming-key';
const makeChart = (year: number, name: string) => ({ name, birthInfo: { year, month: 6, day: 15, hour: 3, gender: 'male', name }, palaces: Array.from({ length: 12 }, (_, branch) => ({ branch, name: '宫位'+branch, stars: [{ name: branch === 0 ? '紫微' : '天机' }] })) });
const payload = { model: 'chosen-pair-model', chartA: makeChart(1990, '甲姓名不上传'), chartB: makeChart(1991, '乙姓名不上传'), question: '请分析合作沟通' };
const request = (body: unknown, signal?: AbortSignal) => new Request('http://localhost/api/heming', { method: 'POST', headers: { authorization: '***'+userKey, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
let mode = 'success', calls = 0;
globalThis.fetch = async (url, options) => {
  calls++; assert.equal(url, CHATAPI_BASE+'/chat/completions'); assert.equal((options?.headers as Record<string,string>).Authorization, 'Bearer '+userKey); assert.ok(options?.signal);
  if (options.signal.aborted) throw new Error('cancelled');
  if (mode === '401') return Response.json({ error: userKey }, { status: 401 });
  if (mode === '500') return Response.json({ error: userKey }, { status: 500 });
  const body = JSON.parse(options.body as string); assert.equal(body.model,payload.model);assert.equal(body.stream,true);
  const prompt=body.messages[0].content;assert.ok(!prompt.includes('甲姓名不上传'));assert.ok(!prompt.includes('乙姓名不上传'));assert.ok(prompt.includes('1990'));assert.ok(prompt.includes('1991'));assert.ok(prompt.includes('chartA'));assert.ok(prompt.includes('chartB'));assert.equal(body.messages[1].content,payload.question);
  const text=mode==='broken'?'data: {"error":{"message":"'+userKey+'"}}\n\n':'data: {"choices":[{"delta":{"content":"双方🌟"}}]}\n\ndata: {"choices":[{"delta":{"content":"沟通建议"}}]}\n\ndata: [DONE]\n\n';
  const bytes=new TextEncoder().encode(text);let i=0;
  return new Response(new ReadableStream({pull(c){if(i===bytes.length){c.close();return;}c.enqueue(bytes.slice(i,i+1));i++;}}));
};
async function main(){try{
  let res=await heming(request(payload));assert.equal(res.status,200);let text='';await consumeStream(res.body!,v=>{text=v;});assert.equal(text,'双方🌟沟通建议');
  for(const bad of [
    {...payload,chartB:null}, {...payload,chartA:{}}, {...payload,chartB:{...payload.chartB,palaces:[]}},
    {...payload,chartB:{...payload.chartB,palaces:Array(12).fill(payload.chartB.palaces[0])}},
    {...payload,chartB:{...payload.chartB,birthInfo:{...payload.chartB.birthInfo,month:2,day:30}}},
    {...payload,chartA:{...payload.chartA,birthInfo:{...payload.chartA.birthInfo,hour:12}}},
    {...payload,chartA:{...payload.chartA,birthInfo:{...payload.chartA.birthInfo,gender:'invalid'}}},
    {...payload,chartA:{...payload.chartA,birthInfo:{...payload.chartA.birthInfo,gender:{toString:null,valueOf:null}}}},
    {...payload,question:{url:'http://169.254.169.254/'}}, {...payload,question:'x'.repeat(4001)}, {...payload,model:''},
  ]){const before=calls;res=await heming(request(bad));assert.equal(res.status,400);assert.equal(calls,before);}
  for(const m of ['401','500']){mode=m;res=await heming(request(payload));assert.equal(res.status,m==='401'?401:502);assert.ok(!(await res.text()).includes(userKey));}
  mode='broken';res=await heming(request(payload));let error='';try{await consumeStream(res.body!,()=>{});}catch(e){error=(e as Error).message;}assert.ok(error);assert.ok(!error.includes(userKey));
  const abort=new AbortController();abort.abort();res=await heming(request(payload,abort.signal));assert.ok([400,502].includes(res.status));
  console.log('Heming mock passed: dual charts, chosen model, both names removed, one-byte UTF8/SSE split, invalid dates/branches/gender/missing charts/question, 401/500/error/cancel. No real authenticated inference verified.');
}finally{globalThis.fetch=originalFetch;}}
main().catch(()=>{console.error('Heming integration failed (details suppressed)');process.exitCode=1;});
