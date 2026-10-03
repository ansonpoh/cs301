import { useState, type ReactNode } from 'react';
import {
  Plus,
  ArrowUpRight,
  ArrowLeft,
  Pencil,
  ShieldCheck,
  Trash2,
  CreditCard,
  Users,
  MessageSquareWarning,
} from 'lucide-react';
import type { Case, Client, Account, Transaction, User } from '../../lib/types';
import {
  Avatar,
  Badge,
  Empty,
  SearchBox,
  SectionHead,
  date,
  money,
  usePaged,
} from '../../components/ui';
import { TransactionTable } from '../transactions/Transactions';
import { CaseTable } from '../cases/Cases';

export function ClientList({
  clients,
  accounts,
  users,
  onOpen,
  onCreate,
  canEdit,
}: {
  clients: Client[];
  accounts: Account[];
  users: User[];
  onOpen: (id: string) => void;
  onCreate: () => void;
  canEdit: boolean;
}) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('All statuses');

  const rows = clients.filter(
    (c) =>
      `${c.firstName} ${c.lastName} ${c.id} ${c.email}`.toLowerCase().includes(q.toLowerCase()) &&
      (status === 'All statuses' || c.verification === status),
  );

  const { rows: pageRows, pager } = usePaged(rows);

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">RELATIONSHIP MANAGEMENT</div>
          <h1>{canEdit ? 'My clients' : 'Client directory'}</h1>
          <p>Meaningful relationships start with a complete picture.</p>
        </div>
        {canEdit && (
          <button className="primary" onClick={onCreate}>
            <Plus size={18} />
            Add client
          </button>
        )}
      </div>
      <div className="client-summary">
        <span>
          <Users size={20} />
          <strong>{clients.length}</strong> total clients
        </span>
        <span>
          <i className="dot" />
          <strong>{clients.filter((c) => c.verification === 'Verified').length}</strong> verified
        </span>
        <span>
          <i className="dot amber" />
          <strong>{clients.filter((c) => c.verification === 'Pending').length}</strong> awaiting
          verification
        </span>
      </div>
      <section className="panel">
        <div className="filters">
          <SearchBox value={q} onChange={setQ} placeholder="Search name, email, or client ID…" />
          <select
            aria-label="Verification status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {['All statuses', 'Verified', 'Pending', 'Rejected'].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <span className="filter-count">{rows.length} clients</span>
        </div>
        {rows.length ? (
          <div className="table-scroll">
            <table className="stack-table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Contact</th>
                  <th>Verification</th>
                  <th>{canEdit ? 'Accounts' : 'Relationship agent'}</th>
                  <th>Client since</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((c) => (
                  <tr
                    key={c.id}
                    className="clickable-row"
                    onClick={(e) => {
                      // Buttons in the row open the profile themselves; avoid a second open.
                      if (!(e.target as HTMLElement).closest('button')) onOpen(c.id);
                    }}
                  >
                    <td className="cell-primary">
                      <button className="client-link" onClick={() => onOpen(c.id)}>
                        <Avatar name={`${c.firstName} ${c.lastName}`} />
                        <span>
                          <strong>
                            {c.firstName} {c.lastName}
                          </strong>
                          <small>{c.id}</small>
                        </span>
                      </button>
                    </td>
                    <td className="cell-wide" data-label="Contact">
                      {c.email}
                      <small>{c.phone}</small>
                    </td>
                    <td data-label="Verification">
                      <Badge>{c.verification}</Badge>
                    </td>
                    <td data-label={canEdit ? 'Accounts' : 'Relationship agent'}>
                      {canEdit ? (
                        (() => {
                          const n = accounts.filter((a) => a.clientId === c.id).length;
                          return `${n} ${n === 1 ? 'account' : 'accounts'}`;
                        })()
                      ) : (
                        <AgentName user={users.find((u) => u.id === c.agentId)} id={c.agentId} />
                      )}
                    </td>
                    <td data-label="Client since">{date(c.createdAt)}</td>
                    <td className="cell-end">
                      <button
                        className="icon-button"
                        aria-label={`View ${c.firstName} ${c.lastName}`}
                        onClick={() => onOpen(c.id)}
                      >
                        <ArrowUpRight size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {pager}
          </div>
        ) : (
          <Empty title="No clients found" text="Add a client or adjust your search." />
        )}
      </section>
    </>
  );
}

function AgentName({ user, id }: { user?: User; id: string }) {
  return (
    <>
      {user ? `${user.firstName} ${user.lastName}` : 'Unassigned'}
      <small>{id}</small>
    </>
  );
}

export function ClientDetail({
  client: c,
  agent,
  accounts,
  transactions,
  canEdit,
  onBack,
  onEdit,
  onVerify,
  onDelete,
  onAccount,
  onDeleteAccount,
  cases,
  caseCount,
  users,
  sla,
  onCasesTab,
  onRaiseCase,
  onOpenCase,
  initialTab = 'Overview',
  recommendations,
  onRecoTab,
  riskFlag,
}: {
  client: Client;
  agent?: User;
  accounts: Account[];
  transactions: Transaction[];
  canEdit: boolean;
  onBack: () => void;
  onEdit: () => void;
  onVerify: () => void;
  onDelete: () => void;
  onAccount: () => void;
  onDeleteAccount: (id: string) => void;
  cases: Case[];
  caseCount: number;
  users: User[];
  sla: number;
  onCasesTab: () => void;
  onRaiseCase: () => void;
  onOpenCase: (id: string) => void;
  initialTab?: string;
  recommendations?: ReactNode;
  onRecoTab: () => void;
  riskFlag?: ReactNode;
}) {
  const [tab, setTab] = useState(initialTab);
  const tabs = ['Overview', 'Accounts', 'Transactions', 'Cases'];
  if (recommendations) tabs.splice(1, 0, 'Recommendations');

  return (
    <>
      <button className="back-link" onClick={onBack}>
        <ArrowLeft size={16} />
        Back to clients
      </button>
      <div className="profile-header">
        <div className="profile-identity">
          <Avatar name={`${c.firstName} ${c.lastName}`} />
          <div>
            <div className="eyebrow">{c.id}</div>
            <h1>
              {c.firstName} {c.lastName}
            </h1>
            <p>
              Client since {date(c.createdAt)} <span className="separator">·</span> Singapore
            </p>
          </div>
        </div>
        <div className="actions">
          <Badge>{c.verification}</Badge>
          {riskFlag}
          {canEdit && (
            <button className="secondary" onClick={onRaiseCase}>
              <MessageSquareWarning size={15} />
              Raise complaint/dispute
            </button>
          )}
          {canEdit && (
            <button className="secondary" onClick={onEdit}>
              <Pencil size={15} />
              Edit profile
            </button>
          )}
        </div>
      </div>
      <div className="tabs">
        {tabs.map((t) => (
          <button
            key={t}
            className={tab === t ? 'active' : ''}
            onClick={() => {
              setTab(t);
              // Loading the client's cases is a search, so it is logged as CASE_VIEWED.
              if (t === 'Cases' && tab !== 'Cases') onCasesTab();
              // Opening recommendations checks the cache, regenerates if stale, and logs the view.
              if (t === 'Recommendations' && tab !== t) onRecoTab();
            }}
          >
            {t}
            {t === 'Accounts' && <span>{accounts.length}</span>}
            {t === 'Cases' && <span>{caseCount}</span>}
          </button>
        ))}
      </div>
      {tab === 'Overview' ? (
        <div className="profile-grid">
          <section className="panel">
            <SectionHead
              title="Personal information"
              detail="The details behind the relationship"
            />
            <dl className="detail-grid padded">
              {[
                ['First name', c.firstName],
                ['Last name', c.lastName],
                ['Date of birth', date(c.dob)],
                ['Gender', c.gender],
                ['Email address', c.email],
                ['Phone number', c.phone],
                ['Address', c.address],
                ['City / state', `${c.city} / ${c.state}`],
                ['Country', c.country],
                ['Postal code', c.postal],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </section>
          <div className="stack">
            <section className="verification-card">
              <ShieldCheck size={30} />
              <h2>Identity verification</h2>
              <p>
                {c.verification === 'Verified'
                  ? 'This client’s identity has been verified in the demo.'
                  : 'Complete an identity check to keep the client profile up to date.'}
              </p>
              <Badge>{c.verification}</Badge>
              {canEdit && (
                <button className="primary" onClick={onVerify}>
                  {c.verification === 'Verified' ? 'Review verification' : 'Verify identity'}
                  <ArrowUpRight size={16} />
                </button>
              )}
            </section>
            <section className="panel contact-card relationship-card">
              <h3>Relationship</h3>
              <dl>
                <div>
                  <dt>Relationship agent</dt>
                  <dd>
                    <AgentName user={agent} id={c.agentId} />
                  </dd>
                </div>
                <div>
                  <dt>Client ID</dt>
                  <dd>{c.id}</dd>
                </div>
                <div>
                  <dt>Bank accounts</dt>
                  <dd>{accounts.length}</dd>
                </div>
                <div>
                  <dt>Initial deposits</dt>
                  <dd>{money(accounts.reduce((n, a) => n + a.initialDeposit, 0))}</dd>
                </div>
                <div>
                  <dt>Client since</dt>
                  <dd>{date(c.createdAt)}</dd>
                </div>
              </dl>
            </section>
            {canEdit && (
              <button className="danger subtle" onClick={onDelete}>
                <Trash2 size={15} />
                Delete client profile
              </button>
            )}
          </div>
        </div>
      ) : tab === 'Accounts' ? (
        <section className="panel">
          <SectionHead
            title="Bank accounts"
            detail={`${accounts.length} linked accounts · SGD`}
            action={canEdit ? 'Open account' : undefined}
            onAction={onAccount}
          />
          {accounts.length ? (
            <div className="account-grid">
              {accounts.map((a) => (
                <article className="account-card" key={a.id}>
                  <div className="account-card-top">
                    <CreditCard size={24} />
                    <Badge>{a.status}</Badge>
                  </div>
                  <h3>{a.type} account</h3>
                  <p>{a.id}</p>
                  <small>INITIAL DEPOSIT</small>
                  <strong className="account-amount">{money(a.initialDeposit)}</strong>
                  <div className="account-meta">
                    <span>Opened {date(a.openingDate)}</span>
                    <span>Branch {a.branchId}</span>
                  </div>
                  {canEdit && (
                    <button className="text-button danger" onClick={() => onDeleteAccount(a.id)}>
                      <Trash2 size={14} />
                      Delete account
                    </button>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <Empty title="No accounts yet" text="Open the first bank account for this client." />
          )}
        </section>
      ) : tab === 'Recommendations' ? (
        recommendations
      ) : tab === 'Cases' ? (
        <section className="panel">
          <SectionHead
            title="Complaints & disputes"
            detail="Cases raised on behalf of this client"
            action={canEdit ? 'Raise case' : undefined}
            onAction={onRaiseCase}
          />
          <CaseTable
            rows={cases.filter((x) => x.clientId === c.id)}
            clients={[c]}
            users={users}
            sla={sla}
            onOpen={onOpenCase}
          />
        </section>
      ) : (
        <section className="panel">
          <SectionHead
            title="Transaction history"
            detail="Deposits and withdrawals for this client"
          />
          <TransactionTable rows={transactions} clients={[c]} />
        </section>
      )}
    </>
  );
}
