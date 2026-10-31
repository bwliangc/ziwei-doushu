import type { BirthFormState } from '@/components/BirthForm';
import type { BirthInfo } from './types';
import { calcTrueSolarBranch } from './share';
/** Actual BirthForm v1 rules. Keep history restore identical to the original submission. */
export function birthInfoFromForm(form: BirthFormState): BirthInfo {
  return { year: Number(form.year), month: Number(form.month), day: Number(form.day),
    hour: form.unknownTime ? 0 : calcTrueSolarBranch(Number(form.clockHour), Number(form.clockMinute), form.longitude),
    gender: form.gender, name: form.name || undefined, province: form.province || undefined,
    city: form.city || undefined, longitude: form.province ? form.longitude : undefined };
}
export function shouldAutoInterpret(source: 'new' | 'history', configured: boolean) { return source === 'new' && configured; }
