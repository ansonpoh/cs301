import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DemoService, STORAGE_KEY } from './service';
import { validateClient } from './validation';
import { auditColumns, maskValue } from './audit';
import type { ClientInput } from './types';

let data: Record<string, string>, service: DemoService;
const storage = {
  getItem: (key: string) => data[key] ?? null,
  setItem: (key: string, value: string) => {
    data[key] = value;
  },
};

const valid: ClientInput = {
  firstName: 'Alice',
  lastName: 'Wong',
  dob: '1994-02-12',
  gender: 'Female',
  email: 'alice@example.com',
  phone: '+6587654321',
  address: '25 Orchard Road',
  city: 'Singapore',
  state: 'Singapore',
  country: 'Singapore',
  postal: '238001',
};

beforeEach(() => {
  vi.useFakeTimers();
  data = {};
  service = new DemoService(storage);
});

async function finish<T>(p: Promise<T>) {
  await vi.runAllTimersAsync();

  return p;
}

describe('client validation', () => {
  it('accepts a valid Singapore client', () => expect(validateClient(valid, [])).toEqual({}));
  it('reports required fields before format rules, treating a bare +65 as empty', () => {
    const e = validateClient(
      { ...valid, firstName: '', dob: '', phone: '+65', postal: '', address: ' ' },
      [],
    );
    expect(e).toMatchObject({
      firstName: 'First name is required.',
      dob: 'Date of birth is required.',
      phone: 'Phone number is required.',
      postal: 'Postal code is required.',
      address: 'Address is required.',
    });
    expect(validateClient({ ...valid, dob: '2099-01-01' }, []).dob).toBe(
      'Date of birth must be in the past.',
    );
  });

  it('rejects invalid names, underage dates, phone lengths and postal codes', () => {
    const e = validateClient(
      { ...valid, firstName: 'A', dob: '2020-01-01', phone: '123', postal: '12345' },
      [],
    );
    expect(Object.keys(e)).toEqual(expect.arrayContaining(['firstName', 'dob', 'phone', 'postal']));
  });

  it('checks email and normalized phone uniqueness, excluding the current client', () => {
    const c = service.snapshot().clients[0];
    expect(
      validateClient({ ...valid, email: c.email.toUpperCase(), phone: c.phone.replace('+', '') }, [
        c,
      ]),
    ).toHaveProperty('email');
    expect(validateClient({ ...valid, phone: c.phone }, [c])).toHaveProperty('phone');
    expect(validateClient(c, [c], c.id)).toEqual({});
  });

  it('accepts exactly 18 and 100, rejects over 100 and future dates', () => {
    vi.setSystemTime(new Date('2026-09-30T12:00:00'));
    for (const dob of ['2008-09-30', '1926-09-30'])
      expect(validateClient({ ...valid, dob }, []).dob).toBeUndefined();
    for (const dob of ['2008-10-01', '1925-09-30', '2027-01-01'])
      expect(validateClient({ ...valid, dob }, []).dob).toBeTruthy();
  });
});

describe('service rules and persistence', () => {
  it('blocks access and mutations to another agent’s clients', async () => {
    await finish(service.login('USR-003'));
    await expect(service.viewClient('CL-1009')).rejects.toThrow('unavailable');
    await expect(service.saveClient(valid, 'CL-1009')).rejects.toThrow('unavailable');
    await expect(service.verify('CL-1009', 'Verified')).rejects.toThrow('unavailable');
    await expect(
      service.deleteAccount(service.snapshot().accounts.find((a) => a.clientId === 'CL-1009')!.id),
    ).rejects.toThrow('unavailable');
  });

  it('protects the root and disallows agent administration', async () => {
    await finish(service.login('USR-003'));
    await expect(service.changeUser('USR-001', 'delete')).rejects.toThrow('Administrator');
    await finish(service.login('USR-001'));
    await expect(service.changeUser('USR-001', 'delete')).rejects.toThrow('protected');
    await expect(service.changeUser('USR-001', 'toggle')).rejects.toThrow('protected');
    const u = service.snapshot().users[0];
    await expect(service.saveUser({ ...u, role: 'Agent' }, u.id)).rejects.toThrow('demoted');
  });

  it('executes onboarding, verification, account creation and import with audit events', async () => {
    await finish(service.login('USR-003'));
    const id = await finish(service.saveClient(valid));
    await finish(service.verify(id, 'Verified'));
    await finish(
      service.createAccount(id, {
        type: 'Savings',
        status: 'Active',
        openingDate: '2026-09-30',
        initialDeposit: 500,
        currency: 'SGD',
        branchId: 'SG-001',
      }),
    );
    await finish(service.importTransactions('success'));
    const db = service.snapshot();
    expect(db.clients.find((c) => c.id === id)?.verification).toBe('Verified');
    expect(db.accounts.some((a) => a.clientId === id)).toBe(true);
    expect(db.transactions.some((t) => t.clientId === id)).toBe(true);
    expect(db.audit.map((a) => a.action)).toContain('Transaction import');
    await expect(service.deleteClient(id)).rejects.toThrow('linked accounts');
  });

  it('rejects duplicates and exposes partial/failure results', async () => {
    await finish(service.login('USR-003'));
    await finish(service.importTransactions('success'));
    const count = service.snapshot().transactions.length;
    await finish(service.importTransactions('success'));
    expect(service.snapshot().transactions).toHaveLength(count);
    expect(service.snapshot().imports[0].rejected).toBe(3);
    await finish(service.importTransactions('partial'));
    expect(service.snapshot().imports[0].status).toBe('Partially Successful');
    expect(service.snapshot().imports[0].rejected).toBe(1);
    await finish(service.importTransactions('failed'));
    expect(service.snapshot().imports[0].processed).toBe(0);
    expect(service.snapshot().imports[0].errors[0]).toContain('connection failed');
  });

  it('records corrupted files and system exceptions as failed imports without saving rows', async () => {
    await finish(service.login('USR-003'));
    const count = service.snapshot().transactions.length;
    await finish(service.importTransactions('corrupted'));
    let run = service.snapshot().imports[0];
    expect(run).toMatchObject({ status: 'Failed', processed: 0, accepted: 0, rejected: 0 });
    expect(run.source).toMatch(/\.xls$/);
    expect(run.errors[0]).toContain('unsupported or corrupted file format');
    await finish(service.importTransactions('exception'));
    run = service.snapshot().imports[0];
    expect(run).toMatchObject({ status: 'Failed', processed: 3, accepted: 0, rejected: 3 });
    expect(run.errors[0]).toContain('System exception');
    expect(service.snapshot().transactions).toHaveLength(count);
    const logged = service.snapshot().audit.filter((a) => a.action === 'Transaction import');
    expect(logged).toHaveLength(2);
    expect(logged.every((a) => a.crud === 'Create')).toBe(true);
  });

  it('uses the Appendix 2 attribute column for create, read and delete events', async () => {
    await finish(service.login('USR-003'));
    await finish(service.viewClient('CL-1001'));
    expect(auditColumns(service.snapshot().audit[0])).toEqual({
      crud: 'Read',
      attribute: 'CL-1001',
      before: '',
      after: '',
    });
    expect(maskValue('phone', '+6587654321')).toBe('+65****4321');
    expect(maskValue('dob', '1994-02-12')).toBe('1994-**-**');
    expect(maskValue('gender', 'Female')).toBe('Female');
  });

  it('persists data, masks sensitive updates and restores seed on reset', async () => {
    await finish(service.login('USR-003'));
    const id = await finish(service.saveClient(valid));
    await finish(
      service.saveClient(
        { ...valid, address: '70 Updated Road', city: 'Jurong', email: 'alice.w@example.com' },
        id,
      ),
    );
    expect(data[STORAGE_KEY]).toBeTruthy();
    const saved = new DemoService(storage).snapshot();
    expect(saved.clients.some((c) => c.id === id)).toBe(true);
    expect(saved.audit[0].crud).toBe('Update');
    expect(auditColumns(saved.audit[0])).toEqual({
      crud: 'Update',
      attribute: 'Email Address|Address|City',
      before: 'a****@example.com|2********|Singapore',
      after: 'a******@example.com|7********|Jurong',
    });
    expect(JSON.stringify(saved.audit)).not.toContain('25 Orchard Road');
    await finish(service.login('USR-001'));
    await finish(service.reset());
    expect(service.snapshot().clients).toHaveLength(12);
    expect(service.snapshot().clients.some((c) => c.id === id)).toBe(false);
  });

  it('blocks disabled sign-ins and deletion of agents with clients', async () => {
    await finish(service.login('USR-001'));
    await finish(service.changeUser('USR-004', 'toggle'));
    await expect(service.login('USR-004')).rejects.toThrow('disabled');
    await expect(service.changeUser('USR-004', 'delete')).rejects.toThrow('assigned clients');
  });

  it('recovers from malformed local storage', () => {
    data[STORAGE_KEY] = 'invalid json';
    expect(new DemoService(storage).snapshot().clients).toHaveLength(12);
  });
});
