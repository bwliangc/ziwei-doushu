'use client';
import React from 'react';
import type { ChartRecord } from '@/lib/history/charts';
export default function ChartRecords({ records, warning, onRestore, onDelete, onClear }: { records: ChartRecord[]; warning: string; onRestore: (record: ChartRecord) => void; onDelete: (id: string) => void; onClear: () => void }) {
  return <details className="border rounded p-3 my-3 min-w-0">
    <summary className="cursor-pointer font-semibold">命盘记录（{records.length}/50）</summary>
    <p className="text-xs my-2">起盘成功后自动保存出生参数和排盘选项，仅此浏览器本机保存，不云同步，不保存 API Key。共用设备请及时删除记录。恢复记录不会自动调用 AI，可读取当前标签页已有解读缓存。</p>
    {warning && <p role="status" className="text-sm my-2">{warning}</p>}
    {!records.length && <p className="text-sm my-2">暂无命盘记录。</p>}
    <ul className="max-h-72 overflow-y-auto space-y-2">
      {records.map(record => <li key={record.id} className="border rounded p-2 min-w-0">
        <p className="text-sm break-words">{record.form.name || '未命名'} · {record.form.gender === 'male' ? '男' : '女'} · {record.form.year}-{record.form.month}-{record.form.day} · {record.form.unknownTime ? '时辰未知' : `${record.form.clockHour.padStart(2,'0')}:${record.form.clockMinute.padStart(2,'0')}`} · {record.form.province} {record.form.city}</p>
        <p className="text-xs opacity-70">保存时间：{record.createdAt.replace('T',' ').replace('Z',' UTC')}</p>
        <div className="flex gap-2 mt-2"><button type="button" className="border rounded px-2 py-1" onClick={() => onRestore(record)}>恢复命盘</button><button type="button" className="border rounded px-2 py-1" onClick={() => onDelete(record.id)}>删除记录</button></div>
      </li>)}
    </ul>
    {!!records.length && <button type="button" className="border rounded px-2 py-1 mt-3" onClick={() => { if (window.confirm('清空此浏览器保存的全部命盘记录？此操作无法撤销。')) onClear(); }}>清空全部记录</button>}
  </details>;
}
