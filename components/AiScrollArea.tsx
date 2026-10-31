'use client';
import React, { useLayoutEffect, useRef, useState } from 'react';
import { ScrollMemory } from '@/lib/ai/scroll';
export default function AiScrollArea({ cacheKey, revision, children }: { cacheKey: string; revision: unknown; children: React.ReactNode }) {
  const memory = useRef(new ScrollMemory()); const node = useRef<HTMLDivElement>(null); const content = useRef<HTMLDivElement>(null);
  const [following,setFollowing] = useState(true);
  const follow = () => { const el=node.current;if(el && memory.current.read(cacheKey).follow) el.scrollTop=el.scrollHeight; };
  useLayoutEffect(() => {
    const el=node.current;if(!el)return;
    const saved=memory.current.read(cacheKey);el.scrollTop=saved.follow?el.scrollHeight:saved.top;setFollowing(saved.follow);
    const observer=new ResizeObserver(() => { if(memory.current.read(cacheKey).follow) el.scrollTop=el.scrollHeight; });
    if(content.current)observer.observe(content.current);
    return()=>{observer.disconnect();};
  },[cacheKey]);
  useLayoutEffect(follow,[cacheKey,revision]);
  return <div className="ai-scroll-shell">
    <div ref={node} className="ai-scroll-body" tabIndex={0} aria-label="解读正文滚动区域"
      onWheel={e=>{if(e.deltaY<0){memory.current.pause(cacheKey,e.currentTarget.scrollTop);setFollowing(false);}}}
      onTouchStart={e=>{memory.current.pause(cacheKey,e.currentTarget.scrollTop);setFollowing(false);}}
      onKeyDown={e=>{if(['ArrowUp','PageUp','Home'].includes(e.key)){memory.current.pause(cacheKey,e.currentTarget.scrollTop);setFollowing(false);}}}
      onScroll={e=>{const el=e.currentTarget;memory.current.save(cacheKey,el.scrollTop,el.scrollHeight,el.clientHeight);setFollowing(memory.current.read(cacheKey).follow);}}>
      <div ref={content} className="ai-scroll-content">{children}</div>
    </div>
    <div className="ai-scroll-status"><span>{following?'已跟随底部':'已暂停跟随，可向上阅读'}</span><button type="button" onClick={()=>{memory.current.bottom(cacheKey);setFollowing(true);follow();}}>回到底部</button></div>
  </div>;
}
