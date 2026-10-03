import {
  ArrowUpRight,
  Plus,
  Users,
  Wallet,
  ArrowLeftRight,
  ShieldCheck,
  ChevronRight,
  Clock3,
  TriangleAlert,
  HeartHandshake,
} from 'lucide-react';
import type { ReactNode } from 'react';
import type { User, Client, Account, Transaction, AuditEvent } from '../lib/types';
import { Avatar, Badge, SectionHead, datetime, money, Empty } from '../components/ui';

export default function Overview({
  user,
  clients,
  accounts,
  transactions,
  events,
  onNavigate,
  onClient,
  onCreate,
  escalated,
  onEscalated,
  nextBestActions,
  highRisk,
  onHighRisk,
}: {
  user: User;
  clients: Client[];
  accounts: Account[];
  transactions: Transaction[];
  events: AuditEvent[];
  onNavigate: (v: string) => void;
  onClient: (id: string) => void;
  onCreate: () => void;
  escalated: number;
  onEscalated: () => void;
  nextBestActions?: ReactNode;
  highRisk: number;
  onHighRisk: () => void;
}) {
  const pending = clients.filter((c) => c.verification !== 'Verified');
  const deposit = accounts.reduce((n, a) => n + a.initialDeposit, 0);
  // Group completed transactions by local calendar day and keep the 7 most recent active days.
  const dayKey = (iso: string) => new Date(iso).toLocaleDateString('en-CA');
  const completed = transactions.filter((t) => t.status === 'Completed');
  const days = [...new Set(completed.map((t) => dayKey(t.date)))].sort().slice(-7);
  const sum = (rows: Transaction[], type: Transaction['type']) =>
    rows.filter((t) => t.type === type).reduce((n, t) => n + t.amount, 0);
  const daily = days.map((key) => {
    const rows = completed.filter((t) => dayKey(t.date) === key);
    return {
      label: new Date(`${key}T00:00:00`).toLocaleDateString('en-SG', {
        day: 'numeric',
        month: 'short',
      }),
      deposit: sum(rows, 'Deposit'),
      withdrawal: sum(rows, 'Withdrawal'),
    };
  });

  const windowRows = completed.filter((t) => days.includes(dayKey(t.date)));
  const totalIn = sum(windowRows, 'Deposit');
  const totalOut = sum(windowRows, 'Withdrawal');
  // Round the axis up to four even steps (e.g. 15K, 30K, 45K, 60K) so labels stay readable.
  const peak = Math.max(1, ...daily.map((d) => Math.max(d.deposit, d.withdrawal)));
  const magnitude = 10 ** Math.floor(Math.log10(peak / 4));
  const step =
    [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((m) => m * magnitude * 4 >= peak)! * magnitude;
  const max = step * 4;
  const compact = new Intl.NumberFormat('en-SG', { notation: 'compact', maximumFractionDigits: 1 });

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR RELATIONSHIP WORKSPACE</div>
          <h1>
            Welcome back, {user.firstName}
            <span className="greeting-dot">.</span>
          </h1>
          <p>
            Here’s what’s happening across {user.role === 'Agent' ? 'your portfolio' : 'the bank'}{' '}
            today.
          </p>
        </div>
        <button
          className="primary"
          onClick={user.role === 'Agent' ? onCreate : () => onNavigate('User management')}
        >
          <Plus size={17} />
          {user.role === 'Agent' ? 'Add client' : 'Manage users'}
        </button>
      </div>
      <div className="stat-grid">
        {[
          {
            label: 'Total clients',
            value: String(clients.length),
            note: `${clients.filter((c) => c.verification === 'Verified').length} verified profiles`,
            icon: Users,
            page: 'Clients',
          },
          {
            label: 'Active accounts',
            value: String(accounts.filter((a) => a.status === 'Active').length),
            note: `${money(deposit)} in initial deposits`,
            icon: Wallet,
            page: 'Clients',
          },
          {
            label: 'Transactions',
            value: String(transactions.length),
            note: `${transactions.filter((t) => t.status === 'Completed').length} successfully completed`,
            icon: ArrowLeftRight,
            page: 'Transactions',
          },
          {
            label: 'Pending verification',
            value: String(pending.length),
            note: pending.length ? 'Client profiles need attention' : 'All profiles are up to date',
            icon: ShieldCheck,
            page: 'Clients',
          },
        ].map((s, i) => (
          <button
            key={s.label}
            className={`stat stat-click ${i === 3 ? 'attention-stat' : ''}`}
            onClick={() => onNavigate(s.page)}
          >
            <span className="stat-label">
              {s.label}
              <s.icon size={18} />
            </span>
            <strong>{s.value}</strong>
            <small>
              {i === 3 ? <span className="tiny-dot" /> : <span className="mini-check">↗</span>}
              {s.note}
            </small>
          </button>
        ))}
      </div>
      {escalated > 0 && (
        <button className="case-alert" onClick={onEscalated}>
          <TriangleAlert size={19} />
          <span>
            <strong>
              {escalated} escalated {escalated === 1 ? 'case' : 'cases'}
            </strong>
            <small>
              {user.role === 'Admin'
                ? 'Past the resolution SLA. Review and reassign.'
                : 'Assigned to you and past the resolution SLA.'}
            </small>
          </span>
          <ArrowUpRight size={17} />
        </button>
      )}
      {highRisk > 0 && (
        <button className="case-alert warning" onClick={onHighRisk}>
          <HeartHandshake size={19} />
          <span>
            <strong>
              {highRisk} {highRisk === 1 ? 'client' : 'clients'} at high attrition risk
            </strong>
            <small>
              {user.role === 'Admin'
                ? 'Flagged by the daily analysis across all agents.'
                : 'Contact them and log a retention intervention.'}
            </small>
          </span>
          <ArrowUpRight size={17} />
        </button>
      )}
      <div className="overview-grid">
        <section className="panel chart-panel">
          <SectionHead
            title="Transaction activity"
            detail={
              days.length
                ? `Completed transactions · ${days.length} most recent activity days`
                : 'No completed transactions yet'
            }
            action="View ledger"
            onAction={() => onNavigate('Transactions')}
          />
          <div className="chart-summary">
            <div className="chart-totals">
              <div>
                <span className="muted">Deposits</span>
                <strong>{money(totalIn)}</strong>
              </div>
              <div>
                <span className="muted">Withdrawals</span>
                <strong>{money(totalOut)}</strong>
              </div>
              <div>
                <span className="muted">Net flow</span>
                <strong className={totalIn - totalOut >= 0 ? 'positive' : ''}>
                  {totalIn - totalOut >= 0 ? '+' : '−'}
                  {money(Math.abs(totalIn - totalOut))}
                </strong>
              </div>
            </div>
            <div className="legend">
              <span>
                <i />
                Deposits
              </span>
              <span>
                <i />
                Withdrawals
              </span>
            </div>
          </div>
          <div
            className="bar-chart"
            role="img"
            aria-label={`Completed transactions by day. ${daily.map((d) => `${d.label}: deposits ${money(d.deposit)}, withdrawals ${money(d.withdrawal)}`).join('. ')}`}
          >
            <div className="chart-axis">
              {[1, 0.75, 0.5, 0.25, 0].map((v) => (
                <span key={v}>{compact.format(max * v)}</span>
              ))}
            </div>
            <div className="chart-bars">
              {daily.map((d) => (
                <div className="bar-group" key={d.label}>
                  <div className="bar-pair">
                    <div
                      title={`${d.label} deposits: ${money(d.deposit)}`}
                      style={{ height: `${Math.max(1, (d.deposit / max) * 100)}%` }}
                    />
                    <div
                      title={`${d.label} withdrawals: ${money(d.withdrawal)}`}
                      style={{ height: `${Math.max(1, (d.withdrawal / max) * 100)}%` }}
                    />
                  </div>
                  <span>{d.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className="attention-panel">
          <div className="attention-top">
            <span className="round-icon">
              <ShieldCheck size={22} />
            </span>
            <span className="outline-chip">ACTION CENTER</span>
          </div>
          <h2>
            A little attention. <br />A stronger relationship.
          </h2>
          <p>
            {pending.length} client {pending.length === 1 ? 'profile needs' : 'profiles need'} an
            identity review.
          </p>
          <div className="pending-list">
            {pending.slice(0, 3).map((c) => (
              <button key={c.id} onClick={() => onClient(c.id)}>
                <Avatar small name={`${c.firstName} ${c.lastName}`} />
                <span>
                  <strong>
                    {c.firstName} {c.lastName}
                  </strong>
                  <small>
                    {c.verification === 'Failed'
                      ? 'Verification failed'
                      : c.verification === 'Manual Review'
                        ? 'Manual review'
                        : 'Awaiting verification'}
                  </small>
                </span>
                <ChevronRight size={17} />
              </button>
            ))}
            {!pending.length && <p>All caught up. Every client is verified.</p>}
          </div>
          <button className="attention-link" onClick={() => onNavigate('Clients')}>
            View client directory
            <ArrowUpRight size={17} />
          </button>
        </section>
      </div>
      {nextBestActions}
      <div className="overview-bottom">
        <section className="panel">
          <SectionHead
            title="Your client relationships"
            detail="A familiar face behind every profile"
            action="View all clients"
            onAction={() => onNavigate('Clients')}
          />
          {clients.length ? (
            <div className="table-scroll">
              <table className="stack-table">
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Status</th>
                    <th>Accounts</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {clients.slice(0, 4).map((c) => (
                    <tr
                      key={c.id}
                      className="clickable-row"
                      onClick={(e) => {
                        if (!(e.target as HTMLElement).closest('button')) onClient(c.id);
                      }}
                    >
                      <td className="cell-primary">
                        <button className="client-link" onClick={() => onClient(c.id)}>
                          <Avatar name={`${c.firstName} ${c.lastName}`} />
                          <span>
                            <strong>
                              {c.firstName} {c.lastName}
                            </strong>
                            <small>{c.id}</small>
                          </span>
                        </button>
                      </td>
                      <td data-label="Status">
                        <Badge>{c.verification}</Badge>
                      </td>
                      <td data-label="Accounts">
                        {accounts.filter((a) => a.clientId === c.id).length}
                      </td>
                      <td className="cell-end">
                        <button
                          className="icon-button"
                          aria-label={`Open ${c.firstName}`}
                          onClick={() => onClient(c.id)}
                        >
                          <ArrowUpRight size={17} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty title="Your first relationship starts here" text="Add a client to begin." />
          )}
        </section>
        <section className="panel activity-panel">
          <SectionHead
            title="Recent activity"
            detail={user.role === 'Admin' ? 'Across the workspace' : 'Your latest actions'}
          />
          <div className="activity-list">
            {events.slice(0, 5).map((e) => (
              <div className="activity-item" key={e.id}>
                <span className="activity-icon">
                  <Clock3 size={15} />
                </span>
                <div>
                  <strong>{e.action}</strong>
                  <p>{e.entityId}</p>
                  <small>{datetime(e.at)}</small>
                </div>
              </div>
            ))}
            {!events.length && <p className="muted">Your activity will appear here.</p>}
          </div>
        </section>
      </div>
    </>
  );
}
