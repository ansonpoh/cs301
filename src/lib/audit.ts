import type { AuditEvent, Crud } from './types';

const CRUD_BY_ACTION: Record<string, Crud> = {
  'Client created': 'Create',
  'Account created': 'Create',
  'User created': 'Create',
  'Transaction import': 'Create',
  'Client viewed': 'Read',
  'Client updated': 'Update',
  'Identity verification simulated': 'Update',
  'User updated': 'Update',
  'User enabled': 'Update',
  'User disabled': 'Update',
  'Password reset simulated': 'Update',
  'Client deleted': 'Delete',
  'Account deleted': 'Delete',
  'User deleted': 'Delete',
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
