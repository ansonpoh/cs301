import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import type { InterventionInput, InterventionType, RiskProfile, RiskStatus } from '../../lib/types';
import { Badge, Field } from '../../components/ui';
import { INTERVENTION_TYPES, RISK_TRANSITIONS, isOpenRisk } from '../../lib/retention';

const day = (offset: number) =>
  new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

export function InterventionForm({
  profile,
  firstName,
  busy,
  onSave,
}: {
  profile: RiskProfile;
  firstName: string;
  busy: boolean;
  onSave: (v: InterventionInput) => void;
}) {
  const [type, setType] = useState<InterventionType>(INTERVENTION_TYPES[0]);
  const [notes, setNotes] = useState('');
  const [followUpAt, setFollowUpAt] = useState(day(7));
  const followUp = type === 'Follow-up Scheduled';

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ type, notes, followUpAt: followUp ? followUpAt : undefined });
      }}
    >
      <div className="modal-body">
        <div className="form-grid">
          <Field label="Intervention">
            <select value={type} onChange={(e) => setType(e.target.value as InterventionType)}>
              {INTERVENTION_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
          {followUp && (
            <Field label="Follow-up date">
              <input
                required
                type="date"
                min={day(1)}
                max={day(90)}
                value={followUpAt}
                onChange={(e) => setFollowUpAt(e.target.value)}
              />
            </Field>
          )}
        </div>
        <Field label="Conversation notes (required)">
          <textarea
            required
            minLength={10}
            maxLength={1000}
            rows={5}
            placeholder={`What did you discuss with ${firstName}, and what was agreed?`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>
        <small className="char-count">{notes.length}/1000</small>
        <p className="notice">
          {profile.status === 'At Risk' && `Saving this moves ${firstName} to Under Review. `}
          Notes may contain personal data: they are encrypted at rest, and contact details and ID
          numbers are masked before anything reaches the audit log.
        </p>
      </div>
      <div className="modal-footer">
        <span className="muted">Logged as INTERVENTION_LOGGED</span>
        <button className="primary" disabled={busy || notes.trim().length < 10}>
          {busy ? 'Saving…' : 'Log intervention'}
        </button>
      </div>
    </form>
  );
}

const HINTS: Partial<Record<RiskStatus, string>> = {
  'Under Review': 'You are working with the client. Log interventions as you go.',
  Mitigated: 'The client is staying. This closes the flag.',
  Churned: 'The client is leaving or has left. This closes the flag.',
};

export function RiskStatusForm({
  profile,
  busy,
  onSave,
}: {
  profile: RiskProfile;
  busy: boolean;
  onSave: (to: RiskStatus, note: string) => void;
}) {
  const options = RISK_TRANSITIONS[profile.status];
  const [to, setTo] = useState<RiskStatus>(options[0]);
  const [note, setNote] = useState('');
  const closing = !isOpenRisk({ status: to });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(to, note);
      }}
    >
      <div className="modal-body">
        <div className="segmented" role="radiogroup" aria-label="New status">
          {options.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={to === s}
              className={to === s ? 'active' : ''}
              onClick={() => setTo(s)}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="status-change">
          <Badge>{profile.status}</Badge>
          <ArrowRight size={16} />
          <Badge>{to}</Badge>
          <small>{HINTS[to]}</small>
        </div>
        <Field label={closing ? 'Note (required)' : 'Note (optional)'}>
          <textarea
            required={closing}
            maxLength={500}
            rows={4}
            placeholder={
              to === 'Churned'
                ? 'Why did the client leave?'
                : to === 'Mitigated'
                  ? 'What kept the client with the bank?'
                  : 'Anything the next reader should know?'
            }
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
        <small className="char-count">{note.length}/500</small>
      </div>
      <div className="modal-footer">
        <span className="muted">Logged as STATUS_UPDATED</span>
        <button className="primary" disabled={busy || (closing && note.trim().length < 5)}>
          {busy ? 'Saving…' : `Move to ${to}`}
        </button>
      </div>
    </form>
  );
}
