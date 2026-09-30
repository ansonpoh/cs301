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

export interface Database {
  version: 1;
  users: User[];
  clients: Client[];
  accounts: Account[];
  transactions: Transaction[];
  imports: ImportRun[];
  audit: AuditEvent[];
}

export type ClientInput = Omit<Client, 'id' | 'agentId' | 'verification' | 'createdAt'>;
export type UserInput = Pick<User, 'firstName' | 'lastName' | 'email' | 'role'>;
export type AccountInput = Omit<Account, 'id' | 'clientId'>;
