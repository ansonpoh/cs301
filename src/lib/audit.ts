import type { AuditEvent, Crud } from './types';

const CRUD_BY_ACTION: Record<string, Crud> = {
  'Client created': 'Create',
  'Account created': 'Create',
  'User created': 'Create',
  'Transaction import': 'Create',
  'Client viewed': 'Read',
  'Client updated': 'Update',
  'User updated': 'Update',
  'User enabled': 'Update',
  'User disabled': 'Update',
  'Password reset simulated': 'Update',
  'Client deleted': 'Delete',
  'Account deleted': 'Delete',
  'User deleted': 'Delete',
  CASE_CREATED: 'Create',
  CASE_VIEWED: 'Read',
  STATUS_UPDATED: 'Update',
  ESCALATED: 'Update',
  REASSIGNED: 'Update',
  'Case SLA updated': 'Update',
  RECO_GENERATED: 'Create',
  RECO_VIEWED: 'Read',
  RECO_SIMULATED: 'Read',
  RECO_OUTCOME: 'Update',
  RECO_CONSENT: 'Update',
  RISK_VIEWED: 'Read',
  RISK_FLAGGED: 'Create',
  RISK_UPDATED: 'Update',
  INTERVENTION_LOGGED: 'Create',
  'Account activated': 'Update',
  IDENTITY_VERIFICATION_REQUESTED: 'Create',
  IDENTITY_EVIDENCE_UPLOADED: 'Create',
  IDENTITY_STATUS_UPDATED: 'Update',
  WEALTH_CASE_CREATED: 'Create',
  WEALTH_REVERIFICATION_REQUESTED: 'Create',
  WEALTH_DECLARATION_UPDATED: 'Update',
  WEALTH_EVIDENCE_UPLOADED: 'Create',
  WEALTH_CASE_SUBMITTED: 'Update',
  WEALTH_ANALYSIS_COMPLETED: 'Update',
  WEALTH_DECISION_RECORDED: 'Update',
  WEALTH_PROFILE_VIEWED: 'Read',
  WEALTH_CASE_VIEWED: 'Read',
};

// Login and logout are session events rather than CRUD operations on a record.
export const crudFor = (action: string): Crud | undefined => CRUD_BY_ACTION[action];

export const FIELD_LABELS: Record<string, string> = {
  firstName: 'First Name',
  lastName: 'Last Name',
  dob: 'Date of Birth',
  gender: 'Gender',
  email: 'Email Address',
  phone: 'Phone Number',
  address: 'Address',
  city: 'City',
  state: 'State',
  country: 'Country',
  postal: 'Postal Code',
  verification: 'Verification Status',
  role: 'Role',
  active: 'Active',
  status: 'Case Status',
  agentId: 'Assigned Agent',
  escalated: 'Escalated',
  slaBusinessDays: 'SLA (Business Days)',
  outcome: 'Recommendation Outcome',
  recoConsent: 'Recommendation Consent',
  riskStatus: 'Risk Status',
  riskLevel: 'Risk Level',
  accountStatus: 'Account Status',
  wealthStatus: 'Wealth Case Status',
};

const stars = (n: number) => '*'.repeat(Math.max(3, Math.min(n, 8)));

// PII is partially masked before it is written to the log (NFR 8d); non-PII fields keep full values.
export function maskValue(field: string, value: string): string {
  if (!value) return value;
  switch (field) {
    case 'firstName':
    case 'lastName':
    case 'address':
      return value[0] + stars(value.length - 1);
    case 'email': {
      const [local, domain] = value.split('@');
      return `${local[0]}${stars(local.length - 1)}@${domain ?? ''}`;
    }
    case 'phone':
      return value.slice(0, 3) + stars(value.length - 7) + value.slice(-4);
    case 'dob':
      return `${value.slice(0, 4)}-**-**`;
    case 'postal':
      return value.slice(0, 2) + stars(value.length - 2);
    default:
      return value;
  }
}

// Free-text case notes may contain PII, so emails, NRIC/FIN numbers and long digit runs are masked.
export const filterPii = (text: string) =>
  text
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, (m) => maskValue('email', m))
    .replace(/\b[STFGM]\d{7}[A-Z]\b/gi, (m) => `${m[0]}*******${m.slice(-1)}`)
    .replace(/\+?\d[\d -]{6,}\d/g, (m) => `${m.slice(0, 2)}****${m.slice(-2)}`);

// Appendix 2 layout: Create/Read/Delete store the Client ID; Update stores "Attr A|Attr B".
export function auditColumns(e: AuditEvent) {
  const crud = e.crud ?? crudFor(e.action);
  const changes = e.changes ?? [];
  const isUpdate = crud === 'Update' && changes.length > 0;

  return {
    crud: crud ?? '—',
    attribute: isUpdate
      ? changes.map((c) => FIELD_LABELS[c.field] ?? c.field).join('|')
      : (e.clientId ?? e.entityId),
    before: isUpdate ? changes.map((c) => c.before).join('|') : '',
    after: isUpdate ? changes.map((c) => c.after).join('|') : '',
  };
}
