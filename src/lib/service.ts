import { createSeed } from './seed';
import { validateClient } from './validation';
import { crudFor, maskValue } from './audit';
import type {
  Database,
  User,
  ClientInput,
  AccountInput,
  UserInput,
  AuditEvent,
  Transaction,
  ImportRun,
  ImportScenario,
} from './types';

export const STORAGE_KEY = 'scrooge-demo-v1';

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem'>;

export class DemoService {
  private db: Database;
  private actorId: string | null = null;
  constructor(private storage: Storage) {
    const raw = storage.getItem(STORAGE_KEY);
    try {
      const value = raw ? JSON.parse(raw) : null;
      this.db =
        value?.version === 1 &&
        ['users', 'clients', 'accounts', 'transactions', 'imports', 'audit'].every((k) =>
          Array.isArray(value[k]),
        )
          ? value
          : createSeed();
    } catch {
      this.db = createSeed();
    }
  }
  snapshot() {
    return structuredClone(this.db);
  }
  private actor() {
    const u = this.db.users.find((u) => u.id === this.actorId && u.active);
    if (!u) throw new Error('Sign in with an active demo user.');
    return u;
  }
  private admin() {
    const u = this.actor();
    if (u.role !== 'Admin') throw new Error('Administrator access required.');
    return u;
  }
  private client(id: string, edit = false) {
    const u = this.actor();
    const c = this.db.clients.find((c) => c.id === id);
    if (!c || (u.role === 'Agent' && c.agentId !== u.id)) throw new Error('Client is unavailable.');
    if (edit && u.role !== 'Agent') throw new Error('Client editing is an agent workflow.');
    return c;
  }
  private log(
    action: string,
    entityId: string,
    clientId?: string,
    changes?: AuditEvent['changes'],
    detail?: string,
  ) {
    this.db.audit.unshift({
      id: crypto.randomUUID(),
      actorId: this.actorId || 'SYSTEM',
      crud: crudFor(action),
      action,
      entityId,
      clientId,
      changes,
      detail,
      at: new Date().toISOString(),
    });
  }
  private async commit() {
    this.storage.setItem(STORAGE_KEY, JSON.stringify(this.db));
    await new Promise((resolve) => setTimeout(resolve, 180));
    return this.snapshot();
  }
  async login(id: string) {
    const user = this.db.users.find((u) => u.id === id && u.active);
    if (!user) throw new Error('This demo user is disabled or no longer exists.');
    this.actorId = id;
    this.log('Login', id);
    await this.commit();
    return user;
  }
  async logout() {
    this.actor();
    this.log('Logout', this.actorId!);
    this.actorId = null;
    return this.commit();
  }
  async resetPassword(id: string) {
    if (!this.db.users.some((u) => u.id === id && u.active))
      throw new Error('Select an active user.');
    if (this.actorId) this.admin();
    this.log(
      'Password reset simulated',
      id,
      undefined,
      undefined,
      'No email sent and no password stored.',
    );
    return this.commit();
  }
  async saveClient(input: ClientInput, id?: string) {
    const actor = this.actor();
    if (actor.role !== 'Agent') throw new Error('Only agents can edit clients.');
    const previous = id ? this.client(id, true) : null;
    const value = Object.fromEntries(
      Object.entries(input).map(([k, v]) => [k, v.trim()]),
    ) as unknown as ClientInput;
    const errors = validateClient(value, this.db.clients, id);
    if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
    if (previous) {
      const changes = (Object.keys(value) as (keyof ClientInput)[])
        .filter((k) => previous[k] !== value[k])
        .map((field) => ({
          field,
          before: maskValue(field, previous[field]),
          after: maskValue(field, value[field]),
        }));
      Object.assign(previous, value);
      this.log('Client updated', id!, id, changes);
    } else {
      id = `CL-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
      this.db.clients.unshift({
        ...value,
        id,
        agentId: actor.id,
        verification: 'Pending',
        createdAt: new Date().toISOString(),
      });
      this.log('Client created', id, id);
    }
    await this.commit();
    return id!;
  }
  async viewClient(id: string) {
    this.client(id);
    this.log('Client viewed', id, id);
    return this.commit();
  }
  async verify(id: string, outcome: 'Verified' | 'Rejected') {
    const c = this.client(id, true);
    const before = c.verification;
    c.verification = outcome;
    this.log('Identity verification simulated', id, id, [
      { field: 'verification', before, after: outcome },
    ]);
    return this.commit();
  }
  async deleteClient(id: string) {
    this.client(id, true);
    if (this.db.accounts.some((a) => a.clientId === id))
      throw new Error('Remove linked accounts before deleting this client.');
    this.db.clients = this.db.clients.filter((c) => c.id !== id);
    this.db.transactions = this.db.transactions.filter((t) => t.clientId !== id);
    this.log('Client deleted', id, id);
    return this.commit();
  }
  async createAccount(clientId: string, input: AccountInput) {
    this.client(clientId, true);
    if (
      !['Savings', 'Checking', 'Business'].includes(input.type) ||
      !['Active', 'Inactive', 'Pending'].includes(input.status) ||
      input.currency !== 'SGD' ||
      !input.branchId.trim() ||
      !/^\d{4}-\d{2}-\d{2}$/.test(input.openingDate) ||
      !Number.isFinite(input.initialDeposit) ||
      input.initialDeposit < 0
    )
      throw new Error('Complete all account fields with a non-negative initial deposit.');
    const id = `AC-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    this.db.accounts.unshift({ ...input, id, clientId });
    this.log('Account created', id, clientId);
    return this.commit();
  }
  async deleteAccount(id: string) {
    const a = this.db.accounts.find((a) => a.id === id);
    if (!a) throw new Error('Account unavailable.');
    this.client(a.clientId, true);
    this.db.accounts = this.db.accounts.filter((a) => a.id !== id);
    this.db.transactions = this.db.transactions.filter((t) => t.accountId !== id);
    this.log(
      'Account deleted',
      id,
      a.clientId,
      undefined,
      'Associated demo transaction records removed.',
    );
    return this.commit();
  }
  async saveUser(input: UserInput, id?: string) {
    this.admin();
    if (
      !/^[A-Za-z ]{2,50}$/.test(input.firstName) ||
      !/^[A-Za-z ]{2,50}$/.test(input.lastName) ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email) ||
      !['Admin', 'Agent'].includes(input.role)
    )
      throw new Error('Enter valid names, email, and role.');
    if (
      this.db.users.some((u) => u.id !== id && u.email.toLowerCase() === input.email.toLowerCase())
    )
      throw new Error('This email is already registered.');
    const u = this.db.users.find((u) => u.id === id);
    if (id && !u) throw new Error('User unavailable.');
    if (u?.root && input.role !== 'Admin')
      throw new Error('The root administrator cannot be demoted.');
    if (
      u?.role === 'Agent' &&
      input.role === 'Admin' &&
      this.db.clients.some((c) => c.agentId === id)
    )
      throw new Error('An agent with assigned clients cannot change roles.');
    if (u) {
      const changes = (Object.keys(input) as (keyof UserInput)[])
        .filter((k) => u[k] !== input[k])
        .map((field) => ({
          field,
          before: maskValue(field, u[field]),
          after: maskValue(field, input[field]),
        }));
      Object.assign(u, input);
      this.log('User updated', u.id, undefined, changes);
    } else {
      const uid = `USR-${crypto.randomUUID().slice(0, 8)}`;
      this.db.users.push({ ...input, id: uid, active: true });
      this.log('User created', uid);
    }
    return this.commit();
  }
  async changeUser(id: string, action: 'toggle' | 'delete') {
    const actor = this.admin();
    const u = this.db.users.find((u) => u.id === id);
    if (!u) throw new Error('User unavailable.');
    if (u.root) throw new Error('The root administrator is protected.');
    if (actor.id === id) throw new Error('You cannot disable or delete your current session user.');
    if (action === 'delete' && this.db.clients.some((c) => c.agentId === id))
      throw new Error('An agent with assigned clients cannot be deleted.');
    if (action === 'delete') this.db.users = this.db.users.filter((u) => u.id !== id);
    else u.active = !u.active;
    if (action === 'delete') this.log('User deleted', id);
    else
      this.log(u.active ? 'User enabled' : 'User disabled', id, undefined, [
        { field: 'active', before: String(!u.active), after: String(u.active) },
      ]);
    return this.commit();
  }
  async importTransactions(scenario: ImportScenario) {
    const actor = this.actor();
    if (actor.role !== 'Agent') throw new Error('Sign in as an agent to import transactions.');
    const startedAt = new Date().toISOString();
    const source = `core-banking-feed-${startedAt.slice(0, 19).replace(/\D/g, '')}.${scenario === 'corrupted' ? 'xls' : 'csv'}`;
    const accounts = this.db.accounts.filter((a) =>
      this.db.clients.some((c) => c.id === a.clientId && c.agentId === actor.id),
    );
    if (!accounts.length) throw new Error('Create a client account before importing transactions.');
    const candidates: Transaction[] = accounts.slice(0, 3).map((a, i) => ({
      id: `TX-DEMO-${scenario}-${a.id}`,
      clientId: a.clientId,
      accountId: a.id,
      type: i % 2 ? 'Withdrawal' : 'Deposit',
      amount: 1250 + i * 850,
      date: new Date().toISOString(),
      status: 'Completed',
    }));
    const errors: string[] = [];
    let accepted = 0,
      rejected = 0;
    if (scenario === 'failed') {
      errors.push(
        'External service connection failed (simulated): core banking host did not respond. No records received.',
      );
    } else if (scenario === 'corrupted') {
      errors.push(
        `${source}: unsupported or corrupted file format (expected UTF-8 CSV with a header row). File rejected before parsing.`,
      );
    } else if (scenario === 'exception') {
      // Rows parse, but the batch write fails, so nothing is committed.
      rejected = candidates.length;
      errors.push(
        `System exception during batch write (simulated): ${candidates.length} parsed record(s) rolled back.`,
      );
    } else {
      for (const row of candidates) {
        if (this.db.transactions.some((t) => t.id === row.id)) {
          errors.push(`${row.id}: duplicate transaction ID.`);
          rejected++;
        } else {
          this.db.transactions.unshift(row);
          accepted++;
        }
      }
      if (scenario === 'partial') {
        errors.push(`Row ${candidates.length + 1}: amount "12,5O0.00" is not a valid number.`);
        rejected++;
      }
    }

    const run: ImportRun = {
      id: `IMP-${crypto.randomUUID().slice(0, 8)}`,
      actorId: actor.id,
      source,
      startedAt,
      endedAt: new Date().toISOString(),
      status: accepted === 0 ? 'Failed' : rejected ? 'Partially Successful' : 'Successful',
      processed: accepted + rejected,
      accepted,
      rejected,
      errors,
    };
    this.db.imports.unshift(run);
    this.log(
      'Transaction import',
      run.id,
      undefined,
      undefined,
      `${source} · ${run.status}; processed ${run.processed}, accepted ${accepted}, rejected ${rejected}. ${errors.join(' ')}`,
    );
    return this.commit();
  }
  async reset() {
    this.admin();
    this.db = createSeed();
    this.actorId = null;
    return this.commit();
  }
}
