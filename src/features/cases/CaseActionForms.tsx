import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import type { Case, CaseStatus, User } from '../../lib/types';
import { Badge, Field } from '../../components/ui';

export function StatusForm({
  c,
  to,
  busy,
  onSave,
}: {
  c: Case;
  to: CaseStatus;
  busy: boolean;
  onSave: (note: string) => void;
}) {
  const [note, setNote] = useState('');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(note);
      }}
    >
      <div className="modal-body">
        <div className="status-change">
          <Badge>{c.status}</Badge>
          <ArrowRight size={16} />
          <Badge>{to}</Badge>
        </div>
        <Field label="Note (required)">
          <textarea
            required
            minLength={5}
            maxLength={500}
            rows={4}
            placeholder={
              to === 'Resolved'
                ? 'How was the case resolved, and did the client confirm?'
                : 'What will be investigated, and with whom?'
            }
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
        <small className="char-count">{note.length}/500</small>
      </div>
      <div className="modal-footer">
        <span className="muted">Logged as STATUS_UPDATED</span>
        <button className="primary" disabled={busy || note.trim().length < 5}>
          {busy ? 'Saving…' : `Move to ${to}`}
        </button>
      </div>
    </form>
  );
}

export function ReassignForm({
  c,
  users,
  busy,
  onSave,
}: {
  c: Case;
  users: User[];
  busy: boolean;
  onSave: (agentId: string) => void;
}) {
  const agents = users.filter((u) => u.role === 'Agent' && u.active && u.id !== c.agentId);
  const current = users.find((u) => u.id === c.agentId);
  const [agentId, setAgentId] = useState(agents[0]?.id ?? '');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(agentId);
      }}
    >
      <div className="modal-body">
        <div className="form-grid">
          <Field label="Current agent">
            <input
              readOnly
              value={current ? `${current.firstName} ${current.lastName}` : c.agentId}
            />
          </Field>
          <Field label="Reassign to">
            <select required value={agentId} onChange={(e) => setAgentId(e.target.value)}>
              {!agents.length && <option value="">No other active agents</option>}
              {agents.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.firstName} {u.lastName}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <p className="notice">
          The new agent gets a fresh SLA window. If the case breaches the SLA again, it is
          re-escalated and administrators are notified again.
        </p>
      </div>
      <div className="modal-footer">
        <span className="muted">Logged as REASSIGNED</span>
        <button className="primary" disabled={busy || !agentId}>
          {busy ? 'Reassigning…' : 'Reassign case'}
        </button>
      </div>
    </form>
  );
}

export function SlaForm({
  days,
  busy,
  onSave,
}: {
  days: number;
  busy: boolean;
  onSave: (days: number) => void;
}) {
  const [value, setValue] = useState(String(days));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(Number(value));
      }}
    >
      <div className="modal-body">
        <Field label="Resolution SLA (business days)">
          <input
            required
            type="number"
            min="1"
            max="30"
            step="1"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </Field>
        <p className="notice">
          An automated check runs every minute. Open or investigating cases older than this, not
          counting weekends, are escalated and administrators are notified.
        </p>
      </div>
      <div className="modal-footer">
        <span className="muted">Applies to all open cases</span>
        <button className="primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save SLA'}
        </button>
      </div>
    </form>
  );
}
