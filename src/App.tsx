import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { DemoService } from './lib/service';
import type { User, Client } from './lib/types';
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

const service = new DemoService(localStorage);

type Dialog =
  | { kind: 'client'; client?: Client }
  | { kind: 'account'; clientId: string }
  | { kind: 'verify'; clientId: string }
  | { kind: 'import' }
  | { kind: 'user'; user?: User }
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

  useEffect(() => {
    if (toast) {
      const id = setTimeout(() => setToast(''), 4500);
      return () => clearTimeout(id);
    }
  }, [toast]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [page, clientId]);

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

  const navigate = (p: string) => {
    setPage(p);
    setClientId(null);
    setMenu(false);
    setError('');
  };

  const openClient = (id: string) => {
    void run(
      async () => {
        await service.viewClient(id);
        setClientId(id);
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

  const pageTitle = client
    ? `${client.firstName} ${client.lastName}`
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
            />
          )}

          {page === 'Clients' &&
            (client ? (
              <ClientDetail
                key={client.id}
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
            dialog.kind === 'client' || dialog.kind === 'account' || dialog.kind === 'user'
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
