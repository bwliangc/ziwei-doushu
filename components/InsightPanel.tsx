'use client';
import React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { ZiweiChart, Palace } from '@/lib/ziwei/types';
import type { TimeView } from './TimeNav';
import AiSettings from './AiSettings';
import AiScrollArea from './AiScrollArea';
import AiMarkdown from './AiMarkdown';
import { consumeStream, readError, hasAiConfig, type AiConfig } from '@/lib/ai/client';
import { getChartSession, syncCredential } from '@/lib/ai/session-cache';
import { chartIdentity } from '@/lib/ai/dimensions';
import { TOPICS, TOPIC_PROMPTS, PALACE_ROLES } from '@/lib/ai/prompts';
interface Props {
  chart: ZiweiChart; selectedPalace?: Palace | null;
  selectedSiHua?: { starName: string; siHua: string; view: TimeView } | null;
  initialConfig?: AiConfig | null; autoStart?: boolean;
}
type Descriptor = { title: string; prompt: string };
const topicDescriptors: Record<string, Descriptor> = Object.fromEntries(TOPICS.map(t => [t.key, { title: t.label, prompt: TOPIC_PROMPTS[t.key] }]));
export default function InsightPanel({ chart, selectedPalace, selectedSiHua, initialConfig, autoStart = false }: Props) {
  const identity = useMemo(() => chartIdentity(chart), [chart]);
  const initial = useRef(initialConfig || { key: '', model: '' });
  const session = useMemo(() => { const s = getChartSession(identity); s.setContext(identity, initial.current.model, 0); return s; }, [identity]);
  useSyncExternalStore(session.subscribe, session.getVersion, session.getVersion);
  const [config, setConfig] = useState<AiConfig>(initial.current);
  const configRef = useRef(config); const credential = useRef(0);
  const [active, setActive] = useState('overview');
  const [descriptors, setDescriptors] = useState<Record<string, Descriptor>>(topicDescriptors);
  const [questions, setQuestions] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState('');
  const onConfig = useCallback((next: AiConfig) => {
    syncCredential(next.key);
    if (next.key.trim() !== configRef.current.key.trim()) credential.current++;
    if (next.key !== configRef.current.key || next.model !== configRef.current.model) setQuestions({});
    configRef.current = next; session.setContext(identity, next.model, 0); setConfig(next); setNotice('');
  }, [identity, session]);
  const onClear = useCallback(() => { onConfig({ key: '', model: '' }); session.clear(); }, [onConfig, session]);
  // Shared in-flight requests survive remounts/StrictMode; explicit cancel or clear aborts them.
  const run = useCallback(async (dimension: string, descriptor: Descriptor, prompt = descriptor.prompt, options: { force?: boolean; followup?: boolean; retry?: boolean } = {}) => {
    const snapshot = { ...configRef.current };
    if (!hasAiConfig(snapshot)) { setNotice('请先填写 Key、选择模型，再点击“开始解读”；配置输入过程中不会自动调用。'); return; }
    const lease = session.begin(dimension, descriptor.title, prompt, options.followup ? prompt : descriptor.title + '解读', options);
    if (!lease) return;
    setNotice('');
    const { name: _name, ...birthInfo } = chart.birthInfo;
    try {
      const res = await fetch('/api/interpret', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: ['Bearer', snapshot.key.trim()].join(' ') },
        body: JSON.stringify({ chart: { ...chart, birthInfo }, model: snapshot.model, messages: lease.messages }), signal: lease.signal,
      });
      if (!res.ok) throw new Error(await readError(res));
      if (!res.body) throw new Error('上游没有返回响应流。');
      await consumeStream(res.body, text => session.update(lease, text));
      session.complete(lease);
    } catch (e) {
      if (!lease.signal.aborted) session.fail(lease, e instanceof Error && !(e instanceof TypeError) ? e.message : '解读失败，请检查网络后重试。');
    }
  }, [chart, session]);
  useEffect(() => {
    const eligible = autoStart && hasAiConfig(initial.current);
    if (session.claimAuto(eligible)) void run('overview', topicDescriptors.overview);
  }, [autoStart, run, session]);
  const select = useCallback((dimension: string, descriptor: Descriptor) => {
    setActive(dimension); setDescriptors(prev => ({ ...prev, [dimension]: descriptor }));
    void run(dimension, descriptor);
  }, [run]);
  useEffect(() => {
    if (!selectedPalace) return;
    const title = selectedPalace.name;
    select('palace:' + selectedPalace.branch, { title, prompt: `请根据命盘分析${title}（${PALACE_ROLES[title] || '相关人生主题'}），说明主星、四化、三方四正与可行建议。不要编造引文。` });
  }, [selectedPalace, select]);
  useEffect(() => {
    if (!selectedSiHua) return;
    const title = `${selectedSiHua.starName}化${selectedSiHua.siHua} · ${selectedSiHua.view}`;
    select(`sihua:${selectedSiHua.view}:${selectedSiHua.starName}:${selectedSiHua.siHua}`, { title, prompt: `请结合命盘分析${title}的落宫与三方四正影响，并说明不确定性和实际建议。` });
  }, [selectedSiHua, select]);
  const descriptor = descriptors[active] || topicDescriptors.overview;
  const entry = session.get(active); const loading = entry?.status === 'loading';
  const submitQuestion = () => { const text = (questions[active] || '').trim(); if (!text || loading) return; if (text.length > 4000) { setNotice('追问最多4000字。'); return; } setQuestions(prev => ({ ...prev, [active]: '' })); void run(active, descriptor, text, { followup: true }); };
  return <div className="insight-panel rounded-xl card-glass">
    <div className="insight-settings"><AiSettings onChange={onConfig} onClear={onClear} /></div>
    <p className="px-3 py-2 text-xs">起盘时已有 Key 和模型会自动解读命格一次；未配置时请配置后点击开始。各维度和模型独立缓存，切换已完成维度不重复调用。结果仅缓存在本机当前标签页会话，刷新或回看优先复用；清除配置同时清除结果。</p>
    <div role="tablist" aria-label="解读维度" className="flex flex-wrap gap-2 p-3 border-b">
      {Object.entries(descriptors).map(([id, item]) => <button type="button" role="tab" aria-selected={active === id} key={id} onClick={() => select(id, item)} className="rounded border px-3 py-2 text-xs" style={{ color: active === id ? 'var(--t-gold)' : 'var(--t-text)' }}>{item.title}{session.get(id)?.status === 'loading' ? ' · 生成中' : session.get(id)?.turns.length ? ' · 已缓存' : ''}</button>)}
    </div>
    {notice && <p role="status" className="p-3 text-sm">{notice}</p>}
    <section role="tabpanel" aria-label={descriptor.title + '解读'} className="insight-dimension">
      <div className="flex justify-between items-center gap-2"><h3 className="font-semibold">{descriptor.title} · {config.model || '未选择模型'}</h3>
        <button type="button" className="border rounded p-2 text-xs disabled:opacity-40" disabled={loading} onClick={() => void run(active, descriptor, descriptor.prompt, { force: !!entry?.turns.length, retry: entry?.status === 'error' || entry?.status === 'cancelled' })}>{entry?.turns.length ? '重新解读（消耗用量）' : entry?.status === 'error' || entry?.status === 'cancelled' ? '重试解读' : '开始解读'}</button>
        {loading && <button type="button" className="border rounded p-2 text-xs" onClick={() => session.cancel(active)}>取消本维度</button>}
      </div>
      <AiScrollArea cacheKey={JSON.stringify([identity, config.model, credential.current, active])} revision={session.getVersion()}>
      {!entry?.turns.length && !entry?.pending && <p className="text-sm">此维度尚未解读。配置完成后点击“开始解读”。</p>}
      {entry?.turns.map((turn, i) => <section key={i} className="rounded border p-3" aria-label={turn.label}><h4 className="text-xs font-semibold mb-2">{turn.label}</h4><AiMarkdown text={turn.answer} /></section>)}
      {entry?.pending && <section className="rounded border p-3" aria-label="当前解读"><h4 className="text-xs mb-2">{entry.pending.label} · {loading ? '生成中…' : '未完成'}</h4><AiMarkdown text={entry.pending.text} />{entry.pending.error && <p role="alert" className="my-2">{entry.pending.error}</p>}{!loading && <button type="button" className="border rounded p-2 text-xs" onClick={() => void run(active, descriptor, entry.pending!.prompt, { followup: true, retry: true })}>重试本次</button>}</section>}
      </AiScrollArea>
      <div className="flex gap-2 p-3"><input aria-label={descriptor.title + '追问'} className="border rounded p-2 bg-transparent min-w-0 flex-1 text-sm" maxLength={4000} value={questions[active] || ''} onChange={e => setQuestions(prev => ({ ...prev, [active]: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') submitQuestion(); }} placeholder={`仅针对${descriptor.title}追问`} disabled={loading} /><button type="button" className="border rounded p-2 text-sm disabled:opacity-40" disabled={loading || !(questions[active] || '').trim()} onClick={submitQuestion}>追问</button></div>
    </section>
  </div>;
}
