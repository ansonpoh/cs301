import type {
  Account,
  Case,
  InterventionType,
  RiskLevel,
  RiskProfile,
  RiskStatus,
  Transaction,
} from './types';

export const RISK_LEVELS: RiskLevel[] = ['High', 'Medium', 'Low'];
export const RISK_STATUSES: RiskStatus[] = ['At Risk', 'Under Review', 'Mitigated', 'Churned'];
// At Risk → Under Review → Mitigated or Churned. Mitigated and Churned close the profile.
export const RISK_TRANSITIONS: Record<RiskStatus, RiskStatus[]> = {
  'At Risk': ['Under Review', 'Churned'],
  'Under Review': ['Mitigated', 'Churned'],
  Mitigated: [],
  Churned: [],
};
export const INTERVENTION_TYPES: InterventionType[] = [
  'Fee Waiver Offered',
  'Financial Review Conducted',
  'Follow-up Scheduled',
  'Retention Offer Made',
  'Relationship Check-in',
];
// A closed profile is only flagged again once this many days have passed since it closed.
export const REFLAG_AFTER_DAYS = 30;

export const isOpenRisk = (p: Pick<RiskProfile, 'status'>) =>
  p.status === 'At Risk' || p.status === 'Under Review';

const DAY = 86_400_000;
const WINDOW_DAYS = 30;
const sgd = (v: number) =>
  new Intl.NumberFormat('en-SG', { style: 'currency', currency: 'SGD', maximumFractionDigits: 0 })
    .format(v)
    .replace('$', 'S$');

// The job analyses ingested core-banking data, so "today" is the latest completed transaction,
// never later than now. Without a fresh feed, quiet clients are not mistaken for inactive ones.
export function analysisDate(transactions: Transaction[], now = new Date()) {
  const latest = transactions
    .filter((t) => t.status === 'Completed')
    .reduce((m, t) => Math.max(m, Date.parse(t.date)), 0);
  return new Date(latest ? Math.min(latest, now.getTime()) : now.getTime());
}

export interface RiskAnalysis {
  score: number;
  level: RiskLevel;
  reasons: string[];
  // Running balance (initial deposits plus completed flows) over the 30-day window.
  series: { at: string; balance: number }[];
}

export function analyseRisk(
  accounts: Account[],
  transactions: Transaction[],
  cases: Case[],
  asOf: Date,
): RiskAnalysis | null {
  if (!accounts.length) return null;
  const end = asOf.getTime();
  const start = end - WINDOW_DAYS * DAY;
  const done = transactions
    .filter((t) => t.status === 'Completed' && Date.parse(t.date) <= end)
    .sort((a, b) => a.date.localeCompare(b.date));
  const signed = (t: Transaction) => (t.type === 'Deposit' ? t.amount : -t.amount);
  const opened = Math.min(...accounts.map((a) => Date.parse(a.openingDate)));

  let balance = accounts.reduce((n, a) => n + a.initialDeposit, 0);
  for (const t of done) if (Date.parse(t.date) < start) balance += signed(t);
  const series = [{ at: new Date(Math.max(start, opened)).toISOString(), balance }];
  for (const t of done.filter((t) => Date.parse(t.date) >= start)) {
    balance += signed(t);
    series.push({ at: t.date, balance });
  }
  series.push({ at: asOf.toISOString(), balance });

  const signals: { points: number; reason: string }[] = [];
  const peak = Math.max(...series.map((p) => p.balance));
  const drop = peak > 0 ? (peak - balance) / peak : 0;
  if (drop >= 0.25)
    signals.push({
      points: drop >= 0.5 ? 50 : 25,
      reason: `${Math.round(drop * 100)}% balance drop in ${WINDOW_DAYS} days (${sgd(peak)} → ${sgd(balance)})`,
    });

  const last = done.at(-1);
  const idleDays = Math.floor((end - (last ? Date.parse(last.date) : opened)) / DAY);
  if (idleDays >= WINDOW_DAYS)
    signals.push({ points: 40, reason: `No account activity for ${idleDays} days` });

  // Halted payroll: regular deposits before, none in the last three weeks.
  const deposits = done.filter((t) => t.type === 'Deposit');
  const recentFrom = end - 21 * DAY;
  const earlier = deposits.filter(
    (t) => Date.parse(t.date) < recentFrom && Date.parse(t.date) >= end - 90 * DAY,
  );
  if (earlier.length >= 2 && !deposits.some((t) => Date.parse(t.date) >= recentFrom))
    signals.push({
      points: 35,
      reason: `Deposits stopped: none in 21 days, after ${earlier.length} in the prior 2 months`,
    });

  const recent = done.filter((t) => Date.parse(t.date) >= start).length;
  const prior = done.filter(
    (t) => Date.parse(t.date) < start && Date.parse(t.date) >= start - WINDOW_DAYS * DAY,
  ).length;
  if (prior >= 4 && recent <= prior / 2)
    signals.push({
      points: 20,
      reason: `Transaction frequency down ${Math.round((1 - recent / prior) * 100)}% (${prior} → ${recent} a month)`,
    });

  // A service issue is a contributing factor only, never a flag on its own.
  const open = cases.filter((c) => c.status !== 'Resolved');
  if (signals.length && open.length)
    signals.push({
      points: 10,
      reason: `Unresolved ${open[0].category.toLowerCase()} (${open.map((c) => c.id).join(', ')})`,
    });

  // Low means "not flagged": the job only raises a flag at Medium or above.
  const score = Math.min(
    99,
    signals.reduce((n, s) => n + s.points, 0),
  );
  return {
    score,
    level: score >= 50 ? 'High' : score >= 25 ? 'Medium' : 'Low',
    reasons: signals.sort((a, b) => b.points - a.points).map((s) => s.reason),
    series,
  };
}

export const retentionRate = (profiles: RiskProfile[]) => {
  const mitigated = profiles.filter((p) => p.status === 'Mitigated').length;
  const closed = mitigated + profiles.filter((p) => p.status === 'Churned').length;
  return closed ? Math.round((mitigated / closed) * 100) : null;
};
