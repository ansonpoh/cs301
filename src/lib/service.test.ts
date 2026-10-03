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

describe('complaints and disputes', () => {
  const dispute = (clientId = 'CL-1002', transactionId?: string) => ({
    clientId,
    category: 'Transaction dispute' as const,
    description: 'Client says this charge was never authorised.',
    transactionId,
  });
  const txOf = (clientId: string) =>
    service.snapshot().transactions.find((t) => t.clientId === clientId)!.id;

  it('raises cases only for own clients with a valid linked transaction', async () => {
    await finish(service.login('USR-003'));
    await expect(service.raiseCase(dispute())).rejects.toThrow('Link the disputed');
    await expect(service.raiseCase(dispute('CL-1002', txOf('CL-1001')))).rejects.toThrow(
      'not found for the client',
    );
    await expect(service.raiseCase(dispute('CL-1009', txOf('CL-1009')))).rejects.toThrow(
      'unavailable',
    );
    const disputed = service.snapshot().cases.find((c) => c.id === 'CASE-1001')!.transactionId;
    await expect(service.raiseCase(dispute('CL-1001', disputed))).rejects.toThrow(
      'unresolved dispute',
    );
    const id = await finish(service.raiseCase(dispute('CL-1002', txOf('CL-1002'))));
    const c = service.snapshot().cases.find((c) => c.id === id)!;
    expect(c).toMatchObject({ status: 'Open', agentId: 'USR-003', escalated: false });
    expect(c.history).toHaveLength(1);
    expect(service.snapshot().audit[0]).toMatchObject({ action: 'CASE_CREATED', crud: 'Create' });
    await finish(
      service.raiseCase({ ...dispute(), category: 'Service complaint', transactionId: '' }),
    );
    await finish(service.login('USR-001'));
    await expect(service.raiseCase(dispute('CL-1002', txOf('CL-1002')))).rejects.toThrow(
      'Only agents',
    );
  });

  it('moves cases forward only, with a required note that is PII-filtered in the log', async () => {
    await finish(service.login('USR-003'));
    await expect(service.updateCaseStatus('CASE-1002', 'Resolved', 'Done now')).rejects.toThrow(
      'cannot move',
    );
    await expect(service.updateCaseStatus('CASE-1002', 'Investigating', ' ')).rejects.toThrow(
      'note',
    );
    await finish(
      service.updateCaseStatus('CASE-1002', 'Investigating', 'Called client on +6581234567'),
    );
    const log = service.snapshot().audit[0];
    expect(log.action).toBe('STATUS_UPDATED');
    expect(auditColumns(log)).toMatchObject({ before: 'Open', after: 'Investigating' });
    expect(log.detail).not.toContain('81234567');
    await finish(service.updateCaseStatus('CASE-1002', 'Resolved', 'Apology issued.'));
    const c = service.snapshot().cases.find((c) => c.id === 'CASE-1002')!;
    expect(c.resolvedAt).toBeTruthy();
    await finish(service.login('USR-004'));
    await expect(service.updateCaseStatus('CASE-1001', 'Resolved', 'Not mine')).rejects.toThrow(
      'unavailable',
    );
  });

  it('scopes searches by role and logs one CASE_VIEWED entry per query', async () => {
    await finish(service.login('USR-003'));
    const before = service.snapshot().audit.length;
    const mine = await finish(service.searchCases({}));
    expect(mine.every((c) => ['CL-1001', 'CL-1002', 'CL-1004'].includes(c.clientId))).toBe(true);
    const audit = service.snapshot().audit;
    expect(audit).toHaveLength(before + 1);
    expect(audit[0]).toMatchObject({ action: 'CASE_VIEWED', crud: 'Read' });
    expect(audit[0].detail).toContain(`${mine.length} result(s)`);
    expect(await finish(service.searchCases({ status: 'Resolved' }))).toHaveLength(1);
    await finish(service.login('USR-001'));
    expect(await finish(service.searchCases({}))).toHaveLength(5);
    expect(await finish(service.searchCases({ agentId: 'USR-004' }))).toHaveLength(2);
  });

  it('escalates SLA breaches as a system event, lets admins reassign, and re-escalates', async () => {
    await finish(service.login('USR-001'));
    expect(await finish(service.runSlaCheck())).toBe(2);
    expect(await finish(service.runSlaCheck())).toBe(0);
    const event = service.snapshot().audit.find((e) => e.action === 'ESCALATED')!;
    expect(event.actorId).toBe('SYSTEM');
    expect(event.detail).toContain('SLA breach');
    await expect(service.reassignCase('CASE-1002', 'USR-004')).rejects.toThrow('escalated');
    await expect(service.reassignCase('CASE-1004', 'USR-004')).rejects.toThrow('different');
    await finish(service.reassignCase('CASE-1004', 'USR-003'));
    let c = service.snapshot().cases.find((c) => c.id === 'CASE-1004')!;
    expect(c).toMatchObject({ agentId: 'USR-003', escalated: false });
    expect(service.snapshot().audit[0]).toMatchObject({ action: 'REASSIGNED', actorId: 'USR-001' });
    await finish(service.login('USR-003'));
    await expect(service.reassignCase('CASE-1001', 'USR-004')).rejects.toThrow('Administrator');
    // The reassigned agent can now see and work the case.
    await finish(service.updateCaseStatus('CASE-1004', 'Investigating', 'Picked up the case.'));
    expect(await finish(service.runSlaCheck(new Date(Date.now() + 14 * 86_400_000)))).toBe(3);
    c = service.snapshot().cases.find((c) => c.id === 'CASE-1004')!;
    expect(c.history.filter((h) => h.type === 'ESCALATED')).toHaveLength(2);
  });

  it('validates the admin-configured SLA and scrubs case text on client erasure', async () => {
    await finish(service.login('USR-003'));
    await expect(service.updateSla(5)).rejects.toThrow('Administrator');
    await finish(service.login('USR-001'));
    await expect(service.updateSla(0)).rejects.toThrow('1–30');
    expect(await finish(service.updateSla(30))).toBe(0);
    expect(service.snapshot().caseSettings.slaBusinessDays).toBe(30);
    await finish(service.login('USR-003'));
    await finish(
      service.raiseCase({
        clientId: 'CL-1003',
        category: 'Service complaint',
        description: 'Client unhappy with call centre wait times.',
      }),
    );
    await finish(service.deleteClient('CL-1003'));
    const c = service.snapshot().cases.find((c) => c.clientId === 'CL-1003')!;
    expect(c.description).toContain('Erased');
    expect(service.snapshot().audit.some((e) => e.entityId === c.id)).toBe(true);
  });
});

describe('product recommendations', () => {
  const current = (clientId: string) =>
    service.snapshot().recoSets.find((s) => s.clientId === clientId && s.status === 'Current')!;
  const actions = () => service.snapshot().audit.map((a) => a.action);

  it('generates on first view, caches until data changes, and logs each view', async () => {
    await finish(service.login('USR-003'));
    const first = await finish(service.getRecommendations('CL-1001'));
    expect(first.items.length).toBeLessThanOrEqual(3);
    expect(first.source).toBe('AI');
    expect(first.items.every((r, i) => i === 0 || first.items[i - 1].score >= r.score)).toBe(true);
    expect(JSON.stringify(first.payload)).not.toMatch(/Amelia|Tan|@|\+65|CL-1001/);
    const again = await finish(service.getRecommendations('CL-1001'));
    expect(again.id).toBe(first.id);
    expect(actions().filter((a) => a === 'RECO_GENERATED')).toHaveLength(1);
    expect(actions().filter((a) => a === 'RECO_VIEWED')).toHaveLength(2);
    const c = service.snapshot().clients.find((c) => c.id === 'CL-1001')!;
    await finish(service.saveClient({ ...c, address: '99 Changed Street' }, 'CL-1001'));
    const after = await finish(service.getRecommendations('CL-1001'));
    expect(after.id).not.toBe(first.id);
    expect(service.snapshot().recoSets.find((s) => s.id === first.id)!.status).toBe('Outdated');
  });

  it('only recommends eligible catalogue products and falls back on AI failure', async () => {
    await finish(service.login('USR-003'));
    // CL-1003 is unverified with no accounts: no cards, loans or investments.
    const set = await finish(service.getRecommendations('CL-1003', 10));
    const ids = set.items.map((r) => r.productId);
    expect(ids).not.toContain('PRD-CC');
    expect(ids).not.toContain('PRD-PL');
    expect(ids).not.toContain('PRD-INV');
    for (const mode of ['unavailable', 'invalid'] as const) {
      const s = await finish(service.refreshRecommendations('CL-1001', mode));
      expect(s.source).toBe('FALLBACK');
      expect(s.items.length).toBeGreaterThan(0);
      expect(
        s.items.every((r) => r.productId.startsWith('PRD-') && r.productId !== 'PRD-UNKNOWN'),
      ).toBe(true);
    }
    expect(actions().filter((a) => a === 'RECO_AI_FAILURE')).toHaveLength(2);
  });

  it('simulates terms against pre-approval limits', async () => {
    await finish(service.login('USR-003'));
    await finish(service.refreshRecommendations('CL-1001'));
    const set = current('CL-1001');
    const fd = set.items.find((r) => r.productId === 'PRD-FD12')!;
    expect(fd).toBeTruthy();
    const ok = await finish(
      service.simulateOffer(fd.id, { amount: 5_000, tenureMonths: 12, rate: 3 }),
    );
    expect(ok.result).toBe('Pre-approved');
    const high = await finish(
      service.simulateOffer(fd.id, { amount: 5_000, tenureMonths: 12, rate: 3.8 }),
    );
    expect(high.result).toBe('Manager override required');
    await expect(
      service.simulateOffer(fd.id, { amount: 1, tenureMonths: 12, rate: 3 }),
    ).rejects.toThrow('Amount');
    expect(service.snapshot().audit[0]).toMatchObject({ action: 'RECO_SIMULATED' });
  });

  it('records outcomes: account opening, 90-day suppression, and follow-ups', async () => {
    await finish(service.login('USR-003'));
    // CL-1001 holds a Business account, so High-Yield Savings is eligible.
    const set = await finish(service.getRecommendations('CL-1001', 10));
    const hys = set.items.find((r) => r.productId === 'PRD-HYS')!;
    await expect(service.recordOutcome(hys.id, { type: 'Rejected' })).rejects.toThrow('reason');
    await finish(service.recordOutcome(hys.id, { type: 'Accepted', channel: 'Open account' }));
    const acc = service
      .snapshot()
      .accounts.find(
        (a) => a.id === current('CL-1001').items.find((r) => r.id === hys.id)!.outcome!.accountId,
      );
    expect(acc).toMatchObject({ type: 'Savings', status: 'Pending', clientId: 'CL-1001' });
    await expect(service.recordOutcome(hys.id, { type: 'Rejected', reason: 'x' })).rejects.toThrow(
      'already',
    );

    const fresh = await finish(service.getRecommendations('CL-1001', 10));
    expect(fresh.items.map((r) => r.productId)).not.toContain('PRD-HYS');
    const card = fresh.items.find((r) => r.productId === 'PRD-CC') ?? fresh.items[0];
    await finish(
      service.recordOutcome(card.id, { type: 'Rejected', reason: 'Not interested right now' }),
    );
    const category = service.snapshot().products.find((p) => p.id === card.productId)!.category;
    const next = await finish(service.getRecommendations('CL-1001', 10));
    const cats = next.items.map(
      (r) => service.snapshot().products.find((p) => p.id === r.productId)!.category,
    );
    expect(cats).not.toContain(category);

    const later = next.items[0];
    await expect(
      service.recordOutcome(later.id, {
        type: 'Deferred',
        reason: 'Asked to be contacted later',
        followUpAt: '2000-01-01',
      }),
    ).rejects.toThrow('follow-up');
    const date = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
    await finish(
      service.recordOutcome(later.id, {
        type: 'Deferred',
        reason: 'Asked to be contacted later',
        followUpAt: date,
      }),
    );
    const nba = await finish(service.getNextBestActions());
    expect(nba.followUps.map((f) => f.item.id)).toContain(later.id);
    expect(nba.actions.every((a) => !a.item.outcome)).toBe(true);
    expect(service.snapshot().audit[0].detail).toContain('Next best actions');
  });

  it('respects consent and ownership, and erases sets with the client', async () => {
    await finish(service.login('USR-003'));
    await expect(service.getRecommendations('CL-1009')).rejects.toThrow('unavailable');
    await finish(service.getRecommendations('CL-1003'));
    await finish(service.setRecoConsent('CL-1003', false));
    await expect(service.getRecommendations('CL-1003')).rejects.toThrow('consent');
    expect(
      (await finish(service.getNextBestActions())).actions.some((a) => a.clientId === 'CL-1003'),
    ).toBe(false);
    await finish(service.deleteClient('CL-1003'));
    expect(service.snapshot().recoSets.some((s) => s.clientId === 'CL-1003')).toBe(false);
    expect(service.snapshot().recoOptOuts).not.toContain('CL-1003');
    await finish(service.login('USR-001'));
    await expect(service.getRecommendations('CL-1001')).rejects.toThrow('agent workflow');
  });
});

describe('attrition risk and retention', () => {
  const profile = (clientId: string) =>
    service.snapshot().riskProfiles.find((p) => p.clientId === clientId)!;
  const actions = () => service.snapshot().audit.map((a) => a.action);

  it('flags balance drops from transaction data, highest risk first', async () => {
    expect(profile('CL-1008')).toMatchObject({ level: 'High', status: 'At Risk' });
    expect(profile('CL-1008').reasons[0]).toMatch(/^56% balance drop in 30 days/);
    expect(profile('CL-1001').level).toBe('Medium');
    expect(profile('CL-1001').reasons.join()).toContain('CASE-1001');
    // Clients without unusual activity are not flagged.
    expect(service.snapshot().riskProfiles.some((p) => p.clientId === 'CL-1002')).toBe(false);
    await finish(service.login('USR-003'));
    expect(await finish(service.runRiskAnalysis())).toBe(0);
    const rows = await finish(service.getRetentionRisks());
    expect(rows.map((p) => p.clientId)).toEqual(['CL-1008', 'CL-1001', 'CL-1004']);
    expect(service.snapshot().audit[0]).toMatchObject({
      action: 'RISK_VIEWED',
      crud: 'Read',
      actorId: 'USR-003',
      detail: 'Filters: status=Open · 3 result(s)',
    });
    expect(await finish(service.getRetentionRisks({ status: 'All' }))).toHaveLength(4);
  });

  it('flags new risks on the scheduled run and re-flags closed profiles after 30 days', async () => {
    await finish(service.login('USR-003'));
    // A large withdrawal for CL-1002 after the latest feed.
    const db = JSON.parse(data[STORAGE_KEY]);
    db.transactions.push({
      id: 'TX-RISK',
      clientId: 'CL-1002',
      accountId: 'AC-80002',
      type: 'Withdrawal',
      amount: 25_000,
      date: '2026-09-29T20:00:00Z',
      status: 'Completed',
    });
    data[STORAGE_KEY] = JSON.stringify(db);
    service = new DemoService(storage);
    expect(await finish(service.runRiskAnalysis(new Date('2026-10-01T00:00:00Z')))).toBe(1);
    expect(profile('CL-1002')).toMatchObject({ level: 'High', status: 'At Risk' });
    expect(service.snapshot().audit[0]).toMatchObject({
      action: 'RISK_FLAGGED',
      actorId: 'SYSTEM',
    });
    expect(await finish(service.runRiskAnalysis(new Date('2026-10-01T00:00:00Z')))).toBe(0);
  });

  it('logs interventions, moves the client to Under Review, and filters PII', async () => {
    await finish(service.login('USR-003'));
    await expect(
      service.logIntervention('CL-1008', { type: 'Fee Waiver Offered', notes: 'short' }),
    ).rejects.toThrow('10–1000');
    await expect(
      service.logIntervention('CL-1008', {
        type: 'Follow-up Scheduled',
        notes: 'Will call back next week.',
      }),
    ).rejects.toThrow('follow-up date');
    await finish(
      service.logIntervention('CL-1008', {
        type: 'Fee Waiver Offered',
        notes: 'Waived fees; client asked for a copy at james.teo@example.com or +6581000006.',
      }),
    );
    expect(profile('CL-1008').status).toBe('Under Review');
    expect(service.snapshot().interventions[0]).toMatchObject({
      clientId: 'CL-1008',
      agentId: 'USR-003',
    });
    const [status, logged] = service.snapshot().audit;
    expect(status).toMatchObject({ action: 'STATUS_UPDATED', clientId: 'CL-1008' });
    expect(auditColumns(status)).toMatchObject({
      attribute: 'Risk Status',
      before: 'At Risk',
      after: 'Under Review',
    });
    expect(logged).toMatchObject({ action: 'INTERVENTION_LOGGED', crud: 'Create' });
    expect(logged.detail).toContain('Type: Fee Waiver Offered');
    expect(logged.detail).not.toMatch(/james\.teo|81000006/);
  });

  it('only allows lifecycle transitions from the current status', async () => {
    await finish(service.login('USR-003'));
    await expect(service.updateRiskStatus('CL-1001', 'Mitigated', 'Kept')).rejects.toThrow(
      'cannot move from At Risk to Mitigated',
    );
    await finish(service.updateRiskStatus('CL-1001', 'Under Review'));
    await expect(service.updateRiskStatus('CL-1001', 'Churned')).rejects.toThrow('note');
    await finish(service.updateRiskStatus('CL-1001', 'Mitigated', 'Client kept the account.'));
    expect(profile('CL-1001')).toMatchObject({ status: 'Mitigated' });
    expect(profile('CL-1001').closedAt).toBeTruthy();
    await expect(
      service.logIntervention('CL-1001', {
        type: 'Relationship Check-in',
        notes: 'Checked in again.',
      }),
    ).rejects.toThrow('Mitigated');
    expect(auditColumns(service.snapshot().audit[0])).toMatchObject({
      before: 'Under Review',
      after: 'Mitigated',
    });
    // Closed profiles reopen only if still risky 30 days later.
    await finish(service.runRiskAnalysis());
    expect(profile('CL-1001').status).toBe('Mitigated');
    await finish(service.runRiskAnalysis(new Date(Date.now() + 31 * 86_400_000)));
    expect(profile('CL-1001')).toMatchObject({ status: 'At Risk', closedAt: undefined });
  });

  it('scopes agents to their own clients, keeps admins read-only, and erases on request', async () => {
    await finish(service.login('USR-003'));
    await expect(service.updateRiskStatus('CL-1009', 'Under Review')).rejects.toThrow(
      'unavailable',
    );
    expect(
      (await finish(service.getRetentionRisks({ agentId: 'USR-004', status: 'All' }))).every((p) =>
        ['CL-1001', 'CL-1004', 'CL-1005', 'CL-1008'].includes(p.clientId),
      ),
    ).toBe(true);
    await finish(service.login('USR-001'));
    expect(await finish(service.getRetentionRisks({ status: 'All' }))).toHaveLength(7);
    expect(await finish(service.getRetentionRisks({ agentId: 'USR-004' }))).toHaveLength(1);
    await expect(service.updateRiskStatus('CL-1001', 'Under Review')).rejects.toThrow(
      'agent workflow',
    );
    await finish(service.login('USR-004'));
    await finish(service.deleteAccount('AC-80009'));
    await finish(service.deleteClient('CL-1012'));
    const db = service.snapshot();
    expect(db.riskProfiles.some((p) => p.clientId === 'CL-1012')).toBe(false);
    expect(db.interventions.some((i) => i.clientId === 'CL-1012')).toBe(false);
  });
});
