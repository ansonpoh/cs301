import type {
  Account,
  AiMode,
  Case,
  Client,
  OfferTerms,
  Product,
  ProductCategory,
  RecommendationSet,
  Simulation,
  Transaction,
} from './types';

export const MODEL = 'bedrock-nba-sim-1';
export const PROMPT_VERSION = 'nba-prompt-v1.2';
export const SUPPRESSION_DAYS = 90;
export const REJECT_REASONS = [
  'Not interested right now',
  'Already has a similar product elsewhere',
  'Rate or fees not competitive',
  'Affordability concerns',
  'Other',
];
export const DEFER_REASONS = [
  'Wants to discuss with family',
  'Waiting for funds to mature',
  'Asked to be contacted later',
  'Other',
];

const DAY = 86_400_000;
const sgd = (v: number) =>
  new Intl.NumberFormat('en-SG', { style: 'currency', currency: 'SGD', maximumFractionDigits: 0 })
    .format(v)
    .replace('$', 'S$');

export interface Signals {
  age: number;
  tenureMonths: number;
  verified: boolean;
  accountTypes: Account['type'][];
  relationshipValue: number;
  monthlyInflow: number;
  withdrawalShare: number;
  openCases: number;
}

export function signals(
  client: Client,
  accounts: Account[],
  transactions: Transaction[],
  cases: Case[],
  now = new Date(),
): Signals {
  const birth = new Date(client.dob + 'T00:00:00');
  let age = now.getFullYear() - birth.getFullYear();
  if (now < new Date(now.getFullYear(), birth.getMonth(), birth.getDate())) age--;
  const done = transactions.filter((t) => t.status === 'Completed');
  const deposits = done.filter((t) => t.type === 'Deposit').reduce((n, t) => n + t.amount, 0);
  const withdrawals = done.filter((t) => t.type === 'Withdrawal').reduce((n, t) => n + t.amount, 0);
  // Average monthly deposits over the client's own activity window, at least one month.
  const times = done.map((t) => Date.parse(t.date));
  const months = times.length
    ? Math.max(1, (Math.max(...times) - Math.min(...times)) / (30 * DAY))
    : 1;
  return {
    age,
    tenureMonths: Math.max(
      0,
      Math.floor((now.getTime() - Date.parse(client.createdAt)) / (30 * DAY)),
    ),
    verified: client.verification === 'Verified',
    accountTypes: [...new Set(accounts.map((a) => a.type))],
    relationshipValue: accounts.reduce((n, a) => n + a.initialDeposit, 0) + deposits - withdrawals,
    monthlyInflow: Math.round(deposits / months),
    withdrawalShare: deposits + withdrawals ? withdrawals / (deposits + withdrawals) : 0,
    openCases: cases.filter((c) => c.status !== 'Resolved').length,
  };
}

// Guardrail step: only banded, non-identifying values leave the CRM. No name, contact, NRIC or IDs.
export function maskedPayload(s: Signals) {
  const band = (v: number, step: number) =>
    `${Math.floor(v / step) * step}–${Math.floor(v / step) * step + step - 1}`;
  return {
    ageBand: band(s.age, 10),
    tenureMonths: s.tenureMonths,
    identityVerified: s.verified,
    accountTypesHeld: s.accountTypes,
    relationshipValueBand: `S$${band(Math.max(0, s.relationshipValue), 10_000)}`,
    monthlyInflowBand: `S$${band(s.monthlyInflow, 1_000)}`,
    withdrawalShare: Math.round(s.withdrawalShare * 100) / 100,
    unresolvedServiceCases: s.openCases,
  };
}

export function eligibility(p: Product, s: Signals): string | null {
  const e = p.eligibility;
  if (s.age < e.minAge || s.age > e.maxAge) return `Age outside ${e.minAge}–${e.maxAge}`;
  if (e.requiresVerified && !s.verified) return 'Identity not verified';
  if (e.minRelationship && s.relationshipValue < e.minRelationship)
    return `Relationship value below ${sgd(e.minRelationship)}`;
  if (e.minMonthlyInflow && s.monthlyInflow < e.minMonthlyInflow)
    return `Monthly inflow below ${sgd(e.minMonthlyInflow)}`;
  if (e.excludesAccountType && s.accountTypes.includes(e.excludesAccountType))
    return `Already holds a ${e.excludesAccountType.toLowerCase()} account`;
  return null;
}

// Deterministic eligibility-rule scoring. This is the FALLBACK path and the baseline for the AI.
export function ruleScore(p: Product, s: Signals) {
  const reasons: string[] = [];
  let score = 40;
  const add = (points: number, reason: string) => {
    score += points;
    reasons.push(reason);
  };
  switch (p.category) {
    case 'Deposits':
      add(
        Math.min(30, Math.round(s.relationshipValue / 5_000)),
        `Relationship value of ${sgd(s.relationshipValue)}`,
      );
      if (s.withdrawalShare < 0.25)
        add(
          15,
          `Low withdrawals (${Math.round(s.withdrawalShare * 100)}% of flow) suggest idle funds`,
        );
      break;
    case 'Accounts':
      add(12, `No ${p.opensAccount?.toLowerCase()} account held yet`);
      if (s.monthlyInflow > 5_000)
        add(8, `Regular inflows of about ${sgd(s.monthlyInflow)} a month`);
      break;
    case 'Cards':
      add(
        Math.min(15, Math.round(s.monthlyInflow / 1_000)),
        `Monthly inflow of about ${sgd(s.monthlyInflow)}`,
      );
      if (s.age < 45) add(10, 'Age group with high card usage');
      break;
    case 'Loans':
      if (s.withdrawalShare > 0.3)
        add(
          20,
          `Withdrawals are ${Math.round(s.withdrawalShare * 100)}% of flow, indicating spending needs`,
        );
      add(Math.min(20, Math.round(s.monthlyInflow / 1_000)), `Stable inflow supports repayments`);
      break;
    case 'Investments':
      add(
        Math.min(35, Math.round(s.relationshipValue / 10_000)),
        `Investable balance of ${sgd(s.relationshipValue)}`,
      );
      if (s.tenureMonths >= 1) add(5, 'Established relationship with the bank');
      break;
    case 'Insurance':
      if (s.age >= 30 && s.age <= 50) add(20, `Age ${s.age}: peak protection-need years`);
      else reasons.push(`Age ${s.age} within cover range`);
      break;
  }
  if (s.openCases) add(-15, 'Unresolved service case: resolve it before cross-selling');
  return { score: Math.max(1, Math.min(99, score)), reasons };
}

export type AiItem = { productId: string; score: number; reasons: string[] };

// Stands in for the hosted model. It sees only the masked payload and the catalogue.
export function callAiService(
  payload: ReturnType<typeof maskedPayload>,
  catalogue: Product[],
  s: Signals,
  mode: AiMode,
): unknown {
  if (mode === 'unavailable') throw new Error('AI service timeout after 8s (simulated)');
  if (mode === 'invalid')
    return { recommendations: [{ productId: 'PRD-UNKNOWN', score: 140, reasons: [] }] };
  return {
    recommendations: catalogue
      .map((p) => {
        const base = ruleScore(p, s);
        // The model weighs relationship depth slightly more than the rules do.
        const lift = payload.tenureMonths >= 1 && p.category !== 'Insurance' ? 4 : 0;
        return {
          productId: p.id,
          score: Math.min(99, base.score + lift),
          reasons: [
            ...base.reasons,
            `Clients with a similar profile (age ${payload.ageBand}, ${payload.relationshipValueBand}) often take up ${p.name}`,
          ],
        };
      })
      .sort((a, b) => b.score - a.score),
  };
}

// Model output never overrides the catalogue or eligibility rules.
export function validateAiOutput(output: unknown, eligibleIds: Set<string>): AiItem[] | null {
  const rows = (output as { recommendations?: unknown })?.recommendations;
  if (!Array.isArray(rows)) return null;
  const valid = rows.filter(
    (r): r is AiItem =>
      typeof r?.productId === 'string' &&
      typeof r.score === 'number' &&
      r.score >= 0 &&
      r.score <= 100 &&
      Array.isArray(r.reasons) &&
      r.reasons.length > 0,
  );
  if (valid.length !== rows.length) return null;
  return valid.filter((r) => eligibleIds.has(r.productId));
}

export function suppressedCategories(
  sets: RecommendationSet[],
  products: Product[],
  now = Date.now(),
) {
  const until = new Map<ProductCategory, string>();
  for (const set of sets)
    for (const r of set.items) {
      const p = products.find((p) => p.id === r.productId);
      if (r.outcome?.type !== 'Rejected' || !p) continue;
      const end = new Date(Date.parse(r.outcome.at) + SUPPRESSION_DAYS * DAY).toISOString();
      if (Date.parse(end) > now && (!until.has(p.category) || end > until.get(p.category)!))
        until.set(p.category, end);
    }
  return until;
}

export function fingerprint(
  client: Client,
  accounts: Account[],
  transactions: Transaction[],
  openCases: number,
  suppressed: string[],
  products: Product[],
) {
  const text = JSON.stringify([
    client,
    accounts.map((a) => [a.id, a.type, a.status, a.initialDeposit]),
    transactions.map((t) => [t.id, t.status, t.amount]),
    openCases,
    suppressed,
    products.map((p) => p.id),
  ]);
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16);
}

export function simulateTerms(p: Product, terms: OfferTerms, s: Signals): Omit<Simulation, 'at'> {
  const t = p.terms;
  if (!t) throw new Error('This product has no adjustable terms.');
  const check = (
    value: number | undefined,
    r: { min: number; max: number } | undefined,
    label: string,
  ) => {
    if (!r) return;
    if (value === undefined || !Number.isFinite(value)) throw new Error(`Enter the ${label}.`);
    if (value < r.min || value > r.max)
      throw new Error(`${label[0].toUpperCase()}${label.slice(1)} must be ${r.min}–${r.max}.`);
  };
  check(terms.amount, t.amount, 'amount');
  check(terms.tenureMonths, t.tenureMonths, 'tenure');
  check(terms.rate, t.rate, 'rate');
  const pa = p.preApproval ?? {};
  const reasons: string[] = [];
  if (pa.maxAmountShare !== undefined && terms.amount !== undefined) {
    const cap = Math.max(0, Math.floor(s.relationshipValue * pa.maxAmountShare));
    if (terms.amount > cap) reasons.push(`Amount exceeds the pre-approved ${sgd(cap)}`);
  }
  if (pa.maxTenureMonths && (terms.tenureMonths ?? 0) > pa.maxTenureMonths)
    reasons.push(`Tenure above the pre-approved ${pa.maxTenureMonths} months`);
  if (pa.rateAtLeast !== undefined && (terms.rate ?? Infinity) < pa.rateAtLeast)
    reasons.push(`Rate below the pre-approved floor of ${pa.rateAtLeast}%`);
  if (pa.rateAtMost !== undefined && (terms.rate ?? 0) > pa.rateAtMost)
    reasons.push(`Rate above the pre-approved ceiling of ${pa.rateAtMost}%`);
  return {
    terms,
    result: reasons.length ? 'Manager override required' : 'Pre-approved',
    reasons: reasons.length ? reasons : ['Within pre-approved limits for this client'],
  };
}

export const describeTerms = (t: OfferTerms) =>
  [
    t.amount !== undefined && `amount ${sgd(t.amount)}`,
    t.tenureMonths !== undefined && `${t.tenureMonths} months`,
    t.rate !== undefined && `${t.rate}%`,
  ]
    .filter(Boolean)
    .join(', ');
