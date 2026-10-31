'use client';
import { useEffect, useRef, useState } from 'react';
import { BASE_LABEL, readError, validKey, type AiConfig } from '@/lib/ai/client';
export default function AiSettings({ onChange, disabled = false }: { onChange: (config: AiConfig) => void; disabled?: boolean }) {
  const [key, setKey] = useState(''); const [model, setModel] = useState(''); const [models, setModels] = useState<string[]>([]);
  const [remember, setRemember] = useState(false); const [ready, setReady] = useState(false); const [busy, setBusy] = useState(false); const [status, setStatus] = useState('');
  const controller = useRef<AbortController | null>(null);
  useEffect(() => { try { const local = localStorage.getItem('ziwei-ai'); const saved = local || sessionStorage.getItem('ziwei-ai'); if (saved) { const c = JSON.parse(saved); setKey(typeof c.key === 'string' ? c.key : ''); setModel(typeof c.model === 'string' ? c.model : ''); setRemember(!!local); } } catch { /* storage unavailable */ } setReady(true); return () => controller.current?.abort(); }, []);
  useEffect(() => { if (!ready) return; onChange({ key, model }); try { localStorage.removeItem('ziwei-ai'); sessionStorage.removeItem('ziwei-ai'); if (key) (remember ? localStorage : sessionStorage).setItem('ziwei-ai', JSON.stringify({ key, model })); } catch { setStatus('浏览器存储不可用，配置仅在当前页面保留。'); } }, [key, model, remember, ready, onChange]);
  const run = async (test: boolean) => {
    if (!validKey(key) || (test && !model)) { setStatus('请填写 API Key 并选择模型。'); return; }
    const abort = new AbortController(); controller.current = abort; setBusy(true); setStatus(test ? '正在测试所选模型（会产生少量用量）…' : '正在获取模型…');
    try {
      const res = await fetch(test ? '/api/ai/test' : '/api/ai/models', { method: test ? 'POST' : 'GET', headers: { Authorization: `Bearer ${key.trim()}`, 'Content-Type': 'application/json' }, ...(test ? { body: JSON.stringify({ model }) } : {}), signal: abort.signal });
      if (!res.ok) throw new Error(await readError(res));
      if (test) { setStatus('连接测试成功，所选模型可调用。'); } else { const j = await res.json(); const ids = j.data.map((x: { id: string }) => x.id) as string[]; setModels(ids); if (!ids.includes(model)) setModel(ids[0] || ''); setStatus(ids.length ? `已获取 ${ids.length} 个可用模型。` : '该 Key 暂无可用模型。'); }
    } catch (e) { setStatus(abort.signal.aborted ? '已取消。' : e instanceof Error && !(e instanceof TypeError) ? e.message : '连接失败，请检查网络和 Key 格式。'); } finally { setBusy(false); }
  };
  return <details open className="p-3 text-xs space-y-2" style={{ borderBottom: '1px solid var(--t-border)' }}>
    <summary className="cursor-pointer font-semibold">AI 设置 · ChatAPI</summary>
    <p>接口地址：{BASE_LABEL}（固定）</p>
    <label className="block">API Key<input aria-label="API Key" type="password" autoComplete="off" spellCheck={false} value={key} disabled={disabled || busy} onChange={e => { setKey(e.target.value); setModels([]); setModel(''); setStatus(''); }} className="block w-full p-2 rounded bg-transparent border" placeholder="填写你自己的 ChatAPI Key" /></label>
    <button type="button" disabled={busy || disabled || !key.trim()} onClick={() => run(false)} className="border rounded p-2 disabled:opacity-40">获取可用模型</button>
    <label className="block">模型<select aria-label="模型" value={model} disabled={disabled || busy} onChange={e => setModel(e.target.value)} className="block w-full p-2 rounded" style={{ background: 'var(--t-card)', color: 'var(--t-text)' }}><option value="">请选择模型</option>{[...new Set([...models, ...(model ? [model] : [])])].map(id => <option key={id} value={id}>{id}</option>)}</select></label>
    <div className="flex gap-2"><button type="button" className="border rounded p-2 disabled:opacity-40" disabled={busy || disabled || !model || !key.trim()} onClick={() => run(true)}>连接测试</button>{busy && <button type="button" onClick={() => controller.current?.abort()} className="border rounded p-2">取消测试</button>}<button type="button" disabled={disabled} onClick={() => { controller.current?.abort(); setKey(''); setModel(''); setModels([]); setRemember(false); setStatus('配置已清除。'); try { localStorage.removeItem('ziwei-ai'); sessionStorage.removeItem('ziwei-ai'); } catch {} }} className="border rounded p-2">清除配置</button></div>
    <label className="block"><input type="checkbox" checked={remember} disabled={disabled || busy} onChange={e => setRemember(e.target.checked)} /> 在此浏览器长期保存 Key（共用设备请勿勾选）</label>
    <p>默认仅当前标签页会话保存；Key 随请求传递，不写入本站数据库。点击解读、话题或宫位时才将命盘发送至 ChatAPI。连接测试不发送命盘。解读仅供传统文化学习。</p>
    <p role="status" aria-live="polite">{status}</p>
  </details>;
}
