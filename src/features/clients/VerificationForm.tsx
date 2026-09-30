import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Field } from '../../components/ui';

type Outcome = 'Verified' | 'Rejected';

export default function VerificationForm({
  onSave,
  busy,
}: {
  onSave: (v: Outcome) => void;
  busy: boolean;
}) {
  const [outcome, setOutcome] = useState<Outcome>('Verified');
  const [checked, setChecked] = useState(false);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(outcome);
      }}
    >
      <div className="modal-body">
        <div className="verification-document">
          <ShieldCheck size={34} />
          <strong>Sample identity document</strong>
          <span>NRIC · Fictional document reference DEMO-001</span>
          <small>No actual document is uploaded or stored.</small>
        </div>
        <Field label="Simulated review outcome">
          <select value={outcome} onChange={(e) => setOutcome(e.target.value as Outcome)}>
            <option value="Verified">Approve — identity matches</option>
            <option value="Rejected">Reject — information mismatch</option>
          </select>
        </Field>
        <label className="checkbox-field">
          <input
            required
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
          />
          I have reviewed the fictional client details.
        </label>
      </div>
      <div className="modal-footer">
        <span className="muted">Simulation only</span>
        <button className="primary" disabled={busy || !checked}>
          {busy ? 'Reviewing…' : 'Complete review'}
        </button>
      </div>
    </form>
  );
}
