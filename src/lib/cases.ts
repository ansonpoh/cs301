import type { Case, CaseCategory, CaseStatus } from './types';

export const CASE_CATEGORIES: CaseCategory[] = [
  'Transaction dispute',
  'Service complaint',
  'Account issue',
  'Other',
];
export const CASE_STATUSES: CaseStatus[] = ['Open', 'Investigating', 'Resolved'];
// Cases only move forward: Open → Investigating → Resolved.
export const NEXT_STATUS: Partial<Record<CaseStatus, CaseStatus>> = {
  Open: 'Investigating',
  Investigating: 'Resolved',
};

const DAY = 86_400_000;
const weekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6;
const nextMidnight = (d: Date) => {
  const n = new Date(d);
  n.setHours(24, 0, 0, 0);
  return n;
};

// Elapsed working time in days, skipping weekends. Public holidays are ignored in the demo.
export function businessDaysBetween(from: string, to = new Date()) {
  let ms = 0;
  const cur = new Date(from);
  while (cur < to) {
    const next = nextMidnight(cur);
    const end = next < to ? next : to;
    if (!weekend(cur)) ms += end.getTime() - cur.getTime();
    cur.setTime(end.getTime());
  }
  return ms / DAY;
}

export function slaDueAt(from: string, days: number) {
  const d = new Date(from);
  let left = days * DAY;
  while (left > 0) {
    const next = nextMidnight(d);
    const step = weekend(d)
      ? next.getTime() - d.getTime()
      : Math.min(left, next.getTime() - d.getTime());
    if (!weekend(d)) left -= step;
    d.setTime(d.getTime() + step);
  }
  return d.toISOString();
}

export const isEscalated = (c: Case) => c.escalated && c.status !== 'Resolved';

export function duration(ms: number) {
  const m = Math.max(0, Math.floor(ms / 60_000));
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  return d ? `${d}d ${h}h` : h ? `${h}h ${m % 60}m` : `${m}m`;
}

// Resolved cases stop ageing at their resolution time.
export const caseAgeMs = (c: Case, now = Date.now()) =>
  (c.resolvedAt ? Date.parse(c.resolvedAt) : now) - Date.parse(c.createdAt);
