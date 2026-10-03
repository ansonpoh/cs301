import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type {
  AssetType,
  Client,
  EvidenceScenario,
  IdentityCheck,
  IdentityScenario,
  WealthAsset,
  WealthCase,
  WealthInput,
  WealthOrigin,
} from '../../lib/types';
import { Field, money } from '../../components/ui';
import { ASSET_TYPES, WEALTH_ORIGINS, localDate, shareValue } from '../../lib/verification';

const today = () => localDate();

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((x) => (
        <button
          type="button"
          role="radio"
          aria-checked={value === x}
          key={x}
          className={value === x ? 'active' : ''}
          onClick={() => onChange(x)}
        >
          {x}
        </button>
      ))}
    </div>
  );
}

const IDENTITY_SCENARIOS: { value: IdentityScenario; label: string; note: string }[] = [
  {
    value: 'match',
    label: 'Clear NRIC, details match',
    note: 'Extraction succeeds and the name and date of birth match the profile: Verified.',
  },
  {
    value: 'mismatch',
    label: 'Clear NRIC, details differ',
    note: 'Extraction succeeds but the details do not match the profile: Failed.',
  },
  {
    value: 'unclear',
    label: 'Blurry or partial image',
    note: 'Extraction confidence is too low to decide: routed to manual review.',
  },
  {
    value: 'service-down',
    label: 'Extraction service unavailable',
    note: 'The extraction job fails: routed to manual review, never auto-verified.',
  },
];

export function IdentityUploadForm({
  client,
  busy,
  onSave,
}: {
  client: Client;
  busy: boolean;
  onSave: (s: IdentityScenario) => void;
}) {
  const [scenario, setScenario] = useState<IdentityScenario>('match');
  const note = IDENTITY_SCENARIOS.find((s) => s.value === scenario)!.note;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(scenario);
      }}
    >
      <div className="modal-body">
        <p className="muted">
          Simulates {client.firstName} opening the emailed link and uploading an NRIC image to
          private quarantine storage. No real document is uploaded.
        </p>
        <Field label="What the client uploads">
          <select
            value={scenario}
            onChange={(e) => setScenario(e.target.value as IdentityScenario)}
          >
            {IDENTITY_SCENARIOS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
        <p className="notice">{note}</p>
      </div>
      <div className="modal-footer">
        <span className="muted">Scan · extract · compare</span>
        <button className="primary" disabled={busy}>
          {busy ? 'Processing…' : 'Simulate upload'}
        </button>
      </div>
    </form>
  );
}

export function IdentityReviewForm({
  check,
  busy,
  onSave,
}: {
  check: IdentityCheck;
  busy: boolean;
  onSave: (outcome: 'Verified' | 'Failed', rationale: string) => void;
}) {
  const [outcome, setOutcome] = useState<'Verified' | 'Failed'>('Verified');
  const [rationale, setRationale] = useState('');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(outcome, rationale);
      }}
    >
      <div className="modal-body">
        <div className="case-alert static warning" role="status">
          <span>
            <strong>Why this needs review</strong>
            <small>{check.reason ?? 'Extraction could not decide.'}</small>
          </span>
        </div>
        <Segmented
          label="Decision"
          value={outcome}
          options={['Verified', 'Failed'] as const}
          onChange={setOutcome}
        />
        <Field label="Rationale and evidence checked (required)">
          <textarea
            required
            minLength={10}
            maxLength={500}
            rows={4}
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
          />
        </Field>
        <small className="char-count">{rationale.length}/500</small>
      </div>
      <div className="modal-footer">
        <span className="muted">Logged as IDENTITY_STATUS_UPDATED</span>
        <button className="primary" disabled={busy || rationale.trim().length < 10}>
          {busy ? 'Saving…' : `Record ${outcome.toLowerCase()}`}
        </button>
      </div>
    </form>
  );
}

type AssetDraft = Omit<WealthAsset, 'id' | 'ownershipPct' | 'declaredValue'> & {
  id?: string;
  ownershipPct: string;
  declaredValue: string;
};
const blankAsset = (): AssetDraft => ({
  type: 'Stocks / funds',
  description: '',
  ownershipPct: '100',
  declaredValue: '',
  valuationDate: today(),
  origin: 'Employment income',
});

export function WealthCaseForm({
  existing,
  busy,
  onSave,
}: {
  existing?: WealthCase;
  busy: boolean;
  onSave: (v: WealthInput) => void;
}) {
  const [assets, setAssets] = useState<AssetDraft[]>(
    existing?.assets.map((a) => ({
      ...a,
      ownershipPct: String(a.ownershipPct),
      declaredValue: String(a.declaredValue),
    })) ?? [blankAsset()],
  );
  const [liabilities, setLiabilities] = useState(String(existing?.liabilities ?? 0));
  const [narrative, setNarrative] = useState(existing?.sourceNarrative ?? '');
  const set = (i: number, patch: Partial<AssetDraft>) =>
    setAssets(assets.map((a, j) => (i === j ? { ...a, ...patch } : a)));
  const parsed = assets.map((a) => ({
    ...a,
    ownershipPct: Number(a.ownershipPct),
    declaredValue: Number(a.declaredValue),
  }));
  const declared = parsed.reduce(
    (n, a) => n + (Number.isFinite(a.declaredValue) ? shareValue(a) : 0),
    0,
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ assets: parsed, liabilities: Number(liabilities), sourceNarrative: narrative });
      }}
    >
      <div className="modal-body">
        <p className="muted">
          Record what the client declares. Declared values stay separate from what evidence later
          corroborates, and external holdings are not counted as bank AUM.
        </p>
        {assets.map((a, i) => (
          <fieldset className="asset-fieldset" key={a.id ?? i}>
            <legend>
              Asset {i + 1}
              {assets.length > 1 && (
                <button
                  type="button"
                  className="text-button danger"
                  onClick={() => setAssets(assets.filter((_, j) => j !== i))}
                >
                  <Trash2 size={14} />
                  Remove
                </button>
              )}
            </legend>
            <div className="form-grid">
              <Field label="Asset type">
                <select
                  value={a.type}
                  disabled={!!a.id}
                  onChange={(e) => set(i, { type: e.target.value as AssetType })}
                >
                  {ASSET_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </Field>
              <Field label="Description">
                <input
                  required
                  minLength={3}
                  maxLength={100}
                  placeholder="e.g. Brokerage portfolio"
                  value={a.description}
                  onChange={(e) => set(i, { description: e.target.value })}
                />
              </Field>
              <Field label="Declared value of the whole asset (SGD)">
                <input
                  required
                  type="number"
                  min="1"
                  step="1"
                  value={a.declaredValue}
                  onChange={(e) => set(i, { declaredValue: e.target.value })}
                />
              </Field>
              <Field label="Client's ownership share (%)">
                <input
                  required
                  type="number"
                  min="0.01"
                  max="100"
                  step="0.01"
                  value={a.ownershipPct}
                  onChange={(e) => set(i, { ownershipPct: e.target.value })}
                />
              </Field>
              <Field label="Valuation date">
                <input
                  required
                  type="date"
                  max={today()}
                  value={a.valuationDate}
                  onChange={(e) => set(i, { valuationDate: e.target.value })}
                />
              </Field>
              <Field label="How it was acquired">
                <select
                  value={a.origin}
                  onChange={(e) => set(i, { origin: e.target.value as WealthOrigin })}
                >
                  {WEALTH_ORIGINS.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </Field>
            </div>
          </fieldset>
        ))}
        {assets.length < 10 && (
          <button
            type="button"
            className="secondary"
            onClick={() => setAssets([...assets, blankAsset()])}
          >
            <Plus size={15} />
            Add asset
          </button>
        )}
        <div className="form-grid">
          <Field label="Liabilities (SGD)">
            <input
              required
              type="number"
              min="0"
              step="1"
              value={liabilities}
              onChange={(e) => setLiabilities(e.target.value)}
            />
          </Field>
          <Field label="Declared net worth (client's share)">
            <input readOnly value={money(declared - (Number(liabilities) || 0))} />
          </Field>
        </div>
        <Field label="Source of wealth (required)">
          <textarea
            required
            minLength={20}
            maxLength={1000}
            rows={4}
            placeholder="How the client built up this wealth: employment, business, inheritance…"
            value={narrative}
            onChange={(e) => setNarrative(e.target.value)}
          />
        </Field>
        <small className="char-count">{narrative.length}/1000</small>
      </div>
      <div className="modal-footer">
        <span className="muted">
          {existing ? 'Logged as WEALTH_DECLARATION_UPDATED' : 'Logged as WEALTH_CASE_CREATED'}
        </span>
        <button className="primary" disabled={busy}>
          {busy ? 'Saving…' : existing ? 'Save declaration' : 'Create wealth case'}
        </button>
      </div>
    </form>
  );
}

const EVIDENCE_SCENARIOS: { value: EvidenceScenario; label: string; note: string }[] = [
  {
    value: 'consistent',
    label: 'Clear document, consistent with the declaration',
    note: 'Accepted. Extracted owner, value and dates agree with the declared claim.',
  },
  {
    value: 'inconsistent',
    label: 'Clear document, figures or owner differ',
    note: 'Accepted, but the analysis will flag an exception for the reviewer.',
  },
  {
    value: 'unsupported',
    label: 'Unsupported or unsafe file',
    note: 'Rejected at the scan. The document must be uploaded again.',
  },
];

export function EvidenceForm({
  asset,
  docType,
  busy,
  onSave,
}: {
  asset: WealthAsset;
  docType: string;
  busy: boolean;
  onSave: (s: EvidenceScenario) => void;
}) {
  const [scenario, setScenario] = useState<EvidenceScenario>('consistent');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(scenario);
      }}
    >
      <div className="modal-body">
        <dl className="detail-grid">
          <div>
            <dt>Claim</dt>
            <dd>{asset.description}</dd>
          </div>
          <div>
            <dt>Document</dt>
            <dd>{docType}</dd>
          </div>
        </dl>
        <Field label="Simulated document">
          <select
            value={scenario}
            onChange={(e) => setScenario(e.target.value as EvidenceScenario)}
          >
            {EVIDENCE_SCENARIOS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
        <p className="notice">{EVIDENCE_SCENARIOS.find((s) => s.value === scenario)!.note}</p>
        <p className="muted">
          In production the uploader gets a short-lived presigned link to private quarantine
          storage; accepted files are encrypted. No file is uploaded in the demo.
        </p>
      </div>
      <div className="modal-footer">
        <span className="muted">Logged as WEALTH_EVIDENCE_UPLOADED</span>
        <button className="primary" disabled={busy}>
          {busy ? 'Uploading…' : 'Upload evidence'}
        </button>
      </div>
    </form>
  );
}

type Decision = 'Verified' | 'More Information Required' | 'Rejected';
export function WealthDecisionForm({
  wc,
  busy,
  onSave,
}: {
  wc: WealthCase;
  busy: boolean;
  onSave: (outcome: Decision, rationale: string, requestedInfo: string) => void;
}) {
  const [outcome, setOutcome] = useState<Decision>('Verified');
  const [rationale, setRationale] = useState('');
  const [info, setInfo] = useState('');
  const exceptions = wc.analysis?.exceptions ?? [];
  const more = outcome === 'More Information Required';

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(outcome, rationale, info);
      }}
    >
      <div className="modal-body">
        {exceptions.length > 0 && (
          <div className="case-alert static warning" role="status">
            <span>
              <strong>
                {exceptions.length} open {exceptions.length === 1 ? 'exception' : 'exceptions'}
              </strong>
              <small>
                Automated checks assist the review. Explain how each exception was resolved if you
                verify the case.
              </small>
            </span>
          </div>
        )}
        <Segmented
          label="Decision"
          value={outcome}
          options={['Verified', 'More Information Required', 'Rejected'] as const}
          onChange={setOutcome}
        />
        {more && (
          <Field label="Information needed from the client (required)">
            <textarea
              required
              minLength={10}
              maxLength={500}
              rows={3}
              value={info}
              onChange={(e) => setInfo(e.target.value)}
            />
          </Field>
        )}
        <Field label="Rationale (required, kept in the case record)">
          <textarea
            required
            minLength={10}
            maxLength={1000}
            rows={4}
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
          />
        </Field>
        <small className="char-count">{rationale.length}/1000</small>
      </div>
      <div className="modal-footer">
        <span className="muted">Logged as WEALTH_DECISION_RECORDED</span>
        <button
          className="primary"
          disabled={busy || rationale.trim().length < 10 || (more && info.trim().length < 10)}
        >
          {busy ? 'Saving…' : 'Record decision'}
        </button>
      </div>
    </form>
  );
}
