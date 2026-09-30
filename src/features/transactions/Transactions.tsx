import { useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Download,
  CheckCircle2,
  Clock3,
  AlertCircle,
} from 'lucide-react';
import type { Client, ImportRun, Transaction } from '../../lib/types';
import {
  Badge,
  Empty,
  SearchBox,
  datetime,
  money,
  SectionHead,
  usePaged,
} from '../../components/ui';

export function TransactionTable({ rows, clients }: { rows: Transaction[]; clients: Client[] }) {
  const { rows: pageRows, pager } = usePaged(rows);

  return rows.length ? (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Transaction</th>
            <th>Client / account</th>
            <th>Date</th>
            <th>Status</th>
            <th className="align-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {pageRows.map((t) => {
            const c = clients.find((c) => c.id === t.clientId);
            return (
              <tr key={t.id}>
                <td>
                  <div className="cell-flex">
                    <span className={`transaction-icon ${t.type.toLowerCase()}`}>
                      {t.type === 'Deposit' ? (
                        <ArrowDownLeft size={17} />
                      ) : (
                        <ArrowUpRight size={17} />
                      )}
                    </span>
                    <div>
                      <strong>{t.type}</strong>
                      <small>{t.id}</small>
                    </div>
                  </div>
                </td>
                <td>
                  <strong>{c ? `${c.firstName} ${c.lastName}` : 'Removed client'}</strong>
                  <small>{t.accountId}</small>
                </td>
                <td>{datetime(t.date)}</td>
                <td>
                  <Badge>{t.status}</Badge>
                </td>
                <td className={`align-right amount ${t.type === 'Deposit' ? 'positive' : ''}`}>
                  {t.type === 'Deposit' ? '+' : '−'}
                  {money(t.amount)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {pager}
    </div>
  ) : (
    <Empty title="No transactions" text="Import demo transactions or adjust your filters." />
  );
}

export default function Transactions({
  rows,
  clients,
  imports,
  canImport,
  onImport,
}: {
  rows: Transaction[];
  clients: Client[];
  imports: ImportRun[];
  canImport: boolean;
  onImport: () => void;
}) {
  const [q, setQ] = useState('');
  const [type, setType] = useState('All types');
  const [status, setStatus] = useState('All statuses');
  const [client, setClient] = useState('All clients');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const visible = rows.filter((t) => {
    const c = clients.find((c) => c.id === t.clientId);
    return (
      `${t.id} ${t.accountId} ${c?.firstName} ${c?.lastName}`
        .toLowerCase()
        .includes(q.toLowerCase()) &&
      (type === 'All types' || t.type === type) &&
      (status === 'All statuses' || t.status === status) &&
      (client === 'All clients' || t.clientId === client) &&
      (!from || t.date.slice(0, 10) >= from) &&
      (!to || t.date.slice(0, 10) <= to)
    );
  });

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">ACCOUNT ACTIVITY</div>
          <h1>Transactions</h1>
          <p>A clear view of every deposit and withdrawal.</p>
        </div>
        {canImport && (
          <button className="primary" onClick={onImport}>
            <Download size={17} />
            Import transactions
          </button>
        )}
      </div>
      <div className="stat-grid three">
        <div className="stat">
          <span className="stat-label">
            Completed deposits <ArrowDownLeft size={18} />
          </span>
          <strong>
            {money(
              rows
                .filter((t) => t.type === 'Deposit' && t.status === 'Completed')
                .reduce((n, t) => n + t.amount, 0),
            )}
          </strong>
          <small>Across visible accounts</small>
        </div>
        <div className="stat">
          <span className="stat-label">
            Completed withdrawals <ArrowUpRight size={18} />
          </span>
          <strong>
            {money(
              rows
                .filter((t) => t.type === 'Withdrawal' && t.status === 'Completed')
                .reduce((n, t) => n + t.amount, 0),
            )}
          </strong>
          <small>Across visible accounts</small>
        </div>
        <div className="stat">
          <span className="stat-label">
            Pending transactions <Clock3 size={18} />
          </span>
          <strong>{rows.filter((t) => t.status === 'Pending').length}</strong>
          <small>Awaiting completion</small>
        </div>
      </div>
      <section className="panel">
        <SectionHead title="Transaction ledger" detail={`${visible.length} records · SGD`} />
        <div className="filters">
          <SearchBox value={q} onChange={setQ} placeholder="Search transaction or client…" />
          <select
            aria-label="Transaction type"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            {['All types', 'Deposit', 'Withdrawal'].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <select
            aria-label="Transaction status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {['All statuses', 'Completed', 'Pending', 'Failed'].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <select aria-label="Client" value={client} onChange={(e) => setClient(e.target.value)}>
            <option>All clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.firstName} {c.lastName}
              </option>
            ))}
          </select>
          <label className="date-filter">
            From
            <input
              aria-label="From date"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label className="date-filter">
            To
            <input
              aria-label="To date"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
          {(q ||
            from ||
            to ||
            type !== 'All types' ||
            status !== 'All statuses' ||
            client !== 'All clients') && (
            <button
              className="text-button"
              onClick={() => {
                setQ('');
                setFrom('');
                setTo('');
                setType('All types');
                setStatus('All statuses');
                setClient('All clients');
              }}
            >
              Clear filters
            </button>
          )}
        </div>
        <TransactionTable rows={visible} clients={clients} />
      </section>
      <section className="panel import-history">
        <SectionHead title="Import history" detail="Simulated core banking connection" />
        {imports.length ? (
          imports.map((run) => (
            <details className="import-run" key={run.id}>
              <summary>
                <span className="cell-flex">
                  {run.status === 'Successful' ? (
                    <CheckCircle2 size={19} className="positive" />
                  ) : (
                    <AlertCircle size={19} />
                  )}
                  <span>
                    <strong>{run.id}</strong>
                    <small>{datetime(run.startedAt)}</small>
                  </span>
                </span>
                <span>
                  {run.accepted} accepted · {run.rejected} rejected
                </span>
                <Badge>{run.status}</Badge>
              </summary>
              <div className="import-detail">
                {run.source && <p>Source file: {run.source}</p>}
                <p>
                  Started: {run.startedAt} · Ended: {run.endedAt}
                </p>
                <p>
                  {run.processed} processed / {run.accepted} accepted / {run.rejected} rejected
                </p>
                {run.errors.length ? (
                  run.errors.map((e, i) => (
                    <p key={i} className="error-text">
                      {e}
                    </p>
                  ))
                ) : (
                  <p>All records processed successfully.</p>
                )}
              </div>
            </details>
          ))
        ) : (
          <Empty title="No imports yet" text="Start an import to populate this history." />
        )}
      </section>
    </>
  );
}
