import { useState } from 'react';
import type { ImportScenario } from '../../lib/types';

const SCENARIOS = [
  {
    id: 'success',
    title: 'Successful import',
    text: 'Receive valid deposits and withdrawals.',
  },
  {
    id: 'partial',
    title: 'Partially successful',
    text: 'Accept valid records and reject an invalid amount.',
  },
  {
    id: 'failed',
    title: 'Connection failure',
    text: 'Record a service failure without importing data.',
  },
  {
    id: 'corrupted',
    title: 'Corrupted file',
    text: 'Reject an unsupported or unreadable feed file before parsing.',
  },
  {
    id: 'exception',
    title: 'System exception',
    text: 'Parse the feed, then roll back after a processing error.',
  },
] as const;

export default function ImportForm({
  onSave,
  busy,
}: {
  onSave: (v: ImportScenario) => void;
  busy: boolean;
}) {
  const [scenario, setScenario] = useState<ImportScenario>('success');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(scenario);
      }}
    >
      <div className="modal-body">
        <p className="muted">Simulate an external core banking feed for your clients’ accounts.</p>
        <div className="scenario-options">
          {SCENARIOS.map((s) => (
            <label key={s.id} className={scenario === s.id ? 'selected' : ''}>
              <input
                type="radio"
                name="scenario"
                value={s.id}
                checked={scenario === s.id}
                onChange={() => setScenario(s.id)}
              />
              <span>
                <strong>{s.title}</strong>
                <small>{s.text}</small>
              </span>
            </label>
          ))}
        </div>
        <p className="notice">
          Imports use fixed transaction IDs per account and scenario. Repeat an import to
          demonstrate duplicate rejection. Results and timestamps appear in import history.
        </p>
      </div>
      <div className="modal-footer">
        <span className="muted">No external connection</span>
        <button className="primary" disabled={busy}>
          {busy ? 'Processing feed…' : 'Run demo import'}
        </button>
      </div>
    </form>
  );
}
