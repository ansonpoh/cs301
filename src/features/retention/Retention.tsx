import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  ClipboardPen,
  Flag,
  HandHeart,
  RefreshCw,
  ShieldAlert,
  TrendingDown,
  TriangleAlert,
  UserRoundX,
  Waypoints,
} from 'lucide-react';
import type {
  Client,
  Intervention,
  RiskEvent,
  RiskFilters,
  RiskLevel,
  RiskProfile,
  User,
} from '../../lib/types';
import {
  Avatar,
  Badge,
  Empty,
  SectionHead,
  date,
  datetime,
  money,
  usePaged,
} from '../../components/ui';
import {
  REFLAG_AFTER_DAYS,
  RISK_LEVELS,
  RISK_STATUSES,
  isOpenRisk,
  retentionRate,
  type RiskAnalysis,
} from '../../lib/retention';

const fullName = (p?: { firstName: string; lastName: string }) =>
  p ? `${p.firstName} ${p.lastName}` : undefined;

export const RiskBadge = ({ level }: { level: RiskLevel }) => <Badge>{`${level} risk`}</Badge>;

export function RiskList({
  rows,
  profiles,
  clients,
  users,
  interventions,
  filters,
  admin,
  busy,
  job,
  onSearch,
  onOpen,
  onRunJob,
}: {
  rows: RiskProfile[];
  // Every profile this user may see, for the summary figures.
  profiles: RiskProfile[];
  clients: Client[];
  users: User[];
  interventions: Intervention[];
  filters: RiskFilters;
  admin: boolean;
  busy: boolean;
  job: { lastRunAt?: string; asOf?: string };
  onSearch: (f: RiskFilters) => void;
  onOpen: (clientId: string) => void;
  onRunJob: () => void;
}) {
  const { rows: pageRows, pager } = usePaged(rows);
  const set = (patch: RiskFilters) => onSearch({ ...filters, ...patch });
  const open = profiles.filter(isOpenRisk);
  const rate = retentionRate(profiles);
  const churned = profiles.filter((p) => p.status === 'Churned').length;
  const agents = users.filter((u) => u.role === 'Agent');
  const lastIntervention = (clientId: string) => interventions.find((i) => i.clientId === clientId);
  const agentOf = (clientId: string) => clients.find((c) => c.id === clientId)?.agentId;
  const filtered = !!(filters.level || filters.agentId || (filters.status ?? 'Open') !== 'Open');

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">RETENTION</div>
          <h1>Attrition risk</h1>
          <p>
            Clients whose activity suggests they may leave, flagged daily from core-banking data
            {job.asOf && ` as of ${date(job.asOf)}`}.
          </p>
        </div>
        {admin && (
          <div className="actions">
            <button className="secondary" disabled={busy} onClick={onRunJob}>
              <RefreshCw size={16} />
              Run analysis now
            </button>
          </div>
        )}
      </div>
      <div className="stat-grid">
        <div className={`stat ${open.some((p) => p.level === 'High') ? 'attention-stat' : ''}`}>
          <span className="stat-label">
            High risk <ShieldAlert size={18} />
          </span>
          <strong>{open.filter((p) => p.level === 'High').length}</strong>
          <small>Open flags needing contact</small>
        </div>
        <div className="stat">
          <span className="stat-label">
            Under review <ClipboardPen size={18} />
          </span>
          <strong>{open.filter((p) => p.status === 'Under Review').length}</strong>
          <small>Intervention in progress</small>
        </div>
        <div className="stat">
          <span className="stat-label">
            Mitigated <HandHeart size={18} />
          </span>
          <strong>{profiles.filter((p) => p.status === 'Mitigated').length}</strong>
          <small>Retained after intervention</small>
        </div>
        <div className="stat">
          <span className="stat-label">
            Retention rate <Waypoints size={18} />
          </span>
          <strong>{rate === null ? '—' : `${rate}%`}</strong>
          <small>
            {churned} churned of {profiles.length - open.length} closed
          </small>
        </div>
      </div>

      <section className="panel">
        <SectionHead
          title={admin ? 'Risk register' : 'My at-risk clients'}
          detail={`${rows.length} clients · highest risk first · each view is recorded in the audit log`}
        />
        <div className="filters">
          <select
            aria-label="Risk status"
            disabled={busy}
            value={filters.status ?? 'Open'}
            onChange={(e) => set({ status: e.target.value as RiskFilters['status'] })}
          >
            <option value="Open">Open flags</option>
            {RISK_STATUSES.map((x) => (
              <option key={x}>{x}</option>
            ))}
            <option value="All">All statuses</option>
          </select>
          <select
            aria-label="Risk level"
            disabled={busy}
            value={filters.level ?? ''}
            onChange={(e) => set({ level: (e.target.value || undefined) as RiskLevel })}
          >
            <option value="">All risk levels</option>
            {RISK_LEVELS.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          {admin && (
            <select
              aria-label="Agent"
              disabled={busy}
              value={filters.agentId ?? ''}
              onChange={(e) => set({ agentId: e.target.value || undefined })}
            >
              <option value="">All agents</option>
              {agents.map((u) => (
                <option key={u.id} value={u.id}>
                  {fullName(u)}
                </option>
              ))}
            </select>
          )}
          {filtered && (
            <button type="button" className="text-button" onClick={() => onSearch({})}>
              Clear filters
            </button>
          )}
        </div>
        {rows.length ? (
          <div className="table-scroll">
            <table className="stack-table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Risk</th>
                  <th>Triggering reason</th>
                  <th>Status</th>
                  <th>Last intervention</th>
                  <th>Flagged</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((p) => {
                  const c = clients.find((x) => x.id === p.clientId);
                  const last = lastIntervention(p.clientId);
                  return (
                    <tr
                      key={p.clientId}
                      className="clickable-row"
                      onClick={(e) => {
                        if (!(e.target as HTMLElement).closest('button')) onOpen(p.clientId);
                      }}
                    >
                      <td className="cell-primary">
                        <div className="cell-flex">
                          <Avatar name={fullName(c) ?? p.clientId} />
                          <span>
                            <strong>{fullName(c) ?? p.clientId}</strong>
                            <small>
                              {p.clientId}
                              {admin &&
                                ` · ${fullName(users.find((u) => u.id === agentOf(p.clientId)))}`}
                            </small>
                          </span>
                        </div>
                      </td>
                      <td data-label="Risk">
                        <RiskBadge level={p.level} />
                        <small>Score {p.score}</small>
                      </td>
                      <td className="cell-wide risk-reason" data-label="Triggering reason">
                        {p.reasons[0]}
                        {p.reasons.length > 1 && <small>+{p.reasons.length - 1} more</small>}
                      </td>
                      <td data-label="Status">
                        <Badge>{p.status}</Badge>
                      </td>
                      <td data-label="Last intervention">
                        {last ? (
                          <>
                            {last.type}
                            <small>{date(last.at)}</small>
                          </>
                        ) : (
                          <span className="muted">None yet</span>
                        )}
                      </td>
                      <td data-label="Flagged">{date(p.flaggedAt)}</td>
                      <td className="cell-end">
                        <button
                          className="icon-button"
                          aria-label={`Open attrition risk for ${fullName(c) ?? p.clientId}`}
                          onClick={() => onOpen(p.clientId)}
                        >
                          <ArrowUpRight size={18} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {pager}
          </div>
        ) : (
          <Empty
            title={filtered ? 'No clients match' : 'No clients at risk'}
            text={
              filtered
                ? 'Try a different status or risk level.'
                : 'The daily analysis has not flagged any of your clients.'
            }
          />
        )}
      </section>

      {admin && (
        <section className="panel retention-agents">
          <SectionHead
            title="Retention by agent"
            detail="Success rate = mitigated ÷ (mitigated + churned)"
          />
          <div className="table-scroll">
            <table className="stack-table">
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Open flags</th>
                  <th>High risk</th>
                  <th>Interventions</th>
                  <th>Mitigated</th>
                  <th>Churned</th>
                  <th>Success rate</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((u) => {
                  const mine = profiles.filter((p) => agentOf(p.clientId) === u.id);
                  const r = retentionRate(mine);
                  return (
                    <tr key={u.id}>
                      <td className="cell-primary">
                        <div className="cell-flex">
                          <Avatar name={fullName(u)!} />
                          <span>
                            <strong>{fullName(u)}</strong>
                            <small>{u.id}</small>
                          </span>
                        </div>
                      </td>
                      <td data-label="Open flags">{mine.filter(isOpenRisk).length}</td>
                      <td data-label="High risk">
                        {mine.filter((p) => isOpenRisk(p) && p.level === 'High').length}
                      </td>
                      <td data-label="Interventions">
                        {interventions.filter((i) => i.agentId === u.id).length}
                      </td>
                      <td data-label="Mitigated">
                        {mine.filter((p) => p.status === 'Mitigated').length}
                      </td>
                      <td data-label="Churned">
                        {mine.filter((p) => p.status === 'Churned').length}
                      </td>
                      <td data-label="Success rate">
                        {r === null ? (
                          <span className="muted">No closed flags</span>
                        ) : (
                          <span className="rate-cell">
                            <span className="rate-bar">
                              <i style={{ width: `${r}%` }} />
                            </span>
                            {r}%
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}

function BalanceTrend({ series }: { series: RiskAnalysis['series'] }) {
  const times = series.map((p) => Date.parse(p.at));
  const values = series.map((p) => p.balance);
  const [t0, t1] = [Math.min(...times), Math.max(...times)];
  const [lo, hi] = [Math.min(0, ...values), Math.max(...values)];
  const x = (t: number) => (t1 > t0 ? ((t - t0) / (t1 - t0)) * 300 : 0);
  const y = (v: number) => 76 - (hi > lo ? ((v - lo) / (hi - lo)) * 68 : 34);
  // Step line: the balance holds until the next transaction.
  const points = series.flatMap((p, i) =>
    i
      ? [`${x(times[i])},${y(values[i - 1])}`, `${x(times[i])},${y(p.balance)}`]
      : [`0,${y(p.balance)}`],
  );
  const peak = Math.max(...values);
  const now = values.at(-1)!;

  return (
    <div className="balance-trend">
      <svg viewBox="0 0 300 80" preserveAspectRatio="none" role="img" aria-label="Balance trend">
        <polygon points={`0,80 ${points.join(' ')} 300,80`} />
        <polyline points={points.join(' ')} />
      </svg>
      <div className="balance-legend">
        <span>
          <small>{date(series[0].at)}</small>
          {money(values[0])}
        </span>
        <span>
          <small>30-day peak</small>
          {money(peak)}
        </span>
        <span className={now < peak ? 'down' : ''}>
          <small>{date(series.at(-1)!.at)}</small>
          {money(now)}
        </span>
      </div>
    </div>
  );
}

function eventTitle(e: RiskEvent, interventions: Intervention[]) {
  switch (e.type) {
    case 'RISK_FLAGGED':
      return `Flagged at ${e.to?.toLowerCase()} risk`;
    case 'RISK_UPDATED':
      return `Risk level ${e.from} → ${e.to}`;
    case 'INTERVENTION_LOGGED':
      return interventions.find((i) => i.id === e.interventionId)?.type ?? 'Intervention logged';
    case 'STATUS_UPDATED':
      return `${e.from} → ${e.to}`;
  }
}

const STEPS = ['At Risk', 'Under Review', 'Outcome'] as const;

export function RiskDetail({
  profile: p,
  client,
  users,
  interventions,
  analysis,
  asOf,
  canAct,
  onBack,
  onIntervention,
  onStatus,
  onClient,
}: {
  profile: RiskProfile;
  client?: Client;
  users: User[];
  interventions: Intervention[];
  analysis?: RiskAnalysis | null;
  asOf?: string;
  canAct: boolean;
  onBack: () => void;
  onIntervention: () => void;
  onStatus: () => void;
  onClient?: () => void;
}) {
  const name = (id?: string) => fullName(users.find((u) => u.id === id)) ?? id ?? 'System';
  const closed = !isOpenRisk(p);
  const current = closed ? 2 : STEPS.indexOf(p.status as (typeof STEPS)[number]);
  const reached = (i: number) =>
    i === 0
      ? p.flaggedAt
      : [...p.history]
          .reverse()
          .find(
            (h) =>
              h.type === 'STATUS_UPDATED' &&
              (i === 1
                ? h.to === 'Under Review'
                : !isOpenRisk({ status: h.to as RiskProfile['status'] })),
          )?.at;

  return (
    <>
      <button className="back-link" onClick={onBack}>
        <ArrowLeft size={16} />
        Back to attrition risk
      </button>
      <div className="profile-header">
        <div className="profile-identity">
          <Avatar name={fullName(client) ?? p.clientId} />
          <div>
            <div className="eyebrow">ATTRITION RISK · {p.clientId}</div>
            <h1>{fullName(client) ?? 'Removed client'}</h1>
            <p>
              Flagged {datetime(p.flaggedAt)} <span className="separator">·</span> Agent{' '}
              {name(client?.agentId)}
            </p>
          </div>
        </div>
        <div className="actions">
          <RiskBadge level={p.level} />
          <Badge>{p.status}</Badge>
          {canAct && !closed && (
            <>
              <button className="secondary" onClick={onStatus}>
                <ArrowUpRight size={16} />
                Update status
              </button>
              <button className="primary" onClick={onIntervention}>
                <ClipboardPen size={16} />
                Log intervention
              </button>
            </>
          )}
        </div>
      </div>

      <section className="panel case-progress" aria-label="Retention lifecycle">
        {STEPS.map((s, i) => {
          const done = i < current || (closed && i === 2);
          const label = i === 2 ? (closed ? p.status : 'Mitigated or Churned') : s;
          const at = reached(i);
          return (
            <div
              key={s}
              className={`case-step ${done ? 'done' : i === current ? 'current' : ''} ${i === 2 && p.status === 'Churned' ? 'churned' : ''}`}
            >
              <span className="case-step-dot">
                {done ? (
                  p.status === 'Churned' && i === 2 ? (
                    <UserRoundX size={15} />
                  ) : (
                    <Check size={15} />
                  )
                ) : (
                  i + 1
                )}
              </span>
              <strong>{label}</strong>
              <small>
                {at && (done || i === current)
                  ? datetime(at)
                  : i === current + 1
                    ? 'Next step'
                    : 'Not started'}
              </small>
            </div>
          );
        })}
      </section>

      {closed ? (
        <div className="case-alert static neutral" role="status">
          <Flag size={19} />
          <span>
            <strong>
              Closed as {p.status} on {date(p.closedAt!)}
            </strong>
            <small>
              If the risk signals persist {REFLAG_AFTER_DAYS} days after closing, the daily analysis
              flags this client again.
            </small>
          </span>
        </div>
      ) : (
        p.status === 'At Risk' &&
        canAct && (
          <div className="case-alert static warning" role="status">
            <TriangleAlert size={19} />
            <span>
              <strong>Contact {client?.firstName ?? 'the client'} and log what you did</strong>
              <small>Logging an intervention moves the client to Under Review.</small>
            </span>
          </div>
        )
      )}

      <div className="profile-grid">
        <div className="stack">
          <section className="panel">
            <SectionHead
              title={closed ? 'Why the client was flagged' : 'Why this client is flagged'}
              detail={`Risk score ${p.score} of 99${asOf ? ` · data as of ${date(asOf)}` : ''}`}
            />
            <ul className="risk-reasons">
              {p.reasons.map((r, i) => (
                <li key={r}>
                  <span className={`activity-icon ${i === 0 && p.level !== 'Low' ? 'alert' : ''}`}>
                    <TrendingDown size={14} />
                  </span>
                  {r}
                </li>
              ))}
            </ul>
            {analysis && analysis.series.length > 1 && (
              <div className="padded risk-trend">
                <h3>Balance, last 30 days</h3>
                <BalanceTrend series={analysis.series} />
              </div>
            )}
          </section>
          <section className="panel">
            <SectionHead title="Risk details" />
            <dl className="detail-grid padded">
              {[
                ['Client', `${fullName(client) ?? 'Removed client'} · ${p.clientId}`],
                ['Assigned agent', name(client?.agentId)],
                ['Risk level', `${p.level} (score ${p.score})`],
                ['Status', p.status],
                ['Flagged', datetime(p.flaggedAt)],
                ['Interventions', String(interventions.length)],
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
        </div>
        <section className="panel activity-panel">
          <SectionHead
            title="Retention timeline"
            detail="Flags, interventions and status changes"
          />
          <div className="activity-list">
            {[...p.history].reverse().map((e, i) => {
              const iv = interventions.find((x) => x.id === e.interventionId);
              return (
                <div className="activity-item" key={i}>
                  <span
                    className={`activity-icon ${e.type === 'RISK_FLAGGED' || (e.type === 'RISK_UPDATED' && e.to === 'High') ? 'alert' : ''}`}
                  >
                    {e.type === 'INTERVENTION_LOGGED' ? (
                      <ClipboardPen size={14} />
                    ) : e.type === 'STATUS_UPDATED' ? (
                      <Flag size={14} />
                    ) : (
                      <ShieldAlert size={14} />
                    )}
                  </span>
                  <div>
                    <strong>{eventTitle(e, interventions)}</strong>
                    {iv && <p>{iv.notes}</p>}
                    {iv?.followUpAt && <p>Follow-up on {date(iv.followUpAt)}</p>}
                    {e.note && <p>{e.note}</p>}
                    <small>
                      {datetime(e.at)} · {e.actorId ? name(e.actorId) : 'Daily risk analysis'}
                    </small>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </>
  );
}
