import { useState } from 'react';
import {
  AlarmClock,
  ArrowDownLeft,
  ArrowLeft,
  ArrowRightLeft,
  ArrowUpRight,
  Check,
  CircleDot,
  Flag,
  FolderOpen,
  Plus,
  Search,
  Settings2,
  TriangleAlert,
  UserRoundCog,
} from 'lucide-react';
import type { Case, CaseFilters, Client, Transaction, User } from '../../lib/types';
import { Badge, Empty, SectionHead, date, datetime, money, usePaged } from '../../components/ui';
import {
  CASE_CATEGORIES,
  CASE_STATUSES,
  NEXT_STATUS,
  caseAgeMs,
  duration,
  isEscalated,
  slaDueAt,
} from '../../lib/cases';

const fullName = (p?: { firstName: string; lastName: string }) =>
  p ? `${p.firstName} ${p.lastName}` : undefined;

function CaseStatusBadges({ c }: { c: Case }) {
  return (
    <span className="badge-stack">
      <Badge>{c.status}</Badge>
      {isEscalated(c) && <Badge>Escalated</Badge>}
    </span>
  );
}

export function CaseTable({
  rows,
  clients,
  users,
  sla,
  onOpen,
}: {
  rows: Case[];
  clients: Client[];
  users: User[];
  sla: number;
  onOpen: (id: string) => void;
}) {
  const { rows: pageRows, pager } = usePaged(rows);

  return rows.length ? (
    <div className="table-scroll">
      <table className="stack-table">
        <thead>
          <tr>
            <th>Case</th>
            <th>Client</th>
            <th>Status</th>
            <th>Assigned agent</th>
            <th>Age</th>
            <th>SLA due</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {pageRows.map((c) => (
            <tr
              key={c.id}
              className="clickable-row"
              onClick={(e) => {
                if (!(e.target as HTMLElement).closest('button')) onOpen(c.id);
              }}
            >
              <td className="cell-primary">
                <div className="cell-flex">
                  <span className={`case-icon ${isEscalated(c) ? 'escalated' : ''}`}>
                    {c.category === 'Transaction dispute' ? (
                      <ArrowRightLeft size={16} />
                    ) : (
                      <Flag size={16} />
                    )}
                  </span>
                  <div>
                    <strong>{c.category}</strong>
                    <small>{c.id}</small>
                  </div>
                </div>
              </td>
              <td className="cell-wide" data-label="Client">
                <strong>
                  {fullName(clients.find((x) => x.id === c.clientId)) ?? 'Removed client'}
                </strong>
                <small>{c.clientId}</small>
              </td>
              <td data-label="Status">
                <CaseStatusBadges c={c} />
              </td>
              <td data-label="Assigned agent">
                {fullName(users.find((u) => u.id === c.agentId)) ?? 'Unassigned'}
                <small>{c.agentId}</small>
              </td>
              <td data-label="Age">{duration(caseAgeMs(c))}</td>
              <td data-label="SLA due">
                {c.status === 'Resolved' ? (
                  <span className="muted">Resolved {date(c.resolvedAt!)}</span>
                ) : (
                  datetime(slaDueAt(c.slaStartedAt, sla))
                )}
              </td>
              <td className="cell-end">
                <button
                  className="icon-button"
                  aria-label={`Open case ${c.id}`}
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
    <Empty
      title="No cases found"
      text="Raise a case from a client profile or adjust your filters."
    />
  );
}

export function CaseList({
  rows,
  clients,
  users,
  filters,
  admin,
  sla,
  busy,
  onSearch,
  onOpen,
  onRaise,
  onSla,
}: {
  rows: Case[];
  clients: Client[];
  users: User[];
  filters: CaseFilters;
  admin: boolean;
  sla: number;
  busy: boolean;
  onSearch: (f: CaseFilters) => void;
  onOpen: (id: string) => void;
  onRaise: () => void;
  onSla: () => void;
}) {
  const [tx, setTx] = useState(filters.transactionId ?? '');
  const set = (patch: CaseFilters) => onSearch({ ...filters, ...patch });
  const resolved = rows.filter((c) => c.resolvedAt);
  const avgResolution = resolved.length
    ? duration(resolved.reduce((n, c) => n + caseAgeMs(c), 0) / resolved.length)
    : '—';
  const agents = users.filter((u) => u.role === 'Agent');
  const filtered = Object.values(filters).some(Boolean);

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">SERVICE QUALITY</div>
          <h1>Complaints &amp; disputes</h1>
          <p>Every concern followed through, from report to resolution.</p>
        </div>
        <div className="actions">
          {admin ? (
            <button className="secondary" onClick={onSla}>
              <Settings2 size={16} />
              SLA · {sla} business {sla === 1 ? 'day' : 'days'}
            </button>
          ) : (
            <button className="primary" onClick={onRaise}>
              <Plus size={17} />
              Raise case
            </button>
          )}
        </div>
      </div>
      <div className="stat-grid">
        <div className="stat">
          <span className="stat-label">
            Case volume <FolderOpen size={18} />
          </span>
          <strong>{rows.length}</strong>
          <small>{filtered ? 'Matching current filters' : 'All visible cases'}</small>
        </div>
        <div className="stat">
          <span className="stat-label">
            In progress <CircleDot size={18} />
          </span>
          <strong>{rows.filter((c) => c.status !== 'Resolved').length}</strong>
          <small>Open or investigating</small>
        </div>
        <div className={`stat ${rows.some(isEscalated) ? 'attention-stat' : ''}`}>
          <span className="stat-label">
            Escalated <TriangleAlert size={18} />
          </span>
          <strong>{rows.filter(isEscalated).length}</strong>
          <small>{admin ? 'Past SLA, awaiting reassignment' : 'Past the SLA'}</small>
        </div>
        <div className="stat">
          <span className="stat-label">
            Avg. resolution time <AlarmClock size={18} />
          </span>
          <strong>{avgResolution}</strong>
          <small>Across {resolved.length} resolved cases</small>
        </div>
      </div>
      <section className="panel">
        <SectionHead
          title="Case register"
          detail={`${rows.length} cases · each search is recorded in the audit log`}
        />
        <form
          className="filters"
          onSubmit={(e) => {
            e.preventDefault();
            set({ transactionId: tx.trim() || undefined });
          }}
        >
          <label className="search">
            <Search size={17} />
            <input
              aria-label="Transaction ID"
              placeholder="Transaction ID, then Enter…"
              value={tx}
              onChange={(e) => setTx(e.target.value)}
            />
          </label>
          <select
            aria-label="Case status"
            disabled={busy}
            value={filters.status ?? ''}
            onChange={(e) =>
              set({ status: (e.target.value || undefined) as CaseFilters['status'] })
            }
          >
            <option value="">All statuses</option>
            {[...CASE_STATUSES, 'Escalated'].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <select
            aria-label="Case category"
            disabled={busy}
            value={filters.category ?? ''}
            onChange={(e) =>
              set({ category: (e.target.value || undefined) as CaseFilters['category'] })
            }
          >
            <option value="">All categories</option>
            {CASE_CATEGORIES.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <select
            aria-label="Client"
            disabled={busy}
            value={filters.clientId ?? ''}
            onChange={(e) => set({ clientId: e.target.value || undefined })}
          >
            <option value="">All clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.firstName} {c.lastName}
              </option>
            ))}
          </select>
          {admin && (
            <select
              aria-label="Assigned agent"
              disabled={busy}
              value={filters.agentId ?? ''}
              onChange={(e) => set({ agentId: e.target.value || undefined })}
            >
              <option value="">All agents</option>
              {agents.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.firstName} {u.lastName}
                </option>
              ))}
            </select>
          )}
          {filtered && (
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setTx('');
                onSearch({});
              }}
            >
              Clear filters
            </button>
          )}
        </form>
        <CaseTable rows={rows} clients={clients} users={users} sla={sla} onOpen={onOpen} />
      </section>
    </>
  );
}

function eventTitle(e: Case['history'][number], name: (id?: string) => string) {
  switch (e.type) {
    case 'CASE_CREATED':
      return 'Case raised';
    case 'STATUS_UPDATED':
      return `${e.from} → ${e.to}`;
    case 'ESCALATED':
      return 'Escalated to administrators';
    case 'REASSIGNED':
      return `Reassigned from ${name(e.from)} to ${name(e.to)}`;
  }
}

export function CaseDetail({
  c,
  client,
  transaction,
  users,
  sla,
  canUpdate,
  canReassign,
  onBack,
  onStatus,
  onReassign,
  onClient,
}: {
  c: Case;
  client?: Client;
  transaction?: Transaction;
  users: User[];
  sla: number;
  canUpdate: boolean;
  canReassign: boolean;
  onBack: () => void;
  onStatus: () => void;
  onReassign: () => void;
  onClient?: () => void;
}) {
  const name = (id?: string) => fullName(users.find((u) => u.id === id)) ?? id ?? 'System';
  const reached = (s: string) =>
    s === 'Open'
      ? c.createdAt
      : c.history.find((h) => h.to === s && h.type === 'STATUS_UPDATED')?.at;
  const current = CASE_STATUSES.indexOf(c.status);
  const next = NEXT_STATUS[c.status];

  return (
    <>
      <button className="back-link" onClick={onBack}>
        <ArrowLeft size={16} />
        Back to cases
      </button>
      <div className="profile-header">
        <div>
          <div className="eyebrow">{c.id}</div>
          <h1>{c.category}</h1>
          <p className="muted">
            {fullName(client) ?? 'Removed client'} <span className="separator">·</span> Raised{' '}
            {datetime(c.createdAt)}
          </p>
        </div>
        <div className="actions">
          <CaseStatusBadges c={c} />
          {canReassign && (
            <button className="secondary" onClick={onReassign}>
              <UserRoundCog size={16} />
              Reassign
            </button>
          )}
          {canUpdate && next && (
            <button className="primary" onClick={onStatus}>
              {next === 'Resolved' ? <Check size={16} /> : <ArrowUpRight size={16} />}
              {next === 'Resolved' ? 'Mark resolved' : 'Start investigating'}
            </button>
          )}
        </div>
      </div>

      <section className="panel case-progress" aria-label="Case progress">
        {CASE_STATUSES.map((s, i) => {
          const at = reached(s);
          return (
            <div
              key={s}
              className={`case-step ${i < current || c.status === 'Resolved' ? 'done' : i === current ? 'current' : ''}`}
            >
              <span className="case-step-dot">
                {i < current || c.status === 'Resolved' ? <Check size={15} /> : i + 1}
              </span>
              <strong>{s}</strong>
              <small>{at ? datetime(at) : i === current + 1 ? 'Next step' : 'Not started'}</small>
            </div>
          );
        })}
      </section>

      {isEscalated(c) && (
        <div className="case-alert static" role="status">
          <TriangleAlert size={19} />
          <span>
            <strong>SLA breached</strong>
            <small>
              Open longer than {sla} business {sla === 1 ? 'day' : 'days'}. Administrators were
              notified and can reassign this case.
            </small>
          </span>
        </div>
      )}

      <div className="profile-grid">
        <div className="stack">
          <section className="panel">
            <SectionHead title="Case summary" />
            <dl className="detail-grid padded">
              {[
                ['Case ID', c.id],
                ['Category', c.category],
                ['Client', `${fullName(client) ?? 'Removed client'} · ${c.clientId}`],
                ['Assigned agent', `${name(c.agentId)} · ${c.agentId}`],
                ['Created', datetime(c.createdAt)],
                [
                  c.status === 'Resolved' ? 'Resolved' : 'SLA due',
                  datetime(c.resolvedAt ?? slaDueAt(c.slaStartedAt, sla)),
                ],
                [c.status === 'Resolved' ? 'Resolution time' : 'Age', duration(caseAgeMs(c))],
                ['Status', c.status],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            {onClient && (
              <div className="panel-foot">
                <button className="text-button" onClick={onClient}>
                  Open client profile
                  <ArrowUpRight size={16} />
                </button>
              </div>
            )}
          </section>
          <section className="panel">
            <SectionHead title="Report" detail="As described by the client" />
            <div className="padded case-report">
              <p>{c.description}</p>
              {c.transactionId && (
                <div className="case-transaction">
                  <span className="cell-flex">
                    <span className={`transaction-icon ${transaction?.type.toLowerCase() ?? ''}`}>
                      {transaction?.type === 'Deposit' ? (
                        <ArrowDownLeft size={17} />
                      ) : (
                        <ArrowUpRight size={17} />
                      )}
                    </span>
                    <span>
                      <strong>{transaction?.type ?? 'Linked transaction'}</strong>
                      <small>
                        {c.transactionId}
                        {transaction && ` · ${transaction.accountId}`}
                      </small>
                    </span>
                  </span>
                  {transaction ? (
                    <>
                      <span className="muted">{datetime(transaction.date)}</span>
                      <Badge>{transaction.status}</Badge>
                      <strong className="amount">{money(transaction.amount)}</strong>
                    </>
                  ) : (
                    <span className="muted">Transaction record no longer available</span>
                  )}
                </div>
              )}
            </div>
          </section>
        </div>
        <section className="panel activity-panel">
          <SectionHead title="Events" detail="Status changes, notes and escalations" />
          <div className="activity-list">
            {[...c.history].reverse().map((e, i) => (
              <div className="activity-item" key={i}>
                <span className={`activity-icon ${e.type === 'ESCALATED' ? 'alert' : ''}`}>
                  {e.type === 'ESCALATED' ? <TriangleAlert size={14} /> : <Flag size={14} />}
                </span>
                <div>
                  <strong>{eventTitle(e, name)}</strong>
                  {e.note && <p>{e.note}</p>}
                  {e.reason && <p>{e.reason}</p>}
                  <small>
                    {datetime(e.at)} · {e.actorId ? name(e.actorId) : 'Automated SLA check'}
                  </small>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
