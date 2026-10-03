import { createSeed } from './seed';
import { validateClient } from './validation';
import { crudFor, filterPii, maskValue } from './audit';
import { CASE_CATEGORIES, NEXT_STATUS, businessDaysBetween } from './cases';
import {
  MODEL,
  PROMPT_VERSION,
  callAiService,
  describeTerms,
  eligibility,
  fingerprint,
  maskedPayload,
  ruleScore,
  signals,
  simulateTerms,
  suppressedCategories,
  validateAiOutput,
  type AiItem,
} from './recommend';
import {
  INTERVENTION_TYPES,
  REFLAG_AFTER_DAYS,
  RISK_LEVELS,
  RISK_STATUSES,
  RISK_TRANSITIONS,
  analyseRisk,
  analysisDate,
  isOpenRisk,
} from './retention';
import {
  ASSET_TYPES,
  EVIDENCE_REQUIREMENTS,
  UPLOAD_LINK_DAYS,
  WEALTH_ORIGINS,
  activationBlockers,
  analyseWealth,
  extractIdentity,
  fullName,
  isEditableWealth,
  isFinalWealth,
  localDate,
  missingEvidence,
  scanEvidence,
} from './verification';
import type {
  EvidenceScenario,
  IdentityCheck,
  IdentityScenario,
  WealthCase,
  WealthFilters,
  WealthInput,
  WealthStatus,
  AiMode,
  InterventionInput,
  RiskFilters,
  RiskProfile,
  RiskStatus,
  FulfilmentChannel,
  OfferTerms,
  RecoOutcomeType,
  RecommendationSet,
  Case,
  CaseFilters,
  CaseInput,
  CaseStatus,
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
const ERASED = '[Erased at client request]';

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem'>;

export class DemoService {
  private db: Database;
  private actorId: string | null = null;
  constructor(private storage: Storage) {
    const raw = storage.getItem(STORAGE_KEY);
    try {
      const value = raw ? JSON.parse(raw) : null;
      // Browser data saved before features 4 and 6 existed gains their sample data.
      if (value?.version === 1 && Array.isArray(value.clients)) {
        const seed = createSeed();
        if (!Array.isArray(value.cases)) {
          value.cases = seed.cases.filter((c) =>
            value.clients.some((x: { id: string }) => x.id === c.clientId),
          );
          value.caseSettings = seed.caseSettings;
        }
        value.products ??= seed.products;
        value.recoSets ??= [];
        value.recoOptOuts ??= [];
        if (!Array.isArray(value.riskProfiles)) {
          const has = (key: string, id: string) =>
            value[key].some((x: { id: string }) => x.id === id);
          value.transactions.push(
            ...seed.transactions.filter(
              (t) => !has('transactions', t.id) && has('accounts', t.accountId),
            ),
          );
          value.riskProfiles = seed.riskProfiles.filter((p) => has('clients', p.clientId));
          value.interventions = seed.interventions.filter((i) => has('clients', i.clientId));
        }
        value.riskJob ??= {};
        // Feature 2 verification records; the old "Rejected" identity status is now "Failed".
        value.identityChecks ??= [];
        value.wealthCases ??= [];
        for (const c of value.clients) if (c.verification === 'Rejected') c.verification = 'Failed';
      }
      this.db =
        value?.version === 1 &&
        value.caseSettings &&
        [
          'users',
          'clients',
          'accounts',
          'transactions',
          'imports',
          'audit',
          'cases',
          'products',
          'recoSets',
          'recoOptOuts',
          'riskProfiles',
          'interventions',
          'identityChecks',
          'wealthCases',
        ].every((k) => Array.isArray(value[k]))
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
    actorId = this.actorId || 'SYSTEM',
  ) {
    this.db.audit.unshift({
      id: crypto.randomUUID(),
      actorId,
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
  // Activates the client's pending accounts once identity and every policy-required check pass.
  private evaluateActivation(clientId: string) {
    const client = this.db.clients.find((c) => c.id === clientId);
    if (!client) return;
    const accounts = this.db.accounts.filter((a) => a.clientId === clientId);
    const blockers = activationBlockers(
      client,
      accounts,
      this.db.wealthCases.filter((w) => w.clientId === clientId),
    );
    if (blockers.length) return;
    for (const a of accounts.filter((a) => a.status === 'Pending')) {
      a.status = 'Active';
      this.log(
        'Account activated',
        a.id,
        clientId,
        [{ field: 'accountStatus', before: 'Pending', after: 'Active' }],
        'All required verification checks passed.',
      );
    }
  }
  private identityCheck(id: string) {
    const check = this.db.identityChecks.find((x) => x.id === id);
    if (!check) throw new Error('Identity check unavailable.');
    return { check, client: this.client(check.clientId) };
  }
  // Automated outcomes are logged as SYSTEM; a reviewer's decision is logged as the reviewer.
  private setIdentity(
    check: IdentityCheck,
    to: IdentityCheck['status'],
    detail: string,
    actorId = 'SYSTEM',
  ) {
    const client = this.db.clients.find((c) => c.id === check.clientId)!;
    const before = client.verification;
    check.status = to;
    client.verification = to === 'Awaiting Upload' ? before : to;
    this.log(
      'IDENTITY_STATUS_UPDATED',
      check.id,
      client.id,
      [{ field: 'verification', before, after: client.verification }],
      detail,
      actorId,
    );
    if (to === 'Verified') this.evaluateActivation(client.id);
  }
  // Creates a client-bound session and emails the client a short-lived NRIC upload link (simulated).
  async requestIdentityVerification(clientId: string) {
    const actor = this.actor();
    const client = this.client(clientId, true);
    if (client.verification === 'Verified') throw new Error('This identity is already verified.');
    if (
      this.db.identityChecks.some(
        (x) =>
          x.clientId === clientId &&
          (x.status === 'Awaiting Upload' || x.status === 'Manual Review'),
      )
    )
      throw new Error('An identity check is already in progress for this client.');
    const id = `IDV-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    this.db.identityChecks.unshift({
      id,
      clientId,
      requestedBy: actor.id,
      requestedAt: new Date().toISOString(),
      status: 'Awaiting Upload',
    });
    this.log(
      'IDENTITY_VERIFICATION_REQUESTED',
      id,
      clientId,
      undefined,
      `Upload link emailed to the client (simulated SES), valid for ${UPLOAD_LINK_DAYS} days.`,
    );
    await this.commit();
    return id;
  }
  // Stands in for the client's upload, the scan and Textract extraction, and the profile comparison.
  async simulateIdentityUpload(checkId: string, scenario: IdentityScenario) {
    const { check, client } = this.identityCheck(checkId);
    this.client(client.id, true);
    if (check.status !== 'Awaiting Upload')
      throw new Error('This check is no longer waiting for an upload.');
    if (Date.now() - Date.parse(check.requestedAt) > UPLOAD_LINK_DAYS * 86_400_000)
      throw new Error('The upload link has expired. Request a new verification.');
    check.uploadedAt = new Date().toISOString();
    check.evidenceId = `EVD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    // Uploads come from the client through the scoped grant, not from a staff account.
    this.log(
      'IDENTITY_EVIDENCE_UPLOADED',
      check.id,
      client.id,
      undefined,
      `Evidence ${check.evidenceId} · NRIC image · accepted into quarantine and scanned`,
      `CLIENT:${client.id}`,
    );
    const r = extractIdentity(client, scenario);
    if ('reason' in r) {
      check.reason = r.reason;
      this.setIdentity(check, 'Manual Review', `Routed to manual review: ${r.reason}`);
    } else {
      check.extracted = r.extracted;
      check.mismatches = r.mismatches;
      if (r.mismatches.length)
        this.setIdentity(check, 'Failed', `Extracted fields mismatch: ${r.mismatches.join('; ')}`);
      else
        this.setIdentity(check, 'Verified', 'Extracted name and date of birth match the profile');
    }
    return this.commit();
  }
  async resolveIdentityReview(checkId: string, outcome: 'Verified' | 'Failed', rationale: string) {
    const admin = this.admin();
    const { check } = this.identityCheck(checkId);
    if (check.status !== 'Manual Review') throw new Error('This check is not awaiting review.');
    if (outcome !== 'Verified' && outcome !== 'Failed') throw new Error('Select an outcome.');
    const text = rationale.trim();
    if (text.length < 10 || text.length > 500)
      throw new Error('Record a rationale of 10–500 characters.');
    check.review = { reviewerId: admin.id, at: new Date().toISOString(), outcome, rationale: text };
    // The rationale stays in the check record; the log carries the decision only.
    this.setIdentity(
      check,
      outcome,
      `Reviewer decision recorded · evidence ${check.evidenceId}`,
      admin.id,
    );
    return this.commit();
  }
  private wealthCase(id: string) {
    const wc = this.db.wealthCases.find((w) => w.id === id);
    if (!wc) throw new Error('Wealth case unavailable.');
    this.client(wc.clientId);
    return wc;
  }
  private agentWealthCase(id: string) {
    const actor = this.actor();
    if (actor.role !== 'Agent') throw new Error('Wealth declarations are an agent workflow.');
    const wc = this.wealthCase(id);
    return { actor, wc, client: this.client(wc.clientId, true) };
  }
  private wealthStatus(wc: WealthCase, to: WealthStatus, actorId?: string) {
    const from = wc.status;
    wc.status = to;
    wc.updatedAt = new Date().toISOString();
    return { from, to, actorId, at: wc.updatedAt };
  }
  private validateWealth(input: WealthInput) {
    if (!input.assets.length || input.assets.length > 10)
      throw new Error('Declare between 1 and 10 assets.');
    const today = localDate();
    const seen = new Set<string>();
    const assets = input.assets.map((a) => {
      const description = a.description.trim();
      if (!ASSET_TYPES.includes(a.type)) throw new Error('Select an asset type.');
      if (description.length < 3 || description.length > 100)
        throw new Error('Describe each asset in 3–100 characters.');
      const key = `${a.type}|${description.toLowerCase()}`;
      if (seen.has(key)) throw new Error(`"${description}" is declared twice.`);
      seen.add(key);
      if (!Number.isFinite(a.ownershipPct) || a.ownershipPct <= 0 || a.ownershipPct > 100)
        throw new Error('Ownership share must be above 0% and at most 100%.');
      if (!Number.isFinite(a.declaredValue) || a.declaredValue <= 0 || a.declaredValue > 1e10)
        throw new Error('Enter a positive declared value for each asset.');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(a.valuationDate) || a.valuationDate > today)
        throw new Error('Valuation dates cannot be in the future.');
      if (!WEALTH_ORIGINS.includes(a.origin))
        throw new Error('Select how each asset was acquired.');
      return {
        ...a,
        description,
        id: a.id || `AST-${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
      };
    });
    if (!Number.isFinite(input.liabilities) || input.liabilities < 0)
      throw new Error('Liabilities cannot be negative.');
    const sourceNarrative = input.sourceNarrative.trim();
    if (sourceNarrative.length < 20 || sourceNarrative.length > 1000)
      throw new Error('Explain how the wealth was built up in 20–1000 characters.');
    return { assets, liabilities: input.liabilities, sourceNarrative };
  }
  // Logs carry categories and counts only; the declaration itself stays in the case record.
  private assetSummary(wc: WealthCase) {
    return `${wc.assets.length} asset(s): ${[...new Set(wc.assets.map((a) => a.type))].join(', ')}`;
  }
  async createWealthCase(clientId: string, input: WealthInput) {
    const actor = this.actor();
    if (actor.role !== 'Agent') throw new Error('Wealth declarations are an agent workflow.');
    this.client(clientId, true);
    const previous = this.db.wealthCases.filter((w) => w.clientId === clientId);
    if (previous.some((w) => !isFinalWealth(w.status)))
      throw new Error('This client already has a wealth case in progress.');
    const value = this.validateWealth(input);
    const at = new Date().toISOString();
    const id = `WC-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const wc: WealthCase = {
      id,
      clientId,
      agentId: actor.id,
      version: previous.length + 1,
      status: 'Pending Evidence',
      createdAt: at,
      updatedAt: at,
      ...value,
      evidence: [],
      history: [{ type: 'WEALTH_CASE_CREATED', at, actorId: actor.id, to: 'Pending Evidence' }],
    };
    this.db.wealthCases.unshift(wc);
    if (previous.length)
      this.log(
        'WEALTH_REVERIFICATION_REQUESTED',
        id,
        clientId,
        undefined,
        `Previous case ${previous[0].id} (v${previous[0].version}, ${previous[0].status}) → ${id} (v${wc.version})`,
      );
    this.log(
      'WEALTH_CASE_CREATED',
      id,
      clientId,
      undefined,
      `v${wc.version} · ${this.assetSummary(wc)}`,
    );
    await this.commit();
    return id;
  }
  async updateWealthDeclaration(caseId: string, input: WealthInput) {
    const { actor, wc } = this.agentWealthCase(caseId);
    if (!isEditableWealth(wc.status))
      throw new Error(`A case that is ${wc.status} cannot be edited.`);
    Object.assign(wc, this.validateWealth(input), { updatedAt: new Date().toISOString() });
    wc.history.push({ type: 'WEALTH_DECLARATION_UPDATED', at: wc.updatedAt, actorId: actor.id });
    this.log('WEALTH_DECLARATION_UPDATED', wc.id, wc.clientId, undefined, this.assetSummary(wc));
    return this.commit();
  }
  // Stands in for the presigned upload to private S3 quarantine, the malware scan and acceptance.
  async uploadWealthEvidence(
    caseId: string,
    assetId: string,
    docType: string,
    scenario: EvidenceScenario,
  ) {
    const { actor, wc, client } = this.agentWealthCase(caseId);
    if (!isEditableWealth(wc.status))
      throw new Error(`Evidence cannot be added while the case is ${wc.status}.`);
    const asset = wc.assets.find((a) => a.id === assetId);
    if (!asset) throw new Error('Select a declared asset.');
    const req = EVIDENCE_REQUIREMENTS[asset.type].find((r) => r.docType === docType);
    if (!req) throw new Error(`${docType} is not required for ${asset.type.toLowerCase()}.`);
    const at = new Date().toISOString();
    const evidence = {
      id: `EVD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      assetId,
      docType,
      uploadedAt: at,
      uploadedBy: actor.id,
      ...scanEvidence(client, asset, req, scenario),
    };
    wc.evidence.unshift(evidence);
    wc.updatedAt = at;
    wc.history.push({
      type: 'WEALTH_EVIDENCE_UPLOADED',
      at,
      actorId: actor.id,
      note: `${docType} · ${evidence.status}`,
    });
    this.log(
      'WEALTH_EVIDENCE_UPLOADED',
      evidence.id,
      wc.clientId,
      undefined,
      `Case ${wc.id} · ${docType} · claim ${assetId} · ${evidence.status}${evidence.reason ? ` (${evidence.reason})` : ''}`,
    );
    await this.commit();
    return structuredClone(evidence);
  }
  // Submission checks the checklist, then runs the analysis job (synchronously in the demo).
  async submitWealthCase(caseId: string) {
    const { actor, wc, client } = this.agentWealthCase(caseId);
    if (!isEditableWealth(wc.status))
      throw new Error(`A case that is ${wc.status} cannot be submitted.`);
    const missing = missingEvidence(wc);
    if (missing.length)
      throw new Error(
        `${missing.length} required document(s) missing, e.g. ${missing.slice(0, 2).join('; ')}.`,
      );
    const change = this.wealthStatus(wc, 'Under Review', actor.id);
    wc.history.push({ type: 'WEALTH_CASE_SUBMITTED', ...change });
    this.log(
      'WEALTH_CASE_SUBMITTED',
      wc.id,
      wc.clientId,
      [{ field: 'wealthStatus', before: change.from, after: change.to }],
      `v${wc.version} · ${wc.evidence.filter((e) => e.status === 'Accepted').length} accepted document(s)`,
    );
    const jobId = `JOB-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const result = analyseWealth(client, wc);
    wc.analysis = {
      at: new Date().toISOString(),
      jobId,
      exceptions: result.exceptions,
      claims: result.claims,
    };
    wc.history.push({
      type: 'WEALTH_ANALYSIS_COMPLETED',
      at: wc.analysis.at,
      note: `${result.exceptions.length} exception(s)`,
    });
    this.log(
      'WEALTH_ANALYSIS_COMPLETED',
      wc.id,
      wc.clientId,
      undefined,
      `Job ${jobId} · v${wc.version} · ${result.checks} checks · ${result.exceptions.length} exception(s)`,
      'SYSTEM',
    );
    return this.commit();
  }
  async decideWealthCase(
    caseId: string,
    outcome: 'Verified' | 'More Information Required' | 'Rejected',
    rationale: string,
    requestedInfo = '',
  ) {
    const admin = this.admin();
    const wc = this.wealthCase(caseId);
    if (wc.status !== 'Under Review') throw new Error('Only cases under review can be decided.');
    if (!['Verified', 'More Information Required', 'Rejected'].includes(outcome))
      throw new Error('Select a decision.');
    const text = rationale.trim();
    if (text.length < 10 || text.length > 1000)
      throw new Error('Record a rationale of 10–1000 characters.');
    const info = requestedInfo.trim();
    if (outcome === 'More Information Required' && (info.length < 10 || info.length > 500))
      throw new Error('Describe the information needed in 10–500 characters.');
    const change = this.wealthStatus(wc, outcome, admin.id);
    wc.decision = {
      reviewerId: admin.id,
      at: change.at,
      outcome,
      rationale: text,
      requestedInfo: outcome === 'More Information Required' ? info : undefined,
    };
    wc.history.push({ type: 'WEALTH_DECISION_RECORDED', ...change });
    // Review notes stay in the case record; the log carries the decision and open exceptions only.
    this.log(
      'WEALTH_DECISION_RECORDED',
      wc.id,
      wc.clientId,
      [{ field: 'wealthStatus', before: change.from, after: change.to }],
      `v${wc.version} · ${wc.analysis?.exceptions.length ?? 0} analysis exception(s) · rationale kept in the case record`,
    );
    if (outcome === 'Verified') this.evaluateActivation(wc.clientId);
    return this.commit();
  }
  // Opening a client's verification tab is logged once as a wealth profile view.
  async viewWealthProfile(clientId: string) {
    this.client(clientId);
    const cases = this.db.wealthCases.filter((w) => w.clientId === clientId);
    this.log(
      'WEALTH_PROFILE_VIEWED',
      clientId,
      clientId,
      undefined,
      `${cases.length} case(s) · current ${cases[0]?.status ?? 'none'}`,
    );
    return this.commit();
  }
  // Verification work queue: one WEALTH_CASE_VIEWED entry per search, with filters and count.
  async searchWealthCases(filters: WealthFilters = {}) {
    const u = this.actor();
    const f = Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) as WealthFilters;
    f.status ??= 'Open';
    const mine = (clientId: string) =>
      u.role === 'Admin' || this.db.clients.some((c) => c.id === clientId && c.agentId === u.id);
    const rows = this.db.wealthCases.filter(
      (w) =>
        mine(w.clientId) &&
        (!f.clientId || w.clientId === f.clientId) &&
        (f.status === 'Open' ? !isFinalWealth(w.status) : w.status === f.status),
    );
    this.log(
      'WEALTH_CASE_VIEWED',
      f.clientId ?? 'WEALTH',
      f.clientId,
      undefined,
      `Filters: ${Object.entries(f)
        .map(([k, v]) => `${k}=${v}`)
        .join(', ')} · ${rows.length} result(s)`,
    );
    await this.commit();
    return structuredClone(rows);
  }
  async deleteClient(id: string) {
    this.client(id, true);
    if (this.db.accounts.some((a) => a.clientId === id))
      throw new Error('Remove linked accounts before deleting this client.');
    // Data erasure: case text is scrubbed, while case records and audit entries are kept.
    for (const c of this.db.cases.filter((c) => c.clientId === id)) {
      c.description = ERASED;
      for (const h of c.history) if (h.note) h.note = ERASED;
    }
    // Recommendations are deleted outright on erasure.
    this.db.recoSets = this.db.recoSets.filter((s) => s.clientId !== id);
    this.db.recoOptOuts = this.db.recoOptOuts.filter((x) => x !== id);
    // Risk profiles and intervention notes are deleted outright on erasure.
    this.db.riskProfiles = this.db.riskProfiles.filter((p) => p.clientId !== id);
    this.db.interventions = this.db.interventions.filter((i) => i.clientId !== id);
    // Identity checks and wealth cases (declarations, evidence references, decisions) are deleted.
    this.db.identityChecks = this.db.identityChecks.filter((x) => x.clientId !== id);
    this.db.wealthCases = this.db.wealthCases.filter((w) => w.clientId !== id);
    this.db.clients = this.db.clients.filter((c) => c.id !== id);
    this.db.transactions = this.db.transactions.filter((t) => t.clientId !== id);
    this.log('Client deleted', id, id);
    return this.commit();
  }
  async createAccount(clientId: string, input: AccountInput) {
    this.client(clientId, true);
    if (
      !['Savings', 'Checking', 'Business'].includes(input.type) ||
      input.currency !== 'SGD' ||
      !input.branchId.trim() ||
      !/^\d{4}-\d{2}-\d{2}$/.test(input.openingDate) ||
      !Number.isFinite(input.initialDeposit) ||
      input.initialDeposit < 0
    )
      throw new Error('Complete all account fields with a non-negative initial deposit.');
    const id = `AC-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    // New accounts stay Pending until identity and every policy-required check pass.
    this.db.accounts.unshift({ ...input, status: 'Pending', id, clientId });
    this.log('Account created', id, clientId);
    this.evaluateActivation(clientId);
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
  // Agents see cases for their own clients plus cases reassigned to them; admins see all.
  private canSeeCase(u: User, c: Case) {
    return (
      u.role === 'Admin' ||
      c.agentId === u.id ||
      this.db.clients.some((x) => x.id === c.clientId && x.agentId === u.id)
    );
  }
  private findCase(id: string) {
    const c = this.db.cases.find((c) => c.id === id);
    if (!c || !this.canSeeCase(this.actor(), c)) throw new Error('Case is unavailable.');
    return c;
  }
  async raiseCase(input: CaseInput) {
    const actor = this.actor();
    if (actor.role !== 'Agent') throw new Error('Only agents can raise cases.');
    this.client(input.clientId, true);
    const description = input.description.trim();
    const transactionId = input.transactionId?.trim() || undefined;
    if (!CASE_CATEGORIES.includes(input.category)) throw new Error('Select a case category.');
    if (description.length < 10 || description.length > 1000)
      throw new Error('Describe the case in 10–1000 characters.');
    if (input.category === 'Transaction dispute' && !transactionId)
      throw new Error('Link the disputed transaction.');
    if (transactionId) {
      const t = this.db.transactions.find((t) => t.id === transactionId);
      if (!t || t.clientId !== input.clientId)
        throw new Error('This transaction ID was not found for the client.');
      if (
        this.db.cases.some(
          (c) =>
            c.transactionId === transactionId &&
            c.category === 'Transaction dispute' &&
            c.status !== 'Resolved',
        ) &&
        input.category === 'Transaction dispute'
      )
        throw new Error('This transaction already has an unresolved dispute.');
    }
    const at = new Date().toISOString();
    const id = `CASE-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    this.db.cases.unshift({
      id,
      clientId: input.clientId,
      agentId: actor.id,
      category: input.category,
      description,
      transactionId,
      status: 'Open',
      escalated: false,
      createdAt: at,
      slaStartedAt: at,
      history: [{ type: 'CASE_CREATED', at, actorId: actor.id }],
    });
    this.log(
      'CASE_CREATED',
      id,
      input.clientId,
      undefined,
      `${input.category}${transactionId ? ` · ${transactionId}` : ''}`,
    );
    await this.commit();
    return id;
  }
  async updateCaseStatus(id: string, to: CaseStatus, note: string) {
    const actor = this.actor();
    const c = this.findCase(id);
    if (actor.role !== 'Agent' || c.agentId !== actor.id)
      throw new Error('Only the assigned agent can update this case.');
    if (NEXT_STATUS[c.status] !== to)
      throw new Error(`A case cannot move from ${c.status} to ${to}.`);
    const text = note.trim();
    if (text.length < 5 || text.length > 500)
      throw new Error('Add a note of 5–500 characters for this status change.');
    const from = c.status;
    const at = new Date().toISOString();
    c.status = to;
    if (to === 'Resolved') c.resolvedAt = at;
    c.history.push({ type: 'STATUS_UPDATED', at, actorId: actor.id, from, to, note: text });
    this.log(
      'STATUS_UPDATED',
      id,
      c.clientId,
      [{ field: 'status', before: from, after: to }],
      `Note: ${filterPii(text)}`,
    );
    return this.commit();
  }
  // One CASE_VIEWED entry per query, recording the filters and result count rather than each case.
  async searchCases(filters: CaseFilters) {
    const u = this.actor();
    const f = Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) as CaseFilters;
    const same = (a?: string, b?: string) => !b || a?.toLowerCase() === b.trim().toLowerCase();
    const rows = this.db.cases.filter(
      (c) =>
        this.canSeeCase(u, c) &&
        (!f.status ||
          (f.status === 'Escalated'
            ? c.escalated && c.status !== 'Resolved'
            : c.status === f.status)) &&
        (!f.category || c.category === f.category) &&
        (!f.clientId || c.clientId === f.clientId) &&
        (!f.agentId || c.agentId === f.agentId) &&
        same(c.transactionId, f.transactionId) &&
        same(c.id, f.caseId),
    );
    const applied = Object.entries(f).map(([k, v]) => `${k}=${v}`);
    this.log(
      'CASE_VIEWED',
      f.caseId ?? 'CASES',
      f.clientId,
      undefined,
      `Filters: ${applied.join(', ') || 'none'} · ${rows.length} result(s)`,
    );
    await this.commit();
    return structuredClone(rows);
  }
  // Scheduled job: no signed-in actor is attributed, and it runs whether or not anyone is signed in.
  async runSlaCheck(now = new Date()) {
    const days = this.db.caseSettings.slaBusinessDays;
    const breached = this.db.cases.filter(
      (c) =>
        c.status !== 'Resolved' && !c.escalated && businessDaysBetween(c.slaStartedAt, now) > days,
    );
    for (const c of breached) {
      const reason = `SLA breach (${days} business days)`;
      c.escalated = true;
      c.history.push({ type: 'ESCALATED', at: now.toISOString(), reason });
      this.log(
        'ESCALATED',
        c.id,
        c.clientId,
        [{ field: 'escalated', before: 'false', after: 'true' }],
        `Reason: ${reason}. Admin notified by email (simulated SES).`,
        'SYSTEM',
      );
    }
    if (breached.length) await this.commit();
    return breached.length;
  }
  async reassignCase(id: string, agentId: string) {
    const admin = this.admin();
    const c = this.findCase(id);
    if (!c.escalated || c.status === 'Resolved')
      throw new Error('Only escalated, unresolved cases can be reassigned.');
    const target = this.db.users.find((u) => u.id === agentId && u.role === 'Agent' && u.active);
    if (!target) throw new Error('Select an active agent.');
    if (target.id === c.agentId) throw new Error('Choose a different agent.');
    const from = c.agentId;
    const at = new Date().toISOString();
    // The new agent gets a fresh SLA window; a further breach re-escalates the case.
    c.agentId = target.id;
    c.escalated = false;
    c.slaStartedAt = at;
    c.history.push({ type: 'REASSIGNED', at, actorId: admin.id, from, to: target.id });
    this.log('REASSIGNED', id, c.clientId, [{ field: 'agentId', before: from, after: target.id }]);
    return this.commit();
  }
  async updateSla(days: number) {
    this.admin();
    if (!Number.isInteger(days) || days < 1 || days > 30)
      throw new Error('Set an SLA of 1–30 business days.');
    const before = String(this.db.caseSettings.slaBusinessDays);
    this.db.caseSettings.slaBusinessDays = days;
    this.log('Case SLA updated', 'SLA', undefined, [
      { field: 'slaBusinessDays', before, after: String(days) },
    ]);
    await this.commit();
    return this.runSlaCheck();
  }
  private recoContext(clientId: string) {
    const client = this.db.clients.find((c) => c.id === clientId)!;
    const accounts = this.db.accounts.filter((a) => a.clientId === clientId);
    const transactions = this.db.transactions.filter((t) => t.clientId === clientId);
    const sets = this.db.recoSets.filter((s) => s.clientId === clientId);
    const s = signals(
      client,
      accounts,
      transactions,
      this.db.cases.filter((c) => c.clientId === clientId),
    );
    const suppressed = suppressedCategories(sets, this.db.products);
    const fp = fingerprint(
      client,
      accounts,
      transactions,
      s.openCases,
      [...suppressed.keys()],
      this.db.products,
    );
    return { s, suppressed, fp, current: sets.find((x) => x.status === 'Current') };
  }
  private recoAgent(clientId: string) {
    const actor = this.actor();
    if (actor.role !== 'Agent') throw new Error('Recommendations are an agent workflow.');
    this.client(clientId);
    if (this.db.recoOptOuts.includes(clientId))
      throw new Error('This client has withdrawn consent to product recommendations.');
    return actor;
  }
  // Masks PII, asks the AI service, validates its output, and falls back to rules on any failure.
  private generateRecommendations(clientId: string, agentId: string, mode: AiMode) {
    const { s, suppressed, fp } = this.recoContext(clientId);
    const candidates = this.db.products.filter(
      (p) => !suppressed.has(p.category) && !eligibility(p, s),
    );
    const payload = maskedPayload(s);
    const id = `REC-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    let items: AiItem[] | null = null;
    let fallbackReason: string | undefined;
    try {
      items = validateAiOutput(
        callAiService(payload, candidates, s, mode),
        new Set(candidates.map((p) => p.id)),
      );
      if (!items) fallbackReason = 'AI service returned an invalid response';
    } catch (e) {
      fallbackReason = e instanceof Error ? e.message : 'AI service error';
    }
    if (fallbackReason) {
      this.log(
        'RECO_AI_FAILURE',
        id,
        clientId,
        undefined,
        `${fallbackReason}. Falling back to eligibility rules.`,
        agentId,
      );
      items = candidates.map((p) => ({ productId: p.id, ...ruleScore(p, s) }));
    }
    for (const old of this.db.recoSets)
      if (old.clientId === clientId && old.status === 'Current') old.status = 'Outdated';
    const set: RecommendationSet = {
      id,
      clientId,
      agentId,
      createdAt: new Date().toISOString(),
      status: 'Current',
      source: fallbackReason ? 'FALLBACK' : 'AI',
      model: fallbackReason ? 'eligibility-rules' : MODEL,
      promptVersion: PROMPT_VERSION,
      fallbackReason,
      fingerprint: fp,
      payload,
      items: items!
        .sort((a, b) => b.score - a.score)
        .map((r, i) => ({
          id: `${id}-${i + 1}`,
          productId: r.productId,
          rank: i + 1,
          score: r.score,
          reasons: r.reasons,
          simulations: [],
        })),
    };
    this.db.recoSets.unshift(set);
    this.log(
      'RECO_GENERATED',
      id,
      clientId,
      undefined,
      `${set.source} · model ${set.model} · prompt ${PROMPT_VERSION} · ` +
        set.items.map((r) => `${r.productId} ${r.score} (${r.reasons.join('; ')})`).join(' | '),
      agentId,
    );
    return set;
  }
  // Reuses the cached set while the client's data is unchanged; otherwise regenerates first.
  private currentSet(clientId: string, agentId: string) {
    const { current, fp } = this.recoContext(clientId);
    return current?.fingerprint === fp
      ? current
      : this.generateRecommendations(clientId, agentId, 'normal');
  }
  async getRecommendations(clientId: string, limit = 3) {
    const actor = this.recoAgent(clientId);
    const set = this.currentSet(clientId, actor.id);
    const shown = set.items.slice(0, limit);
    this.log(
      'RECO_VIEWED',
      set.id,
      clientId,
      undefined,
      `limit=${limit} · ${shown.map((r) => r.productId).join(', ') || 'no eligible products'}`,
    );
    await this.commit();
    return structuredClone({ ...set, items: shown });
  }
  async refreshRecommendations(clientId: string, mode: AiMode = 'normal') {
    const actor = this.recoAgent(clientId);
    const set = this.generateRecommendations(clientId, actor.id, mode);
    await this.commit();
    return structuredClone(set);
  }
  // Dashboard view: the top open recommendation per client, plus due follow-ups. Logged once.
  async getNextBestActions(limit = 5) {
    const actor = this.actor();
    if (actor.role !== 'Agent') throw new Error('Recommendations are an agent workflow.');
    const mine = this.db.clients.filter(
      (c) => c.agentId === actor.id && !this.db.recoOptOuts.includes(c.id),
    );
    const actions = mine
      .map((c) => {
        const set = this.currentSet(c.id, actor.id);
        const item = set.items.find((r) => !r.outcome);
        return item && { clientId: c.id, source: set.source, item };
      })
      .filter((a) => !!a)
      .sort((a, b) => b.item.score - a.item.score)
      .slice(0, limit);
    const followUps = this.db.recoSets
      .filter((s) => mine.some((c) => c.id === s.clientId))
      .flatMap((s) =>
        s.items
          .filter((r) => r.outcome?.type === 'Deferred')
          .map((item) => ({ clientId: s.clientId, item })),
      )
      .sort((a, b) => a.item.outcome!.followUpAt!.localeCompare(b.item.outcome!.followUpAt!));
    this.log(
      'RECO_VIEWED',
      'DASHBOARD',
      undefined,
      undefined,
      `Next best actions · limit=${limit} · ${actions.length} shown across ${mine.length} clients`,
    );
    await this.commit();
    return structuredClone({ actions, followUps });
  }
  private findRecommendation(id: string) {
    const set = this.db.recoSets.find((s) => s.items.some((r) => r.id === id));
    if (!set) throw new Error('Recommendation unavailable.');
    const actor = this.recoAgent(set.clientId);
    const item = set.items.find((r) => r.id === id)!;
    const product = this.db.products.find((p) => p.id === item.productId);
    if (!product) throw new Error('This product is no longer in the catalogue.');
    return { actor, set, item, product };
  }
  async simulateOffer(id: string, terms: OfferTerms) {
    const { set, item, product } = this.findRecommendation(id);
    if (item.outcome && item.outcome.type !== 'Deferred')
      throw new Error('An outcome has already been recorded for this recommendation.');
    const sim = {
      at: new Date().toISOString(),
      ...simulateTerms(product, terms, this.recoContext(set.clientId).s),
    };
    item.simulations.push(sim);
    this.log(
      'RECO_SIMULATED',
      id,
      set.clientId,
      undefined,
      `${product.name}: ${describeTerms(terms)} → ${sim.result}. ${sim.reasons.join('; ')}`,
    );
    await this.commit();
    return structuredClone(sim);
  }
  async recordOutcome(
    id: string,
    input: {
      type: RecoOutcomeType;
      reason?: string;
      channel?: FulfilmentChannel;
      followUpAt?: string;
    },
  ) {
    const { actor, set, item, product } = this.findRecommendation(id);
    if (item.outcome && item.outcome.type !== 'Deferred')
      throw new Error('An outcome has already been recorded for this recommendation.');
    if (!item.outcome && set.status !== 'Current')
      throw new Error('These recommendations are outdated. Refresh to see the current set.');
    const reason = input.reason?.trim() || undefined;
    if (reason && reason.length > 200) throw new Error('Keep the reason under 200 characters.');
    const today = new Date().toISOString().slice(0, 10);
    if (input.type === 'Accepted') {
      if (!['Application link', 'Brochure', 'Open account'].includes(input.channel ?? ''))
        throw new Error('Select a fulfilment channel.');
      if (input.channel === 'Open account' && !product.opensAccount)
        throw new Error('This product cannot be fulfilled by opening an account.');
    } else if (!reason)
      throw new Error(`Give a reason for the ${input.type.toLowerCase()} outcome.`);
    if (input.type === 'Deferred') {
      const max = new Date(Date.now() + 90 * 86_400_000).toISOString().slice(0, 10);
      if (!input.followUpAt || input.followUpAt <= today || input.followUpAt > max)
        throw new Error('Choose a follow-up date within the next 90 days.');
    }
    let accountId: string | undefined;
    if (input.type === 'Accepted' && input.channel === 'Open account') {
      accountId = `AC-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
      this.db.accounts.unshift({
        id: accountId,
        clientId: set.clientId,
        type: product.opensAccount!,
        status: 'Pending',
        openingDate: today,
        initialDeposit: 0,
        currency: 'SGD',
        branchId: 'SG-001',
      });
      this.log('Account created', accountId, set.clientId, undefined, `From recommendation ${id}`);
      this.evaluateActivation(set.clientId);
    }
    const before = item.outcome?.type ?? 'None';
    item.outcome = {
      type: input.type,
      at: new Date().toISOString(),
      agentId: actor.id,
      reason,
      channel: input.type === 'Accepted' ? input.channel : undefined,
      accountId,
      followUpAt: input.type === 'Deferred' ? input.followUpAt : undefined,
    };
    this.log(
      'RECO_OUTCOME',
      id,
      set.clientId,
      [{ field: 'outcome', before, after: input.type }],
      [
        product.name,
        reason && `Reason: ${filterPii(reason)}`,
        item.outcome.channel &&
          `Fulfilment: ${item.outcome.channel}${accountId ? ` → ${accountId}` : ' sent (simulated)'}`,
        input.type === 'Rejected' && `${product.category} suppressed for 90 days`,
        item.outcome.followUpAt && `Follow-up on ${item.outcome.followUpAt}`,
      ]
        .filter(Boolean)
        .join(' · '),
    );
    return this.commit();
  }
  async setRecoConsent(clientId: string, consent: boolean) {
    const actor = this.actor();
    if (actor.role !== 'Agent') throw new Error('Recommendations are an agent workflow.');
    this.client(clientId, true);
    const before = !this.db.recoOptOuts.includes(clientId);
    if (before === consent) return this.commit();
    this.db.recoOptOuts = consent
      ? this.db.recoOptOuts.filter((x) => x !== clientId)
      : [...this.db.recoOptOuts, clientId];
    if (!consent)
      for (const s of this.db.recoSets) if (s.clientId === clientId) s.status = 'Outdated';
    this.log('RECO_CONSENT', clientId, clientId, [
      { field: 'recoConsent', before: String(before), after: String(consent) },
    ]);
    return this.commit();
  }
  // Scheduled job (AnalyzeRetentionRisks): flags clients from ingested transactions. Only changes
  // are logged, so running it often is harmless.
  async runRiskAnalysis(now = new Date()) {
    const asOf = analysisDate(this.db.transactions, now);
    const at = now.toISOString();
    let flagged = 0;
    for (const c of this.db.clients) {
      const r = analyseRisk(
        this.db.accounts.filter((a) => a.clientId === c.id),
        this.db.transactions.filter((t) => t.clientId === c.id),
        this.db.cases.filter((x) => x.clientId === c.id),
        asOf,
      );
      const p = this.db.riskProfiles.find((p) => p.clientId === c.id);
      const risky = r && r.level !== 'Low';
      const closedDays = p?.closedAt ? (now.getTime() - Date.parse(p.closedAt)) / 86_400_000 : 0;
      if (risky && (!p || (!isOpenRisk(p) && closedDays >= REFLAG_AFTER_DAYS))) {
        const from = p?.status;
        const profile: RiskProfile = p ?? {
          clientId: c.id,
          level: r.level,
          score: r.score,
          reasons: r.reasons,
          status: 'At Risk',
          flaggedAt: at,
          history: [],
        };
        Object.assign(profile, {
          level: r.level,
          score: r.score,
          reasons: r.reasons,
          status: 'At Risk',
          flaggedAt: at,
          closedAt: undefined,
        });
        profile.history.push({
          type: 'RISK_FLAGGED',
          at,
          to: r.level,
          note: from && `Flagged again ${Math.floor(closedDays)} days after being marked ${from}`,
        });
        if (!p) this.db.riskProfiles.unshift(profile);
        this.log(
          'RISK_FLAGGED',
          c.id,
          c.id,
          undefined,
          `${r.level} risk (score ${r.score}) · ${r.reasons.join('; ')} · data as of ${asOf.toISOString().slice(0, 10)}`,
          'SYSTEM',
        );
        flagged++;
      } else if (p && isOpenRisk(p)) {
        const level = r?.level ?? 'Low';
        const reasons = r?.reasons.length
          ? r.reasons
          : ['Risk signals have cleared since the flag'];
        if (level === p.level && reasons.join('|') === p.reasons.join('|')) continue;
        const before = p.level;
        Object.assign(p, { level, score: r?.score ?? 0, reasons });
        if (level !== before) p.history.push({ type: 'RISK_UPDATED', at, from: before, to: level });
        this.log(
          'RISK_UPDATED',
          c.id,
          c.id,
          [{ field: 'riskLevel', before, after: level }],
          reasons.join('; '),
          'SYSTEM',
        );
      }
    }
    this.db.riskJob = { lastRunAt: at, asOf: asOf.toISOString() };
    await this.commit();
    return flagged;
  }
  // Agents see their own clients' profiles; admins see every profile but cannot act on them.
  private riskProfile(clientId: string, write = false) {
    const actor = this.actor();
    if (write && actor.role !== 'Agent')
      throw new Error('Retention actions are an agent workflow.');
    this.client(clientId);
    const p = this.db.riskProfiles.find((p) => p.clientId === clientId);
    if (!p) throw new Error('This client has no attrition risk flag.');
    return { actor, p };
  }
  // One RISK_VIEWED entry per dashboard load, with the filters applied and the result count.
  async getRetentionRisks(filters: RiskFilters = {}) {
    const u = this.actor();
    const f = Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) as RiskFilters;
    f.status ??= 'Open';
    if (u.role === 'Agent') delete f.agentId;
    const agentOf = (id: string) => this.db.clients.find((c) => c.id === id)?.agentId;
    const rows = this.db.riskProfiles
      .filter((p) => {
        const agent = agentOf(p.clientId);
        return (
          agent &&
          (u.role === 'Admin' || agent === u.id) &&
          (!f.agentId || agent === f.agentId) &&
          (!f.clientId || p.clientId === f.clientId) &&
          (!f.level || p.level === f.level) &&
          (f.status === 'All' || (f.status === 'Open' ? isOpenRisk(p) : p.status === f.status))
        );
      })
      .sort(
        (a, b) =>
          RISK_STATUSES.indexOf(a.status) - RISK_STATUSES.indexOf(b.status) ||
          RISK_LEVELS.indexOf(a.level) - RISK_LEVELS.indexOf(b.level) ||
          b.score - a.score,
      );
    this.log(
      'RISK_VIEWED',
      f.clientId ?? 'RETENTION',
      f.clientId,
      undefined,
      `Filters: ${Object.entries(f)
        .map(([k, v]) => `${k}=${v}`)
        .join(', ')} · ${rows.length} result(s)`,
    );
    await this.commit();
    return structuredClone(rows);
  }
  async logIntervention(clientId: string, input: InterventionInput) {
    const { actor, p } = this.riskProfile(clientId, true);
    if (!isOpenRisk(p))
      throw new Error(
        `This client is marked ${p.status}. Interventions are logged while a client is At Risk or Under Review.`,
      );
    if (!INTERVENTION_TYPES.includes(input.type)) throw new Error('Select an intervention type.');
    const notes = input.notes.trim();
    if (notes.length < 10 || notes.length > 1000)
      throw new Error('Describe the conversation in 10–1000 characters.');
    let followUpAt: string | undefined;
    if (input.type === 'Follow-up Scheduled') {
      const today = new Date().toISOString().slice(0, 10);
      const max = new Date(Date.now() + 90 * 86_400_000).toISOString().slice(0, 10);
      if (!input.followUpAt || input.followUpAt <= today || input.followUpAt > max)
        throw new Error('Choose a follow-up date within the next 90 days.');
      followUpAt = input.followUpAt;
    }
    const at = new Date().toISOString();
    const id = `INT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    this.db.interventions.unshift({
      id,
      clientId,
      agentId: actor.id,
      type: input.type,
      notes,
      at,
      followUpAt,
    });
    p.history.push({ type: 'INTERVENTION_LOGGED', at, actorId: actor.id, interventionId: id });
    this.log(
      'INTERVENTION_LOGGED',
      id,
      clientId,
      undefined,
      `Type: ${input.type}${followUpAt ? ` · follow-up ${followUpAt}` : ''} · Notes: ${filterPii(notes)}`,
    );
    // Logging an intervention immediately moves an At Risk client to Under Review.
    if (p.status === 'At Risk') {
      p.status = 'Under Review';
      p.history.push({
        type: 'STATUS_UPDATED',
        at,
        actorId: actor.id,
        from: 'At Risk',
        to: p.status,
      });
      this.log(
        'STATUS_UPDATED',
        clientId,
        clientId,
        [{ field: 'riskStatus', before: 'At Risk', after: p.status }],
        `Retention lifecycle · after intervention ${id}`,
      );
    }
    await this.commit();
    return id;
  }
  async updateRiskStatus(clientId: string, to: RiskStatus, note = '') {
    const { actor, p } = this.riskProfile(clientId, true);
    if (!RISK_TRANSITIONS[p.status].includes(to))
      throw new Error(`A client cannot move from ${p.status} to ${to}.`);
    const text = note.trim();
    if (text.length > 500) throw new Error('Keep the note under 500 characters.');
    if (!isOpenRisk({ status: to }) && text.length < 5)
      throw new Error(`Add a note of 5–500 characters explaining why the client is ${to}.`);
    const from = p.status;
    const at = new Date().toISOString();
    p.status = to;
    if (!isOpenRisk(p)) p.closedAt = at;
    p.history.push({
      type: 'STATUS_UPDATED',
      at,
      actorId: actor.id,
      from,
      to,
      note: text || undefined,
    });
    this.log(
      'STATUS_UPDATED',
      clientId,
      clientId,
      [{ field: 'riskStatus', before: from, after: to }],
      `Retention lifecycle${text ? ` · Note: ${filterPii(text)}` : ''}`,
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
