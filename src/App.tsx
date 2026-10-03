import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { DemoService } from './lib/service';
import type { User, Client, CaseFilters, AiMode, RiskFilters } from './lib/types';
import { NEXT_STATUS, isEscalated } from './lib/cases';
import { Modal } from './components/ui';
import HelpGuide from './components/HelpGuide';
import Toast from './components/Toast';
import Sidebar from './layout/Sidebar';
import Topbar from './layout/Topbar';
import LoginScreen from './features/auth/LoginScreen';
import Overview from './features/Overview';
import { ClientList, ClientDetail } from './features/clients/Clients';
import ClientForm from './features/clients/ClientForm';
import AccountForm from './features/clients/AccountForm';
import VerificationForm from './features/clients/VerificationForm';
import Transactions from './features/transactions/Transactions';
import ImportForm from './features/transactions/ImportForm';
import UserForm from './features/users/UserForm';
import UserManagement from './features/users/UserManagement';
import Audit from './features/audit/Audit';
import { CaseList, CaseDetail } from './features/cases/Cases';
import CaseForm from './features/cases/CaseForm';
import { StatusForm, ReassignForm, SlaForm } from './features/cases/CaseActionForms';
import {
  NextBestActions,
  RecommendationsPanel,
  type NextBestActionsData,
} from './features/recommendations/Recommendations';
import { OutcomeForm, RefreshForm, SimulateForm } from './features/recommendations/RecoForms';
import { RiskBadge, RiskDetail, RiskList } from './features/retention/Retention';
import { InterventionForm, RiskStatusForm } from './features/retention/RetentionForms';
import { analyseRisk, isOpenRisk } from './lib/retention';

const service = new DemoService(localStorage);

type Dialog =
  | { kind: 'client'; client?: Client }
  | { kind: 'account'; clientId: string }
  | { kind: 'verify'; clientId: string }
  | { kind: 'import' }
  | { kind: 'user'; user?: User }
  | { kind: 'case'; clientId?: string }
  | { kind: 'caseStatus'; caseId: string }
  | { kind: 'reassign'; caseId: string }
  | { kind: 'sla' }
  | { kind: 'recoRefresh'; clientId: string }
  | { kind: 'simulate'; recoId: string }
  | { kind: 'outcome'; recoId: string }
  | { kind: 'intervention'; clientId: string }
  | { kind: 'riskStatus'; clientId: string }
  | { kind: 'confirm'; title: string; text: string; action: () => Promise<unknown> }
  | { kind: 'help' };

function dialogTitle(dialog: Dialog) {
  switch (dialog.kind) {
    case 'client':
      return dialog.client ? 'Edit client profile' : 'Onboard a new client';
    case 'account':
      return 'Open a bank account';
    case 'verify':
      return 'Verify client identity';
    case 'import':
      return 'Import transactions';
    case 'user':
      return dialog.user ? 'Edit user' : 'Create a team member';
    case 'case':
      return 'Raise a complaint or dispute';
    case 'caseStatus':
      return 'Update case status';
    case 'reassign':
      return 'Reassign escalated case';
    case 'sla':
      return 'Case resolution SLA';
    case 'recoRefresh':
      return 'Refresh recommendations';
    case 'simulate':
      return 'Simulate offer terms';
    case 'outcome':
      return 'Record recommendation outcome';
    case 'intervention':
      return 'Log retention intervention';
    case 'riskStatus':
      return 'Update risk status';
    case 'confirm':
      return dialog.title;
    case 'help':
      return 'Your demo, step by step';
  }
}

export default function App() {
  const [db, setDb] = useState(() => service.snapshot());
  const [user, setUser] = useState<User | null>(null);
  const [loginId, setLoginId] = useState('USR-003');
  const [page, setPage] = useState('Overview');
  const [clientId, setClientId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [menu, setMenu] = useState(false);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [caseFilters, setCaseFilters] = useState<CaseFilters>({});
  const [caseIds, setCaseIds] = useState<string[]>([]);
  const [clientTab, setClientTab] = useState('Overview');
  const [nba, setNba] = useState<NextBestActionsData | null>(null);
  const [riskFilters, setRiskFilters] = useState<RiskFilters>({});
  const [riskIds, setRiskIds] = useState<string[]>([]);
  const [riskClientId, setRiskClientId] = useState<string | null>(null);

  useEffect(() => {
    if (toast) {
      const id = setTimeout(() => setToast(''), 4500);
      return () => clearTimeout(id);
    }
  }, [toast]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [page, clientId, caseId, riskClientId]);

  // An agent's dashboard asks for next best actions; stale or missing sets are regenerated first.
  useEffect(() => {
    if (user?.role !== 'Agent' || page !== 'Overview') return;
    setNba(null);
    service
      .getNextBestActions()
      .then((data) => {
        setNba(data);
        setDb(service.snapshot());
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Recommendations unavailable.'));
  }, [user, page]);

  // Stands in for the scheduled jobs (SLA check, daily attrition analysis): on sign-in, then
  // every minute.
  useEffect(() => {
    if (!user) return;
    const check = async () => {
      const escalated = await service.runSlaCheck();
      const flagged = await service.runRiskAnalysis();
      setDb(service.snapshot());
      if (escalated && user.role === 'Admin')
        setToast(
          `${escalated} ${escalated === 1 ? 'case' : 'cases'} breached the SLA and escalated. Admin email simulated.`,
        );
      else if (flagged)
        setToast(
          `Attrition analysis flagged ${flagged} ${flagged === 1 ? 'client' : 'clients'}. See Retention.`,
        );
    };
    void check();
    const id = setInterval(() => void check(), 60_000);
    return () => clearInterval(id);
  }, [user]);

  const run = async (action: () => Promise<unknown>, message = '', close = true) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await action();
      setDb(service.snapshot());
      if (close) setDialog(null);
      if (message) setToast(message);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const open = (d: Dialog) => {
    setError('');
    setDialog(d);
  };

  const confirm = (title: string, text: string, action: () => Promise<unknown>) =>
    open({ kind: 'confirm', title, text, action });

  // Each case list load is a search, recorded once in the audit log by the service.
  const searchCases = (filters: CaseFilters) =>
    void run(
      async () => {
        const rows = await service.searchCases(filters);
        setCaseIds(rows.map((c) => c.id));
        setCaseFilters(filters);
      },
      '',
      false,
    );

  // Each dashboard load is logged once as RISK_VIEWED, with its filters and result count.
  const searchRisks = (filters: RiskFilters) =>
    void run(
      async () => {
        const rows = await service.getRetentionRisks(filters);
        setRiskIds(rows.map((p) => p.clientId));
        setRiskFilters(filters);
      },
      '',
      false,
    );

  const navigate = (p: string, filters: CaseFilters | RiskFilters = {}) => {
    setPage(p);
    setClientId(null);
    setCaseId(null);
    setRiskClientId(null);
    setMenu(false);
    setError('');
    if (p === 'Cases') searchCases(filters as CaseFilters);
    if (p === 'Retention') searchRisks(filters as RiskFilters);
  };

  const openRisk = (id: string) =>
    void run(
      async () => {
        await service.getRetentionRisks({ clientId: id, status: 'All' });
        setRiskClientId(id);
        setClientId(null);
        setCaseId(null);
        setPage('Retention');
      },
      '',
      false,
    );

  const openCase = (id: string) =>
    void run(
      async () => {
        await service.searchCases({ caseId: id });
        setCaseId(id);
        setClientId(null);
        setPage('Cases');
      },
      '',
      false,
    );

  const openClient = (id: string, tab = 'Overview') => {
    void run(
      async () => {
        await service.viewClient(id);
        if (tab === 'Recommendations') await service.getRecommendations(id);
        setClientTab(tab);
        setClientId(id);
        setCaseId(null);
        setPage('Clients');
      },
      '',
      false,
    );
  };

  if (!user)
    return (
      <LoginScreen
        users={db.users}
        loginId={loginId}
        busy={busy}
        error={error}
        toast={toast}
        onSelect={setLoginId}
        onError={setError}
        onLogin={() =>
          void run(async () => {
            setUser(await service.login(loginId));
            navigate('Overview');
          }, 'Welcome to your workspace')
        }
        onResetPassword={() =>
          void run(
            () => service.resetPassword(loginId),
            'Password reset simulated. No email was sent.',
          )
        }
      />
    );

  // Admins see everything; agents only see their own clients and the records linked to them.
  const admin = user.role === 'Admin';
  const clients = db.clients.filter((c) => admin || c.agentId === user.id);
  const ids = new Set(clients.map((c) => c.id));
  const accounts = db.accounts.filter((a) => ids.has(a.clientId));
  const transactions = db.transactions
    .filter((t) => ids.has(t.clientId))
    .sort((a, b) => b.date.localeCompare(a.date));
  const events = db.audit.filter((e) => admin || e.actorId === user.id);
  const imports = db.imports.filter((i) => admin || i.actorId === user.id);
  const client = clients.find((c) => c.id === clientId);
  const caseRows = caseIds.flatMap((id) => db.cases.filter((c) => c.id === id));
  const caseRecord = page === 'Cases' ? db.cases.find((c) => c.id === caseId) : undefined;
  const escalated = db.cases.filter((c) => isEscalated(c) && (admin || c.agentId === user.id));
  const sla = db.caseSettings.slaBusinessDays;
  const riskProfiles = db.riskProfiles.filter((p) => ids.has(p.clientId));
  const riskRows = riskIds.flatMap((id) => riskProfiles.filter((p) => p.clientId === id));
  const riskRecord =
    page === 'Retention' ? riskProfiles.find((p) => p.clientId === riskClientId) : undefined;
  const riskClient = riskRecord && db.clients.find((c) => c.id === riskRecord.clientId);
  const highRisk = riskProfiles.filter((p) => isOpenRisk(p) && p.level === 'High').length;

  const pageTitle = client
    ? `${client.firstName} ${client.lastName}`
    : caseRecord
      ? caseRecord.id
      : riskClient
        ? `${riskClient.firstName} ${riskClient.lastName}`
        : page === 'Clients' && !admin
          ? 'My clients'
          : page;

  return (
    <div className="app-shell">
      <Sidebar
        user={user}
        admin={admin}
        page={page}
        clientCount={clients.length}
        caseCount={escalated.length}
        riskCount={highRisk}
        open={menu}
        onNavigate={navigate}
        onClose={() => setMenu(false)}
        onHelp={() => open({ kind: 'help' })}
        onSignOut={() =>
          void run(async () => {
            await service.logout();
            setUser(null);
            setLoginId(user.id);
          }, 'Signed out')
        }
      />

      <div className="main-shell">
        <Topbar
          user={user}
          title={pageTitle}
          parent={
            client
              ? { label: admin ? 'Clients' : 'My clients', onClick: () => setClientId(null) }
              : caseRecord
                ? { label: 'Cases', onClick: () => navigate('Cases', caseFilters) }
                : riskRecord
                  ? { label: 'Retention', onClick: () => navigate('Retention', riskFilters) }
                  : undefined
          }
          onOpenMenu={() => setMenu(true)}
        />

        <main className="content">
          {error && !dialog && (
            <div className="error-banner" role="alert">
              {error}
              <button aria-label="Dismiss error" onClick={() => setError('')}>
                <X size={16} />
              </button>
            </div>
          )}

          {page === 'Overview' && (
            <Overview
              user={user}
              clients={clients}
              accounts={accounts}
              transactions={transactions}
              events={events}
              onNavigate={navigate}
              onClient={openClient}
              onCreate={() => open({ kind: 'client' })}
              escalated={escalated.length}
              onEscalated={() => navigate('Cases', { status: 'Escalated' })}
              highRisk={highRisk}
              onHighRisk={() => navigate('Retention', { level: 'High' })}
              nextBestActions={
                !admin && (
                  <NextBestActions
                    data={nba}
                    clients={clients}
                    products={db.products}
                    onOpen={(id) => openClient(id, 'Recommendations')}
                  />
                )
              }
            />
          )}

          {page === 'Clients' &&
            (client ? (
              <ClientDetail
                key={`${client.id}-${clientTab}`}
                client={client}
                agent={db.users.find((u) => u.id === client.agentId)}
                accounts={accounts.filter((a) => a.clientId === client.id)}
                transactions={transactions.filter((t) => t.clientId === client.id)}
                canEdit={!admin}
                onBack={() => setClientId(null)}
                onEdit={() => open({ kind: 'client', client })}
                onVerify={() => open({ kind: 'verify', clientId: client.id })}
                onDelete={() =>
                  confirm(
                    'Delete client profile?',
                    accounts.some((a) => a.clientId === client.id)
                      ? 'This client has linked accounts. Remove those accounts before deleting the profile.'
                      : 'This removes the client profile from this local demo. The audit entry is retained.',
                    async () => {
                      await service.deleteClient(client.id);
                      setClientId(null);
                    },
                  )
                }
                onAccount={() => open({ kind: 'account', clientId: client.id })}
                cases={caseRows}
                caseCount={db.cases.filter((x) => x.clientId === client.id).length}
                users={db.users}
                sla={sla}
                onCasesTab={() => searchCases({ clientId: client.id })}
                onRaiseCase={() => open({ kind: 'case', clientId: client.id })}
                onOpenCase={openCase}
                initialTab={clientTab}
                riskFlag={(() => {
                  const p = riskProfiles.find((x) => x.clientId === client.id && isOpenRisk(x));
                  return (
                    p && (
                      <button
                        className="badge-button"
                        title="Open attrition risk"
                        onClick={() => openRisk(client.id)}
                      >
                        <RiskBadge level={p.level} />
                      </button>
                    )
                  );
                })()}
                onRecoTab={() => {
                  if (!db.recoOptOuts.includes(client.id))
                    void run(() => service.getRecommendations(client.id), '', false);
                }}
                recommendations={
                  !admin && (
                    <RecommendationsPanel
                      client={client}
                      set={db.recoSets.find(
                        (s) => s.clientId === client.id && s.status === 'Current',
                      )}
                      sets={db.recoSets.filter((s) => s.clientId === client.id)}
                      products={db.products}
                      users={db.users}
                      optedOut={db.recoOptOuts.includes(client.id)}
                      onRefresh={() => open({ kind: 'recoRefresh', clientId: client.id })}
                      onSimulate={(id) => open({ kind: 'simulate', recoId: id })}
                      onOutcome={(id) => open({ kind: 'outcome', recoId: id })}
                      onConsent={(consent) =>
                        confirm(
                          consent ? 'Record restored consent?' : 'Record withdrawn consent?',
                          consent
                            ? `Recommendations will be generated for ${client.firstName} again.`
                            : `No recommendations will be generated for ${client.firstName}. The current set is marked outdated.`,
                          async () => {
                            await service.setRecoConsent(client.id, consent);
                            if (consent) await service.getRecommendations(client.id);
                          },
                        )
                      }
                    />
                  )
                }
                onDeleteAccount={(id) =>
                  confirm(
                    'Delete bank account?',
                    'This removes the account and its associated demo transactions. The action is recorded in the audit log.',
                    () => service.deleteAccount(id),
                  )
                }
              />
            ) : (
              <ClientList
                clients={clients}
                accounts={accounts}
                users={db.users}
                canEdit={!admin}
                onOpen={openClient}
                onCreate={() => open({ kind: 'client' })}
              />
            ))}

          {page === 'Transactions' && (
            <Transactions
              rows={transactions}
              clients={clients}
              imports={imports}
              canImport={!admin}
              onImport={() => open({ kind: 'import' })}
            />
          )}

          {page === 'Cases' &&
            (caseRecord ? (
              <CaseDetail
                key={caseRecord.id}
                c={caseRecord}
                client={db.clients.find((x) => x.id === caseRecord.clientId)}
                transaction={db.transactions.find((t) => t.id === caseRecord.transactionId)}
                users={db.users}
                sla={sla}
                canUpdate={!admin && caseRecord.agentId === user.id}
                canReassign={admin && isEscalated(caseRecord)}
                onBack={() => navigate('Cases', caseFilters)}
                onStatus={() => open({ kind: 'caseStatus', caseId: caseRecord.id })}
                onReassign={() => open({ kind: 'reassign', caseId: caseRecord.id })}
                onClient={
                  ids.has(caseRecord.clientId) ? () => openClient(caseRecord.clientId) : undefined
                }
              />
            ) : (
              <CaseList
                key={JSON.stringify(caseFilters)}
                rows={caseRows}
                clients={clients}
                users={db.users}
                filters={caseFilters}
                admin={admin}
                sla={sla}
                busy={busy}
                onSearch={searchCases}
                onOpen={openCase}
                onRaise={() => open({ kind: 'case' })}
                onSla={() => open({ kind: 'sla' })}
              />
            ))}

          {page === 'Retention' &&
            (riskRecord ? (
              <RiskDetail
                key={riskRecord.clientId}
                profile={riskRecord}
                client={riskClient}
                users={db.users}
                interventions={db.interventions.filter((i) => i.clientId === riskRecord.clientId)}
                analysis={
                  db.riskJob.asOf
                    ? analyseRisk(
                        accounts.filter((a) => a.clientId === riskRecord.clientId),
                        transactions.filter((t) => t.clientId === riskRecord.clientId),
                        db.cases.filter((c) => c.clientId === riskRecord.clientId),
                        new Date(db.riskJob.asOf),
                      )
                    : null
                }
                asOf={db.riskJob.asOf}
                canAct={!admin}
                onBack={() => navigate('Retention', riskFilters)}
                onIntervention={() => open({ kind: 'intervention', clientId: riskRecord.clientId })}
                onStatus={() => open({ kind: 'riskStatus', clientId: riskRecord.clientId })}
                onClient={() => openClient(riskRecord.clientId)}
              />
            ) : (
              <RiskList
                key={JSON.stringify(riskFilters)}
                rows={riskRows}
                profiles={riskProfiles}
                clients={clients}
                users={db.users}
                interventions={db.interventions.filter((i) => ids.has(i.clientId))}
                filters={riskFilters}
                admin={admin}
                busy={busy}
                job={db.riskJob}
                onSearch={searchRisks}
                onOpen={openRisk}
                onRunJob={() =>
                  void run(async () => {
                    const n = await service.runRiskAnalysis();
                    const rows = await service.getRetentionRisks(riskFilters);
                    setRiskIds(rows.map((p) => p.clientId));
                    setToast(
                      n
                        ? `Analysis complete: ${n} ${n === 1 ? 'client' : 'clients'} newly flagged`
                        : 'Analysis complete: no new flags',
                    );
                  })
                }
              />
            ))}

          {page === 'User management' && admin && (
            <UserManagement
              users={db.users}
              currentUser={user}
              onCreate={() => open({ kind: 'user' })}
              onEdit={(u) => open({ kind: 'user', user: u })}
              onResetPassword={(u) =>
                confirm(
                  'Simulate password reset?',
                  `Record a password reset for ${u.firstName}. No email will be sent.`,
                  () => service.resetPassword(u.id),
                )
              }
              onToggle={(u) =>
                confirm(
                  `${u.active ? 'Disable' : 'Enable'} user?`,
                  `${u.firstName} ${u.active ? 'will no longer be able to sign in' : 'will be able to sign in'} to this demo.`,
                  () => service.changeUser(u.id, 'toggle'),
                )
              }
              onDelete={(u) =>
                confirm(
                  'Delete user?',
                  `Remove ${u.firstName} from the demo. Agents with assigned clients cannot be deleted.`,
                  () => service.changeUser(u.id, 'delete'),
                )
              }
              onResetDemo={() =>
                confirm(
                  'Reset all demo data?',
                  'All browser-local changes will be replaced with the original sample data. You will be signed out.',
                  async () => {
                    await service.reset();
                    setUser(null);
                    setLoginId('USR-003');
                  },
                )
              }
            />
          )}

          {page === 'Audit log' && admin && <Audit events={events} users={db.users} />}

          <footer className="page-footer">
            <span>
              Scrooge Global Bank <span> / </span> Relationship workspace
            </span>
            <span>
              <i />
              Local demonstration · Singapore
            </span>
          </footer>
        </main>
      </div>

      {dialog && (
        <Modal
          title={dialogTitle(dialog)}
          subtitle={
            dialog.kind === 'client' ? 'A thoughtful start to a lasting relationship.' : undefined
          }
          guardChanges={
            dialog.kind === 'client' ||
            dialog.kind === 'account' ||
            dialog.kind === 'user' ||
            dialog.kind === 'case' ||
            dialog.kind === 'intervention'
          }
          onClose={() => {
            if (!busy) {
              setDialog(null);
              setError('');
            }
          }}
        >
          {error && (
            <div className="error-banner modal-error" role="alert">
              {error}
            </div>
          )}

          {dialog.kind === 'client' && (
            <ClientForm
              client={dialog.client}
              clients={db.clients}
              busy={busy}
              onSave={(v) =>
                void run(
                  async () => {
                    const id = await service.saveClient(v, dialog.client?.id);
                    setClientId(id);
                    setPage('Clients');
                  },
                  dialog.client ? 'Client profile updated' : 'Client created successfully',
                )
              }
            />
          )}

          {dialog.kind === 'account' && (
            <AccountForm
              busy={busy}
              onSave={(v) =>
                void run(() => service.createAccount(dialog.clientId, v), 'Bank account created')
              }
            />
          )}

          {dialog.kind === 'user' && (
            <UserForm
              user={dialog.user}
              busy={busy}
              onSave={(v) =>
                void run(async () => {
                  await service.saveUser(v, dialog.user?.id);
                  if (dialog.user?.id === user.id) {
                    setUser(service.snapshot().users.find((u) => u.id === user.id)!);
                    navigate('Overview');
                  }
                }, 'User saved successfully')
              }
            />
          )}

          {dialog.kind === 'verify' && (
            <VerificationForm
              busy={busy}
              onSave={(outcome) =>
                void run(
                  () => service.verify(dialog.clientId, outcome),
                  `Identity review complete: ${outcome.toLowerCase()}`,
                )
              }
            />
          )}

          {dialog.kind === 'import' && (
            <ImportForm
              busy={busy}
              onSave={(scenario) =>
                void run(
                  () => service.importTransactions(scenario),
                  'Import completed. Review the results in import history.',
                )
              }
            />
          )}

          {dialog.kind === 'case' && (
            <CaseForm
              clients={clients}
              transactions={transactions}
              clientId={dialog.clientId}
              busy={busy}
              onSave={(v) =>
                void run(async () => {
                  const id = await service.raiseCase(v);
                  setCaseId(id);
                  setClientId(null);
                  setPage('Cases');
                }, 'Case raised with status Open')
              }
            />
          )}

          {dialog.kind === 'caseStatus' &&
            (() => {
              const c = db.cases.find((x) => x.id === dialog.caseId)!;
              const to = NEXT_STATUS[c.status]!;
              return (
                <StatusForm
                  c={c}
                  to={to}
                  busy={busy}
                  onSave={(note) =>
                    void run(() => service.updateCaseStatus(c.id, to, note), `Case moved to ${to}`)
                  }
                />
              );
            })()}

          {dialog.kind === 'reassign' && (
            <ReassignForm
              c={db.cases.find((x) => x.id === dialog.caseId)!}
              users={db.users}
              busy={busy}
              onSave={(agentId) =>
                void run(() => service.reassignCase(dialog.caseId, agentId), 'Case reassigned')
              }
            />
          )}

          {dialog.kind === 'recoRefresh' && (
            <RefreshForm
              busy={busy}
              onSave={(mode: AiMode) =>
                void run(async () => {
                  const set = await service.refreshRecommendations(dialog.clientId, mode);
                  setToast(
                    set.source === 'AI'
                      ? 'Recommendations refreshed'
                      : 'AI service failed. Fallback recommendations generated from eligibility rules.',
                  );
                })
              }
            />
          )}

          {(dialog.kind === 'simulate' || dialog.kind === 'outcome') &&
            (() => {
              const item = db.recoSets.flatMap((s) => s.items).find((r) => r.id === dialog.recoId)!;
              const product = db.products.find((p) => p.id === item.productId)!;
              return dialog.kind === 'simulate' ? (
                <SimulateForm
                  item={item}
                  product={product}
                  busy={busy}
                  onSimulate={(terms) =>
                    void run(() => service.simulateOffer(item.id, terms), '', false)
                  }
                />
              ) : (
                <OutcomeForm
                  product={product}
                  busy={busy}
                  onSave={(v) =>
                    void run(
                      () => service.recordOutcome(item.id, v),
                      `Outcome recorded: ${v.type.toLowerCase()}`,
                    )
                  }
                />
              );
            })()}

          {dialog.kind === 'intervention' && (
            <InterventionForm
              profile={db.riskProfiles.find((p) => p.clientId === dialog.clientId)!}
              firstName={
                db.clients.find((c) => c.id === dialog.clientId)?.firstName ?? 'the client'
              }
              busy={busy}
              onSave={(v) =>
                void run(() => service.logIntervention(dialog.clientId, v), 'Intervention logged')
              }
            />
          )}

          {dialog.kind === 'riskStatus' && (
            <RiskStatusForm
              profile={db.riskProfiles.find((p) => p.clientId === dialog.clientId)!}
              busy={busy}
              onSave={(to, note) =>
                void run(
                  () => service.updateRiskStatus(dialog.clientId, to, note),
                  `Risk status moved to ${to}`,
                )
              }
            />
          )}

          {dialog.kind === 'sla' && (
            <SlaForm
              days={sla}
              busy={busy}
              onSave={(days) =>
                void run(async () => {
                  const n = await service.updateSla(days);
                  setToast(
                    n ? `SLA saved. ${n} ${n === 1 ? 'case' : 'cases'} escalated.` : 'SLA saved',
                  );
                })
              }
            />
          )}

          {dialog.kind === 'confirm' && (
            <>
              <div className="modal-body">
                <p>{dialog.text}</p>
              </div>
              <div className="modal-footer">
                <button className="secondary" disabled={busy} onClick={() => setDialog(null)}>
                  Cancel
                </button>
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() => void run(dialog.action, 'Action completed')}
                >
                  {busy ? 'Processing…' : 'Confirm'}
                </button>
              </div>
            </>
          )}

          {dialog.kind === 'help' && <HelpGuide />}
        </Modal>
      )}

      {busy && <div className="loading-line" role="status" aria-label="Processing" />}
      {toast && <Toast message={toast} onDismiss={() => setToast('')} />}
    </div>
  );
}
