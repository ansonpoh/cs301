import {
  ArrowUpRight,
  BellRing,
  Calculator,
  ClipboardCheck,
  RefreshCw,
  ShieldOff,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';
import type { Client, Product, Recommendation, RecommendationSet, User } from '../../lib/types';
import { Avatar, Badge, Empty, SectionHead, date, datetime } from '../../components/ui';
import { describeTerms, suppressedCategories } from '../../lib/recommend';

function ScoreMeter({ score }: { score: number }) {
  return (
    <div className="score-meter" aria-label={`Match score ${score} out of 100`}>
      <span>
        Match score <strong>{score}</strong>
      </span>
      <div>
        <i style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

function OutcomeLine({ r }: { r: Recommendation }) {
  const o = r.outcome!;
  return (
    <div className="reco-outcome">
      <Badge>{o.type}</Badge>
      <small>
        {o.type === 'Accepted'
          ? `${o.channel}${o.accountId ? ` · ${o.accountId}` : ''}`
          : o.type === 'Deferred'
            ? `Follow up ${date(o.followUpAt!)}`
            : o.reason}
      </small>
    </div>
  );
}

export function RecommendationsPanel({
  client,
  set,
  sets,
  products,
  users,
  optedOut,
  onRefresh,
  onSimulate,
  onOutcome,
  onConsent,
}: {
  client: Client;
  set?: RecommendationSet;
  sets: RecommendationSet[];
  products: Product[];
  users: User[];
  optedOut: boolean;
  onRefresh: () => void;
  onSimulate: (id: string) => void;
  onOutcome: (id: string) => void;
  onConsent: (consent: boolean) => void;
}) {
  const product = (id: string) => products.find((p) => p.id === id);
  const history = sets
    .flatMap((s) => s.items.filter((r) => r.outcome))
    .sort((a, b) => b.outcome!.at.localeCompare(a.outcome!.at));
  const suppressed = [...suppressedCategories(sets, products)];

  if (optedOut)
    return (
      <section className="panel">
        <div className="empty">
          <ShieldOff size={26} />
          <h3>Recommendations paused</h3>
          <p>
            {client.firstName} has withdrawn consent, so no recommendations are generated for this
            client.
          </p>
          <button className="secondary" onClick={() => onConsent(true)}>
            Record restored consent
          </button>
        </div>
      </section>
    );

  return (
    <div className="stack">
      <section className="panel">
        <div className="section-head">
          <div>
            <h2>Next best actions</h2>
            <p>Ranked for {client.firstName}. You decide what is offered.</p>
          </div>
          <div className="actions">
            {set && <Badge>{set.source === 'AI' ? 'AI ranked' : 'Fallback'}</Badge>}
            <button className="secondary" onClick={onRefresh}>
              <RefreshCw size={15} />
              Refresh
            </button>
          </div>
        </div>
        {set?.source === 'FALLBACK' && (
          <div className="reco-banner">
            <TriangleAlert size={17} />
            <span>
              <strong>Fallback set.</strong> {set.fallbackReason}. Products were ranked by the
              bank’s eligibility rules instead.
            </span>
          </div>
        )}
        {!set ? (
          <Empty title="Preparing recommendations" text="Open this tab again if nothing appears." />
        ) : set.items.length ? (
          <>
            <div className="reco-grid">
              {set.items.slice(0, 3).map((r) => {
                const p = product(r.productId);
                const sim = r.simulations.at(-1);
                const open = !r.outcome || r.outcome.type === 'Deferred';
                return (
                  <article className="reco-card" key={r.id}>
                    <div className="reco-card-top">
                      <span className="reco-rank">#{r.rank}</span>
                      <span className="eyebrow">{p?.category}</span>
                    </div>
                    <h3>{p?.name ?? r.productId}</h3>
                    <p>{p?.summary}</p>
                    <ScoreMeter score={r.score} />
                    <ul className="reco-reasons">
                      {r.reasons.map((x) => (
                        <li key={x}>{x}</li>
                      ))}
                    </ul>
                    {sim && (
                      <div className="reco-sim">
                        <Badge>{sim.result}</Badge>
                        <small>{describeTerms(sim.terms)}</small>
                      </div>
                    )}
                    {r.outcome && <OutcomeLine r={r} />}
                    {open && (
                      <div className="reco-actions">
                        {p?.terms && (
                          <button className="secondary" onClick={() => onSimulate(r.id)}>
                            <Calculator size={15} />
                            Simulate terms
                          </button>
                        )}
                        <button className="primary" onClick={() => onOutcome(r.id)}>
                          <ClipboardCheck size={15} />
                          {r.outcome ? 'Update outcome' : 'Record outcome'}
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
            <div className="reco-meta">
              <span>
                <Sparkles size={14} />
                {set.model} · {set.promptVersion} · generated {datetime(set.createdAt)}
              </span>
              <details>
                <summary>What the AI service received</summary>
                <p>Personal details are removed and values are banded before the request.</p>
                <pre>{JSON.stringify(set.payload, null, 2)}</pre>
              </details>
            </div>
          </>
        ) : (
          <Empty
            title="No eligible products"
            text="No catalogue product currently meets this client’s eligibility rules."
          />
        )}
        {suppressed.length > 0 && (
          <p className="reco-suppressed">
            Not recommended after a rejection:{' '}
            {suppressed.map(([cat, until]) => `${cat} until ${date(until)}`).join(', ')}
          </p>
        )}
      </section>

      <section className="panel">
        <SectionHead
          title="Outcome history"
          detail="Every recommendation ends with a recorded outcome"
        />
        {history.length ? (
          <div className="table-scroll">
            <table className="stack-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Outcome</th>
                  <th>Details</th>
                  <th>Recorded</th>
                </tr>
              </thead>
              <tbody>
                {history.map((r) => {
                  const u = users.find((u) => u.id === r.outcome!.agentId);
                  return (
                    <tr key={r.id}>
                      <td className="cell-primary">
                        <strong>{product(r.productId)?.name ?? r.productId}</strong>
                        <small>{r.id}</small>
                      </td>
                      <td data-label="Outcome">
                        <Badge>{r.outcome!.type}</Badge>
                      </td>
                      <td className="cell-wide" data-label="Details">
                        {[
                          r.outcome!.reason,
                          r.outcome!.channel,
                          r.outcome!.accountId && `Account ${r.outcome!.accountId}`,
                          r.outcome!.followUpAt && `Follow up ${date(r.outcome!.followUpAt)}`,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </td>
                      <td data-label="Recorded">
                        {datetime(r.outcome!.at)}
                        {u && (
                          <small>
                            {u.firstName} {u.lastName}
                          </small>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="No outcomes yet" text="Outcomes you record will appear here." />
        )}
      </section>
      <button className="danger subtle align-start" onClick={() => onConsent(false)}>
        <ShieldOff size={15} />
        Client withdrew consent to recommendations
      </button>
    </div>
  );
}

export interface NextBestActionsData {
  actions: { clientId: string; source: RecommendationSet['source']; item: Recommendation }[];
  followUps: { clientId: string; item: Recommendation }[];
}

export function NextBestActions({
  data,
  clients,
  products,
  onOpen,
}: {
  data: NextBestActionsData | null;
  clients: Client[];
  products: Product[];
  onOpen: (clientId: string) => void;
}) {
  const name = (id: string) => {
    const c = clients.find((c) => c.id === id);
    return c ? `${c.firstName} ${c.lastName}` : id;
  };
  const product = (id: string) => products.find((p) => p.id === id);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="overview-bottom nba-row">
      <section className="panel">
        <SectionHead
          title="Next best actions"
          detail="The top open recommendation for each client, by match score"
        />
        {!data ? (
          <Empty title="Preparing recommendations" text="This takes a moment on first sign-in." />
        ) : data.actions.length ? (
          <div className="table-scroll">
            <table className="stack-table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Recommended product</th>
                  <th>Why</th>
                  <th>Score</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.actions.map(({ clientId, item, source }) => (
                  <tr
                    key={item.id}
                    className="clickable-row"
                    onClick={(e) => {
                      if (!(e.target as HTMLElement).closest('button')) onOpen(clientId);
                    }}
                  >
                    <td className="cell-primary">
                      <div className="cell-flex">
                        <Avatar name={name(clientId)} />
                        <span>
                          <strong>{name(clientId)}</strong>
                          <small>{clientId}</small>
                        </span>
                      </div>
                    </td>
                    <td data-label="Recommended product">
                      <strong>{product(item.productId)?.name}</strong>
                      <small>
                        {product(item.productId)?.category}
                        {source === 'FALLBACK' && ' · fallback'}
                      </small>
                    </td>
                    <td className="cell-wide reco-why" data-label="Why">
                      {item.reasons[0]}
                    </td>
                    <td data-label="Score">
                      <span className="score-pill">{item.score}</span>
                    </td>
                    <td className="cell-end">
                      <button
                        className="icon-button"
                        aria-label={`Open recommendations for ${name(clientId)}`}
                        onClick={() => onOpen(clientId)}
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
          <Empty title="All caught up" text="Every recommendation has a recorded outcome." />
        )}
      </section>
      <section className="panel activity-panel">
        <SectionHead title="Follow-ups" detail="Deferred offers to revisit" />
        <div className="activity-list">
          {data?.followUps.map(({ clientId, item }) => {
            const due = item.outcome!.followUpAt!;
            return (
              <button
                className="activity-item follow-up"
                key={item.id}
                onClick={() => onOpen(clientId)}
              >
                <span className={`activity-icon ${due <= today ? 'alert' : ''}`}>
                  <BellRing size={14} />
                </span>
                <div>
                  <strong>
                    {name(clientId)} · {product(item.productId)?.name}
                  </strong>
                  <p>{item.outcome!.reason}</p>
                  <small>{due <= today ? `Due ${date(due)}` : `Scheduled ${date(due)}`}</small>
                </div>
              </button>
            );
          })}
          {!data?.followUps.length && <p className="muted">No follow-ups scheduled.</p>}
        </div>
      </section>
    </div>
  );
}
