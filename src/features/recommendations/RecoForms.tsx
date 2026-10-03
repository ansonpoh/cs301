import { useState } from 'react';
import type {
  AiMode,
  FulfilmentChannel,
  OfferTerms,
  Product,
  Recommendation,
  RecoOutcomeType,
} from '../../lib/types';
import { Badge, Field, datetime } from '../../components/ui';
import { DEFER_REASONS, REJECT_REASONS, describeTerms } from '../../lib/recommend';

export function RefreshForm({ busy, onSave }: { busy: boolean; onSave: (mode: AiMode) => void }) {
  const [mode, setMode] = useState<AiMode>('normal');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(mode);
      }}
    >
      <div className="modal-body">
        <Field label="Simulated AI service response">
          <select value={mode} onChange={(e) => setMode(e.target.value as AiMode)}>
            <option value="normal">Normal: AI ranks eligible products</option>
            <option value="unavailable">Failure: AI service unavailable</option>
            <option value="invalid">Failure: invalid AI response</option>
          </select>
        </Field>
        <p className="notice">
          Profile, account and transaction data are masked before they are sent. The AI may only
          rank catalogue products the client is eligible for. If it fails, the eligibility rules
          rank them and the set is marked FALLBACK. The current set is marked outdated.
        </p>
      </div>
      <div className="modal-footer">
        <span className="muted">Logged as RECO_GENERATED</span>
        <button className="primary" disabled={busy}>
          {busy ? 'Generating…' : 'Generate recommendations'}
        </button>
      </div>
    </form>
  );
}

export function SimulateForm({
  item,
  product,
  busy,
  onSimulate,
}: {
  item: Recommendation;
  product: Product;
  busy: boolean;
  onSimulate: (terms: OfferTerms) => void;
}) {
  const t = product.terms ?? {};
  const last = item.simulations.at(-1)?.terms;
  const [v, setV] = useState<Record<keyof OfferTerms, string>>({
    amount: String(last?.amount ?? t.amount?.min ?? ''),
    tenureMonths: String(last?.tenureMonths ?? t.tenureMonths?.min ?? ''),
    rate: String(last?.rate ?? t.rate?.min ?? ''),
  });
  const fields = [
    ['amount', 'Amount (SGD)', t.amount, 100],
    ['tenureMonths', 'Tenure (months)', t.tenureMonths, 1],
    ['rate', 'Rate (% p.a.)', t.rate, 0.05],
  ] as const;
  const sim = item.simulations.at(-1);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const terms: OfferTerms = {};
        for (const [k, , r] of fields) if (r) terms[k] = v[k] === '' ? NaN : Number(v[k]);
        onSimulate(terms);
      }}
    >
      <div className="modal-body">
        <p className="muted">{product.name}: adjust the terms the client is asking for.</p>
        <div className="form-grid">
          {fields.map(
            ([k, label, r, step]) =>
              r && (
                <Field key={k} label={label}>
                  <input
                    required
                    type="number"
                    min={r.min}
                    max={r.max}
                    step={step}
                    value={v[k]}
                    onChange={(e) => setV({ ...v, [k]: e.target.value })}
                  />
                  <small className="hint">
                    {r.min.toLocaleString()}–{r.max.toLocaleString()}
                  </small>
                </Field>
              ),
          )}
        </div>
        {sim && (
          <div className={`sim-result ${sim.result === 'Pre-approved' ? 'ok' : ''}`} role="status">
            <Badge>{sim.result}</Badge>
            <strong>{describeTerms(sim.terms)}</strong>
            <ul>
              {sim.reasons.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
            <small>Checked {datetime(sim.at)}</small>
          </div>
        )}
      </div>
      <div className="modal-footer">
        <span className="muted">Logged as RECO_SIMULATED</span>
        <button className="primary" disabled={busy}>
          {busy ? 'Checking…' : 'Check terms'}
        </button>
      </div>
    </form>
  );
}

export interface OutcomeInput {
  type: RecoOutcomeType;
  reason?: string;
  channel?: FulfilmentChannel;
  followUpAt?: string;
}

export function OutcomeForm({
  product,
  busy,
  onSave,
}: {
  product: Product;
  busy: boolean;
  onSave: (v: OutcomeInput) => void;
}) {
  const channels: FulfilmentChannel[] = [
    'Application link',
    'Brochure',
    ...(product.opensAccount ? (['Open account'] as const) : []),
  ];
  const inTwoWeeks = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);
  const [type, setType] = useState<RecoOutcomeType>('Accepted');
  const [channel, setChannel] = useState<FulfilmentChannel>(channels[0]);
  const [preset, setPreset] = useState('');
  const [other, setOther] = useState('');
  const [followUpAt, setFollowUpAt] = useState(inTwoWeeks);
  const reasons = type === 'Rejected' ? REJECT_REASONS : DEFER_REASONS;
  const reason = preset === 'Other' ? other.trim() : preset;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(
          type === 'Accepted'
            ? { type, channel }
            : { type, reason, followUpAt: type === 'Deferred' ? followUpAt : undefined },
        );
      }}
    >
      <div className="modal-body">
        <p className="muted">{product.name}</p>
        <div className="segmented" role="radiogroup" aria-label="Outcome">
          {(['Accepted', 'Rejected', 'Deferred'] as const).map((x) => (
            <button
              type="button"
              role="radio"
              aria-checked={type === x}
              key={x}
              className={type === x ? 'active' : ''}
              onClick={() => {
                setType(x);
                setPreset('');
              }}
            >
              {x}
            </button>
          ))}
        </div>
        {type === 'Accepted' ? (
          <>
            <Field label="Fulfilment channel">
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value as FulfilmentChannel)}
              >
                {channels.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <p className="notice">
              {channel === 'Open account'
                ? `A pending ${product.opensAccount?.toLowerCase()} account is opened and linked to this recommendation.`
                : `The ${channel.toLowerCase()} is sent to the client (simulated; no email is sent).`}
            </p>
          </>
        ) : (
          <div className="form-grid">
            <Field label="Reason (required)">
              <select required value={preset} onChange={(e) => setPreset(e.target.value)}>
                <option value="">Select a reason</option>
                {reasons.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </Field>
            {type === 'Deferred' && (
              <Field label="Follow-up date">
                <input
                  required
                  type="date"
                  min={new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)}
                  value={followUpAt}
                  onChange={(e) => setFollowUpAt(e.target.value)}
                />
              </Field>
            )}
            {preset === 'Other' && (
              <div className="span-two">
                <Field label="Describe the reason">
                  <input
                    required
                    maxLength={200}
                    value={other}
                    onChange={(e) => setOther(e.target.value)}
                  />
                </Field>
              </div>
            )}
            <p className="notice span-two">
              {type === 'Rejected'
                ? `${product.category} products will not be recommended to this client for 90 days.`
                : 'A follow-up reminder appears on your dashboard. You can record the final outcome later.'}
            </p>
          </div>
        )}
      </div>
      <div className="modal-footer">
        <span className="muted">Logged as RECO_OUTCOME</span>
        <button className="primary" disabled={busy || (type !== 'Accepted' && !reason)}>
          {busy ? 'Saving…' : `Record ${type.toLowerCase()}`}
        </button>
      </div>
    </form>
  );
}
