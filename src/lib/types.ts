export type Role = 'Admin' | 'Agent';
export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  active: boolean;
  root?: boolean;
}

export interface Client {
  id: string;
  agentId: string;
  firstName: string;
  lastName: string;
  dob: string;
  gender: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postal: string;
  verification: 'Pending' | 'Verified' | 'Rejected';
  createdAt: string;
}

export interface Account {
  id: string;
  clientId: string;
  type: 'Savings' | 'Checking' | 'Business';
  status: 'Active' | 'Inactive' | 'Pending';
  openingDate: string;
  initialDeposit: number;
  currency: 'SGD';
  branchId: string;
}

export interface Transaction {
  id: string;
  clientId: string;
  accountId: string;
  type: 'Deposit' | 'Withdrawal';
  amount: number;
  date: string;
  status: 'Completed' | 'Pending' | 'Failed';
}

export type ImportScenario = 'success' | 'partial' | 'failed' | 'corrupted' | 'exception';
export interface ImportRun {
  id: string;
  actorId: string;
  source?: string;
  startedAt: string;
  endedAt: string;
  status: 'Successful' | 'Partially Successful' | 'Failed';
  processed: number;
  accepted: number;
  rejected: number;
  errors: string[];
}

export type Crud = 'Create' | 'Read' | 'Update' | 'Delete';
export interface AuditEvent {
  id: string;
  actorId: string;
  crud?: Crud;
  action: string;
  entityId: string;
  clientId?: string;
  at: string;
  changes?: { field: string; before: string; after: string }[];
  detail?: string;
}

export type CaseCategory = 'Transaction dispute' | 'Service complaint' | 'Account issue' | 'Other';
export type CaseStatus = 'Open' | 'Investigating' | 'Resolved';
export interface CaseEvent {
  type: 'CASE_CREATED' | 'STATUS_UPDATED' | 'ESCALATED' | 'REASSIGNED';
  at: string;
  // Escalations are system-triggered, so they carry no actor.
  actorId?: string;
  from?: string;
  to?: string;
  note?: string;
  reason?: string;
}
export interface Case {
  id: string;
  clientId: string;
  agentId: string;
  category: CaseCategory;
  description: string;
  transactionId?: string;
  status: CaseStatus;
  escalated: boolean;
  createdAt: string;
  // SLA clock; restarts when an admin reassigns the case.
  slaStartedAt: string;
  resolvedAt?: string;
  // Status notes live on STATUS_UPDATED entries, so a new case starts with no notes.
  history: CaseEvent[];
}
export interface CaseFilters {
  status?: CaseStatus | 'Escalated';
  category?: CaseCategory;
  clientId?: string;
  agentId?: string;
  transactionId?: string;
  caseId?: string;
}
export type CaseInput = Pick<Case, 'clientId' | 'category' | 'description' | 'transactionId'>;

export type ProductCategory =
  'Deposits' | 'Accounts' | 'Cards' | 'Loans' | 'Investments' | 'Insurance';
export interface Range {
  min: number;
  max: number;
}
export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  summary: string;
  eligibility: {
    minAge: number;
    maxAge: number;
    minRelationship?: number;
    minMonthlyInflow?: number;
    requiresVerified?: boolean;
    // Not offered to clients who already hold this account type.
    excludesAccountType?: Account['type'];
  };
  // Absolute bounds an agent can enter when simulating terms.
  terms?: { amount?: Range; tenureMonths?: Range; rate?: Range };
  // Requests inside these limits are pre-approved; outside them need a manager override.
  preApproval?: {
    maxAmountShare?: number;
    maxTenureMonths?: number;
    rateAtLeast?: number;
    rateAtMost?: number;
  };
  opensAccount?: Account['type'];
}
export type OfferTerms = { amount?: number; tenureMonths?: number; rate?: number };
export interface Simulation {
  at: string;
  terms: OfferTerms;
  result: 'Pre-approved' | 'Manager override required';
  reasons: string[];
}
export type RecoOutcomeType = 'Accepted' | 'Rejected' | 'Deferred';
export type FulfilmentChannel = 'Application link' | 'Brochure' | 'Open account';
export interface RecoOutcome {
  type: RecoOutcomeType;
  at: string;
  agentId: string;
  reason?: string;
  channel?: FulfilmentChannel;
  accountId?: string;
  followUpAt?: string;
}
export interface Recommendation {
  id: string;
  productId: string;
  rank: number;
  score: number;
  reasons: string[];
  simulations: Simulation[];
  outcome?: RecoOutcome;
}
export interface RecommendationSet {
  id: string;
  clientId: string;
  agentId: string;
  createdAt: string;
  status: 'Current' | 'Outdated';
  source: 'AI' | 'FALLBACK';
  model: string;
  promptVersion: string;
  fallbackReason?: string;
  // Client data the set was built from; a change marks the set outdated.
  fingerprint: string;
  // Exactly what was sent to the AI service, after PII masking.
  payload: Record<string, unknown>;
  items: Recommendation[];
}
export type AiMode = 'normal' | 'unavailable' | 'invalid';

export type RiskLevel = 'High' | 'Medium' | 'Low';
export type RiskStatus = 'At Risk' | 'Under Review' | 'Mitigated' | 'Churned';
export type InterventionType =
  | 'Fee Waiver Offered'
  | 'Financial Review Conducted'
  | 'Follow-up Scheduled'
  | 'Retention Offer Made'
  | 'Relationship Check-in';
export interface RiskEvent {
  type: 'RISK_FLAGGED' | 'RISK_UPDATED' | 'INTERVENTION_LOGGED' | 'STATUS_UPDATED';
  at: string;
  // Flags and level changes come from the scheduled job, so they carry no actor.
  actorId?: string;
  from?: string;
  to?: string;
  note?: string;
  interventionId?: string;
}
export interface RiskProfile {
  clientId: string;
  level: RiskLevel;
  score: number;
  // Triggering reasons from the latest analysis, strongest first.
  reasons: string[];
  status: RiskStatus;
  flaggedAt: string;
  closedAt?: string;
  history: RiskEvent[];
}
export interface Intervention {
  id: string;
  clientId: string;
  agentId: string;
  type: InterventionType;
  // May contain PII: encrypted at rest in production, PII-filtered before logging.
  notes: string;
  at: string;
  followUpAt?: string;
}
export interface RiskFilters {
  level?: RiskLevel;
  // Defaults to open profiles (At Risk or Under Review).
  status?: RiskStatus | 'Open' | 'All';
  agentId?: string;
  clientId?: string;
}
export type InterventionInput = Pick<Intervention, 'type' | 'notes' | 'followUpAt'>;

export interface Database {
  version: 1;
  users: User[];
  clients: Client[];
  accounts: Account[];
  transactions: Transaction[];
  imports: ImportRun[];
  audit: AuditEvent[];
  cases: Case[];
  caseSettings: { slaBusinessDays: number };
  products: Product[];
  recoSets: RecommendationSet[];
  // Clients who withdrew consent to product recommendations.
  recoOptOuts: string[];
  riskProfiles: RiskProfile[];
  interventions: Intervention[];
  riskJob: { lastRunAt?: string; asOf?: string };
}

export type ClientInput = Omit<Client, 'id' | 'agentId' | 'verification' | 'createdAt'>;
export type UserInput = Pick<User, 'firstName' | 'lastName' | 'email' | 'role'>;
export type AccountInput = Omit<Account, 'id' | 'clientId'>;
