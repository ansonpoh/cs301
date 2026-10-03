import {
  ArrowUpRight,
  Check,
  FileCheck2,
  FileSearch,
  Fingerprint,
  Gavel,
  Landmark,
  Pencil,
  Plus,
  Send,
  ShieldCheck,
  Upload,
  X,
} from 'lucide-react';
import type {
  Account,
  Client,
  IdentityCheck,
  User,
  WealthCase,
  WealthEvent,
  WealthFilters,
  WealthStatus,
} from '../../lib/types';
import { Badge, Empty, SectionHead, date, datetime, money, usePaged } from '../../components/ui';
import {
  EVIDENCE_REQUIREMENTS,
  WEALTH_REVIEW_THRESHOLD,
  WEALTH_STATUSES,
  activationBlockers,
  isEditableWealth,
  isFinalWealth,
  latestEvidence,
  missingEvidence,
  shareValue,
  wealthReviewRequired,
} from '../../lib/verification';

const nameOf = (users: User[], id: string) => {
  if (id === 'SYSTEM') return 'Wealth analysis job';
  if (id.startsWith('CLIENT:')) return 'Client (upload link)';
  const u = users.find((u) => u.id === id);
  return u ? `${u.firstName} ${u.lastName}` : id;
};

function IdentityPanel({
  client,
  check,
  users,
  canEdit,
  canReview,
  onRequest,
  onUpload,
  onReview,
}: {
  client: Client;
  check?: IdentityCheck;
  users: User[];
  canEdit: boolean;
  canReview: boolean;
  onRequest: () => void;
  onUpload: (id: string) => void;
  onReview: (id: string) => void;
}) {
  const open = check && (check.status === 'Awaiting Upload' || check.status === 'Manual Review');
  return (
    <section className="panel verify-panel">
      <div className="section-head">
        <div>
          <h2>
            <Fingerprint size={18} /> Identity verification
          </h2>
          <p>NRIC upload, field extraction and comparison with the profile</p>
        </div>
        <div className="actions">
          <Badge>{client.verification}</Badge>
          {canEdit && !open && client.verification !== 'Verified' && (
            <button className="primary" onClick={onRequest}>
              <Send size={15} />
              {check ? 'Request again' : 'Request verification'}
            </button>
          )}
          {canEdit && check?.status === 'Awaiting Upload' && (
            <button className="primary" onClick={() => onUpload(check.id)}>
              <Upload size={15} />
              Simulate client upload
            </button>
          )}
          {canReview && check?.status === 'Manual Review' && (
            <button className="primary" onClick={() => onReview(check.id)}>
              <Gavel size={15} />
              Resolve review
            </button>
          )}
        </div>
      </div>
      {!check ? (
        <Empty
          title="No identity check yet"
          text={
            canEdit
              ? 'Request verification to email the client a secure NRIC upload link.'
              : 'The relationship agent has not requested verification yet.'
          }
        />
      ) : (
        <>
          {check.status === 'Manual Review' && (
            <div className="case-alert static warning verify-alert" role="status">
              <span>
                <strong>Waiting for an authorized reviewer</strong>
                <small>{check.reason}</small>
              </span>
            </div>
          )}
          {check.status === 'Failed' && check.mismatches?.length ? (
            <div className="case-alert static verify-alert" role="status">
              <span>
                <strong>Details did not match the profile</strong>
                <small>{check.mismatches.join(' · ')}</small>
              </span>
            </div>
          ) : null}
          <dl className="detail-grid padded">
            {[
              ['Check ID', check.id],
              ['Status', check.status],
              [
                'Requested',
                `${datetime(check.requestedAt)} by ${nameOf(users, check.requestedBy)}`,
              ],
              [
                'Client upload',
                check.uploadedAt ? datetime(check.uploadedAt) : 'Link sent, waiting',
              ],
              ['Extracted name', check.extracted?.name ?? '—'],
              ['Extracted date of birth', check.extracted ? date(check.extracted.dob) : '—'],
              ['NRIC (masked)', check.extracted?.nric ?? '—'],
              [
                'Extraction confidence',
                check.extracted ? `${check.extracted.confidence}%` : check.uploadedAt ? 'Low' : '—',
              ],
              ...(check.review
                ? [
                    [
                      'Reviewer decision',
                      `${check.review.outcome} · ${nameOf(users, check.review.reviewerId)} · ${datetime(check.review.at)}`,
                    ],
                    ['Rationale', check.review.rationale],
                  ]
                : []),
            ].map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </section>
  );
}

const STEPS = ['Pending Evidence', 'Under Review', 'Decision'] as const;
function WealthProgress({ wc }: { wc: WealthCase }) {
  const final = isFinalWealth(wc.status);
  const current = final ? 3 : wc.status === 'Under Review' ? 1 : 0;
  const reached = (s: WealthStatus) => [...wc.history].reverse().find((h) => h.to === s)?.at;
  return (
    <div className="case-progress wealth-progress" aria-label="Wealth case lifecycle">
      {STEPS.map((s, i) => {
        const done = i < current;
        const label =
          i === 0 && wc.status === 'More Information Required'
            ? 'More Information Required'
            : i === 2
              ? final
                ? wc.status
                : 'Verified or Rejected'
              : s;
        const at =
          i === 0
            ? wc.createdAt
            : i === 1
              ? reached('Under Review')
              : final
                ? wc.decision?.at
                : undefined;
        return (
          <div
            key={s}
            className={`case-step ${done ? 'done' : i === current ? 'current' : ''} ${i === 2 && wc.status === 'Rejected' ? 'churned' : ''}`}
          >
            <span className="case-step-dot">
              {done ? (
                wc.status === 'Rejected' && i === 2 ? (
                  <X size={15} />
                ) : (
                  <Check size={15} />
                )
              ) : (
                i + 1
              )}
            </span>
            <strong>{label}</strong>
            <small>{at && (done || i === current) ? datetime(at) : 'Not started'}</small>
          </div>
        );
      })}
    </div>
  );
}

const eventTitle = (e: WealthEvent) =>
  ({
    WEALTH_CASE_CREATED: 'Wealth declaration recorded',
    WEALTH_DECLARATION_UPDATED: 'Declaration updated',
    WEALTH_EVIDENCE_UPLOADED: 'Evidence uploaded',
    WEALTH_CASE_SUBMITTED: 'Submitted for review',
    WEALTH_ANALYSIS_COMPLETED: 'Automated checks completed',
    WEALTH_DECISION_RECORDED: `Decision: ${e.to}`,
  })[e.type];

function WealthPanel({
  client,
  wc,
  previous,
  required,
  users,
  canEdit,
  canReview,
  onStart,
  onEdit,
  onEvidence,
  onSubmit,
  onDecide,
}: {
  client: Client;
  wc?: WealthCase;
  previous: WealthCase[];
  required: boolean;
  users: User[];
  canEdit: boolean;
  canReview: boolean;
  onStart: () => void;
  onEdit: (id: string) => void;
  onEvidence: (caseId: string, assetId: string, docType: string) => void;
  onSubmit: (id: string) => void;
  onDecide: (id: string) => void;
}) {
  const policy = required
    ? `Required: deposits reach ${money(WEALTH_REVIEW_THRESHOLD)}`
    : `Not required below ${money(WEALTH_REVIEW_THRESHOLD)} in deposits`;

  if (!wc)
    return (
      <section className="panel verify-panel">
        <SectionHead title="Wealth verification" detail={policy} />
        <Empty
          title="No wealth declaration"
          text={
            required
              ? 'Pending accounts stay inactive until a wealth case is verified.'
              : 'Start a declaration when the bank needs to corroborate the client’s wealth.'
          }
        />
        {canEdit && (
          <div className="verify-empty-action">
            <button className="primary" onClick={onStart}>
              <Plus size={15} />
              Start wealth declaration
            </button>
          </div>
        )}
      </section>
    );

  const editable = canEdit && isEditableWealth(wc.status);
  const missing = missingEvidence(wc);
  const claim = (id: string) => wc.analysis?.claims.find((c) => c.assetId === id);
  const declared = wc.assets.reduce((n, a) => n + shareValue(a), 0) - wc.liabilities;
  const corroborated = wc.analysis
    ? wc.assets.reduce((n, a) => n + (claim(a.id)?.corroboratedValue ?? 0), 0)
    : undefined;

  return (
    <>
      <section className="panel verify-panel">
        <div className="section-head">
          <div>
            <h2>
              <Landmark size={18} /> Wealth verification
            </h2>
            <p>
              {wc.id} · version {wc.version} · {policy}
            </p>
          </div>
          <div className="actions">
            <Badge>{wc.status}</Badge>
            {editable && (
              <button className="secondary" onClick={() => onEdit(wc.id)}>
                <Pencil size={15} />
                Edit declaration
              </button>
            )}
            {editable && (
              <button
                className="primary"
                disabled={missing.length > 0}
                title={missing.length ? `${missing.length} document(s) still needed` : undefined}
                onClick={() => onSubmit(wc.id)}
              >
                <Send size={15} />
                Submit for review
              </button>
            )}
            {canReview && wc.status === 'Under Review' && (
              <button className="primary" onClick={() => onDecide(wc.id)}>
                <Gavel size={15} />
                Record decision
              </button>
            )}
            {canEdit && isFinalWealth(wc.status) && (
              <button className="secondary" onClick={onStart}>
                <Plus size={15} />
                Start re-verification
              </button>
            )}
          </div>
        </div>
        {wc.status === 'More Information Required' && wc.decision?.requestedInfo && (
          <div className="case-alert static warning verify-alert" role="status">
            <span>
              <strong>Reviewer asked for more information</strong>
              <small>{wc.decision.requestedInfo}</small>
            </span>
          </div>
        )}
        <WealthProgress wc={wc} />
        <div className="stat-grid three verify-stats">
          <div className="stat">
            <span className="stat-label">Declared net worth</span>
            <strong>{money(declared)}</strong>
            <small>Client’s share, less {money(wc.liabilities)} liabilities</small>
          </div>
          <div className="stat">
            <span className="stat-label">Corroborated by evidence</span>
            <strong>{corroborated === undefined ? '—' : money(corroborated)}</strong>
            <small>
              {wc.analysis ? `Checked ${datetime(wc.analysis.at)}` : 'After submission'}
            </small>
          </div>
          <div className="stat">
            <span className="stat-label">Checklist</span>
            <strong>
              {wc.assets.reduce((n, a) => n + EVIDENCE_REQUIREMENTS[a.type].length, 0) -
                missing.length}
              /{wc.assets.reduce((n, a) => n + EVIDENCE_REQUIREMENTS[a.type].length, 0)}
            </strong>
            <small>Documents accepted · external holdings, not bank AUM</small>
          </div>
        </div>
        <div className="asset-list">
          {wc.assets.map((a) => {
            const c = claim(a.id);
            return (
              <article className="asset-card" key={a.id}>
                <div className="asset-card-head">
                  <div>
                    <span className="eyebrow">{a.type}</span>
                    <h3>{a.description}</h3>
                    <p>
                      Declared {money(a.declaredValue)} · {a.ownershipPct}% owned (
                      {money(shareValue(a))}) · valued {date(a.valuationDate)} · {a.origin}
                    </p>
                  </div>
                  {c && (
                    <div className="claim-badges" aria-label="Claim assessment">
                      <span>
                        Ownership <Badge>{c.ownership}</Badge>
                      </span>
                      <span>
                        Valuation <Badge>{c.valuation}</Badge>
                      </span>
                      <span>
                        Origin <Badge>{c.origin}</Badge>
                      </span>
                    </div>
                  )}
                </div>
                <ul className="evidence-list">
                  {EVIDENCE_REQUIREMENTS[a.type].map((r) => {
                    const e = latestEvidence(wc, a.id, r.docType);
                    return (
                      <li key={r.docType}>
                        {e?.status === 'Accepted' ? (
                          <FileCheck2 size={16} />
                        ) : (
                          <FileSearch size={16} />
                        )}
                        <span>
                          <strong>{r.docType}</strong>
                          <small>
                            Supports {r.checks.join(', ')}
                            {e && ` · ${e.id} · ${datetime(e.uploadedAt)}`}
                            {e?.reason && ` · ${e.reason}`}
                          </small>
                        </span>
                        <Badge>{e?.status ?? 'Missing'}</Badge>
                        {editable && (
                          <button
                            className="text-button"
                            onClick={() => onEvidence(wc.id, a.id, r.docType)}
                          >
                            <Upload size={14} />
                            {e ? 'Replace' : 'Upload'}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
                {c?.notes.length ? (
                  <ul className="claim-notes">
                    {c.notes.map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>

      <div className="overview-bottom verify-bottom">
        <section className="panel">
          <SectionHead
            title="Source of wealth"
            detail="Declared narrative, kept in the case record only"
          />
          <p className="verify-narrative">{wc.sourceNarrative}</p>
          {wc.decision && (
            <dl className="detail-grid padded">
              <div>
                <dt>Reviewer</dt>
                <dd>{nameOf(users, wc.decision.reviewerId)}</dd>
              </div>
              <div>
                <dt>Decided</dt>
                <dd>{datetime(wc.decision.at)}</dd>
              </div>
              <div className="span-two">
                <dt>Rationale</dt>
                <dd>{wc.decision.rationale}</dd>
              </div>
            </dl>
          )}
          {previous.length > 0 && (
            <div className="previous-cases">
              <h3>Earlier versions</h3>
              {previous.map((p) => (
                <p key={p.id}>
                  {p.id} · v{p.version} · <Badge>{p.status}</Badge>{' '}
                  {p.decision && `on ${date(p.decision.at)}`}
                </p>
              ))}
            </div>
          )}
        </section>
        <section className="panel activity-panel">
          <SectionHead title="Case timeline" detail={`${client.firstName}’s wealth case history`} />
          <div className="activity-list">
            {[...wc.history].reverse().map((e, i) => (
              <div className="activity-item" key={i}>
                <span
                  className={`activity-icon ${e.to === 'Rejected' || e.to === 'More Information Required' ? 'alert' : ''}`}
                >
                  {e.type === 'WEALTH_DECISION_RECORDED' ? (
                    <Gavel size={14} />
                  ) : e.type === 'WEALTH_EVIDENCE_UPLOADED' ? (
                    <Upload size={14} />
                  ) : (
                    <ShieldCheck size={14} />
                  )}
                </span>
                <div>
                  <strong>{eventTitle(e)}</strong>
                  {e.note && <p>{e.note}</p>}
                  <small>
                    {datetime(e.at)} ·{' '}
                    {e.actorId ? nameOf(users, e.actorId) : 'Wealth analysis job'}
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

export function VerificationPanel({
  client,
  accounts,
  checks,
  cases,
  users,
  canEdit,
  canReview,
  onRequestIdentity,
  onUpload,
  onReviewIdentity,
  onStartWealth,
  onEditWealth,
  onEvidence,
  onSubmitWealth,
  onDecide,
}: {
  client: Client;
  accounts: Account[];
  checks: IdentityCheck[];
  cases: WealthCase[];
  users: User[];
  canEdit: boolean;
  canReview: boolean;
  onRequestIdentity: () => void;
  onUpload: (checkId: string) => void;
  onReviewIdentity: (checkId: string) => void;
  onStartWealth: () => void;
  onEditWealth: (caseId: string) => void;
  onEvidence: (caseId: string, assetId: string, docType: string) => void;
  onSubmitWealth: (caseId: string) => void;
  onDecide: (caseId: string) => void;
}) {
  const pending = accounts.filter((a) => a.status === 'Pending');
  const blockers = activationBlockers(client, accounts, cases);

  return (
    <div className="stack">
      {pending.length > 0 && (
        <div className="case-alert static neutral verify-alert" role="status">
          <span>
            <strong>
              {pending.length} {pending.length === 1 ? 'account' : 'accounts'} pending activation
            </strong>
            <small>
              {blockers.length
                ? `Waiting for: ${blockers.join(' and ')}. Accounts activate automatically once every required check passes.`
                : 'All checks have passed.'}
            </small>
          </span>
        </div>
      )}
      <IdentityPanel
        client={client}
        check={checks[0]}
        users={users}
        canEdit={canEdit}
        canReview={canReview}
        onRequest={onRequestIdentity}
        onUpload={onUpload}
        onReview={onReviewIdentity}
      />
      <WealthPanel
        client={client}
        wc={cases[0]}
        previous={cases.slice(1)}
        required={wealthReviewRequired(accounts)}
        users={users}
        canEdit={canEdit}
        canReview={canReview}
        onStart={onStartWealth}
        onEdit={onEditWealth}
        onEvidence={onEvidence}
        onSubmit={onSubmitWealth}
        onDecide={onDecide}
      />
    </div>
  );
}

export function VerificationQueue({
  checks,
  cases,
  rows,
  clients,
  filters,
  admin,
  busy,
  onSearch,
  onOpen,
}: {
  checks: IdentityCheck[];
  // Every visible case, for the summary tiles; rows is the filtered search result.
  cases: WealthCase[];
  rows: WealthCase[];
  clients: Client[];
  filters: WealthFilters;
  admin: boolean;
  busy: boolean;
  onSearch: (f: WealthFilters) => void;
  onOpen: (clientId: string) => void;
}) {
  const clientName = (id: string) => {
    const c = clients.find((x) => x.id === id);
    return c ? `${c.firstName} ${c.lastName}` : 'Removed client';
  };
  const openChecks = checks.filter(
    (c) => c.status === 'Awaiting Upload' || c.status === 'Manual Review',
  );
  const { rows: pageRows, pager } = usePaged(rows);
  const status = filters.status ?? 'Open';

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">KYC &amp; SOURCE OF WEALTH</div>
          <h1>Verification</h1>
          <p>
            {admin
              ? 'Resolve identity reviews and decide wealth cases across all agents.'
              : 'Track identity checks and wealth evidence for your clients.'}
          </p>
        </div>
      </div>
      <div className="stat-grid">
        {[
          ['Identity reviews', checks.filter((c) => c.status === 'Manual Review').length],
          ['Awaiting client upload', checks.filter((c) => c.status === 'Awaiting Upload').length],
          ['Wealth cases under review', cases.filter((w) => w.status === 'Under Review').length],
          ['Waiting on evidence', cases.filter((w) => isEditableWealth(w.status)).length],
        ].map(([k, v]) => (
          <div className="stat" key={k}>
            <span className="stat-label">{k}</span>
            <strong>{v}</strong>
          </div>
        ))}
      </div>

      <section className="panel">
        <SectionHead title="Open identity checks" detail="Waiting for an upload or a reviewer" />
        {openChecks.length ? (
          <div className="table-scroll">
            <table className="stack-table">
              <thead>
                <tr>
                  <th>Check</th>
                  <th>Client</th>
                  <th>Status</th>
                  <th>Requested</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {openChecks.map((c) => (
                  <tr key={c.id} className="clickable-row" onClick={() => onOpen(c.clientId)}>
                    <td className="cell-primary">
                      <strong>{c.id}</strong>
                      <small>{c.reason ?? 'NRIC upload link sent'}</small>
                    </td>
                    <td data-label="Client">
                      <strong>{clientName(c.clientId)}</strong>
                      <small>{c.clientId}</small>
                    </td>
                    <td data-label="Status">
                      <Badge>{c.status}</Badge>
                    </td>
                    <td data-label="Requested">{datetime(c.requestedAt)}</td>
                    <td className="cell-end">
                      <button className="icon-button" aria-label={`Open ${c.clientId}`}>
                        <ArrowUpRight size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="No open identity checks" text="Every requested check has an outcome." />
        )}
      </section>

      <section className="panel verify-queue">
        <div className="filters">
          <select
            aria-label="Wealth case status"
            value={status}
            disabled={busy}
            onChange={(e) =>
              onSearch({ ...filters, status: e.target.value as WealthFilters['status'] })
            }
          >
            <option value="Open">Open cases</option>
            {WEALTH_STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <span className="filter-count">{rows.length} wealth cases</span>
        </div>
        {rows.length ? (
          <div className="table-scroll">
            <table className="stack-table">
              <thead>
                <tr>
                  <th>Wealth case</th>
                  <th>Client</th>
                  <th>Status</th>
                  <th>Exceptions</th>
                  <th>Updated</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((w) => (
                  <tr key={w.id} className="clickable-row" onClick={() => onOpen(w.clientId)}>
                    <td className="cell-primary">
                      <strong>{w.id}</strong>
                      <small>
                        v{w.version} · {w.assets.length} asset(s)
                      </small>
                    </td>
                    <td data-label="Client">
                      <strong>{clientName(w.clientId)}</strong>
                      <small>{w.clientId}</small>
                    </td>
                    <td data-label="Status">
                      <Badge>{w.status}</Badge>
                    </td>
                    <td data-label="Exceptions">
                      {w.analysis ? w.analysis.exceptions.length : '—'}
                    </td>
                    <td data-label="Updated">{datetime(w.updatedAt)}</td>
                    <td className="cell-end">
                      <button className="icon-button" aria-label={`Open ${w.id}`}>
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
            title="No wealth cases"
            text="Start a wealth declaration from a client's Verification tab."
          />
        )}
      </section>
    </>
  );
}
