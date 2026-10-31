import type { BirthFormState } from '@/components/BirthForm';
import { birthInfoFromForm } from '../ziwei/form-input';
import { chartIdentity } from '../ai/dimensions';
export const HISTORY_KEY = 'ziwei-chart-history-v1';
export const MAX_RECORDS = 50;
export interface ChartRecord { id: string; createdAt: string; form: BirthFormState; rule: 'birth-form-v1' }
interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }
function integer(value: unknown, min: number, max: number) { return typeof value === 'string' && /^\d{1,4}$/.test(value) && Number(value)>=min && Number(value)<=max; }
export function validateHistoryForm(value: unknown): BirthFormState | null {
  if (!value || typeof value !== 'object') return null;
  const f = value as Record<string, unknown>;
  if (!integer(f.year,1900,2100) || !integer(f.month,1,12) || !integer(f.day,1,31) || !['male','female'].includes(String(f.gender)) || typeof f.unknownTime !== 'boolean') return null;
  const date=new Date(Number(f.year),Number(f.month)-1,Number(f.day));
  if(date.getFullYear()!==Number(f.year)||date.getMonth()+1!==Number(f.month)||date.getDate()!==Number(f.day))return null;
  for(const field of ['name','province','city'])if(typeof f[field]!=='string'||(f[field] as string).length>80)return null;
  if(typeof f.longitude!=='number'||!Number.isFinite(f.longitude)||Math.abs(f.longitude)>180)return null;
  if(!integer(f.clockHour,0,23) && !(f.unknownTime && f.clockHour===''))return null;
  if(!integer(f.clockMinute,0,59) && !(f.unknownTime && f.clockMinute===''))return null;
  return {name:f.name as string, year:String(Number(f.year)),month:String(Number(f.month)),day:String(Number(f.day)),clockHour:f.clockHour===''?'':String(Number(f.clockHour)),clockMinute:f.clockMinute===''?'':String(Number(f.clockMinute)),unknownTime:f.unknownTime,province:f.province as string,city:f.city as string,longitude:f.longitude,gender:f.gender as 'male'|'female'};
}
export function recordIdentity(form: BirthFormState) {
  return chartIdentity({birthInfo:birthInfoFromForm(form),options:{clockHour:form.clockHour,clockMinute:form.clockMinute,unknownTime:form.unknownTime},rule:'birth-form-v1'});
}
export class ChartHistory {
  records: ChartRecord[] = []; warning = '';
  constructor(private storage: StorageLike | null) {}
  load() {
    try {
      const raw=this.storage?.getItem(HISTORY_KEY);if(!raw)return this.records;
      if(raw.length>256000)throw new Error('size');
      const data=JSON.parse(raw);if(data.version!==1||!Array.isArray(data.records))throw new Error('schema');
      const seen=new Set<string>();const rows:ChartRecord[]=[];
      for(const r of data.records.slice(0,200)) {
        const form=validateHistoryForm(r?.form);
        if(!form||r.rule!=='birth-form-v1'||typeof r.createdAt!=='string'||!Number.isFinite(Date.parse(r.createdAt))){this.warning='部分命盘记录损坏，已忽略。';continue;}
        const id=recordIdentity(form);if(seen.has(id))continue;seen.add(id);rows.push({id,form,rule:'birth-form-v1',createdAt:r.createdAt});
      }
      this.records=rows.slice(0,MAX_RECORDS);
    } catch {this.warning='本机记录不可读取或已损坏，本次仍可正常起盘。';}
    return this.records;
  }
  private save() { try { if(!this.storage)throw new Error('unavailable');this.storage.setItem(HISTORY_KEY,JSON.stringify({version:1,records:this.records}));this.warning=''; } catch {this.warning='浏览器存储不可用或空间不足，记录仅在当前页面暂存。';} }
  add(value: unknown, now=new Date().toISOString()) {
    const form=validateHistoryForm(value);if(!form)throw new Error('出生参数无效，未保存记录。');
    const id=recordIdentity(form);this.records=[{id,form,createdAt:now,rule:'birth-form-v1'},...this.records.filter(r=>r.id!==id)].slice(0,MAX_RECORDS);this.save();return this.records;
  }
  remove(id:string){this.records=this.records.filter(r=>r.id!==id);this.save();}
  clear(){this.records=[];this.save();}
}
