import { useState } from 'react';
import type { AccountInput } from '../../lib/types';
import { Field } from '../../components/ui';

export default function AccountForm({
  onSave,
  busy,
}: {
  onSave: (v: AccountInput) => void;
  busy: boolean;
}) {
  const [v, setV] = useState<AccountInput>({
    type: 'Savings',
    status: 'Active',
    openingDate: new Date().toISOString().slice(0, 10),
    initialDeposit: 0,
    currency: 'SGD',
    branchId: 'SG-001',
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(v);
      }}
    >
      <div className="modal-body">
        <div className="form-grid">
          <Field label="Account type">
            <select
              value={v.type}
              onChange={(e) => setV({ ...v, type: e.target.value as AccountInput['type'] })}
            >
              {['Savings', 'Checking', 'Business'].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="Account status">
            <select
              value={v.status}
              onChange={(e) => setV({ ...v, status: e.target.value as AccountInput['status'] })}
            >
              {['Active', 'Inactive', 'Pending'].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="Opening date">
            <input
              required
              type="date"
              onInput={(e) => {
                const openingDate = e.currentTarget.value;
                setV((current) => ({ ...current, openingDate }));
              }}
              value={v.openingDate}
              onChange={(e) => setV({ ...v, openingDate: e.target.value })}
            />
          </Field>
          <Field label="Initial deposit (SGD)">
            <input
              required
              type="number"
              min="0"
              step="0.01"
              value={Number.isNaN(v.initialDeposit) ? '' : v.initialDeposit}
              onChange={(e) =>
                setV({ ...v, initialDeposit: e.target.value === '' ? NaN : Number(e.target.value) })
              }
            />
          </Field>
          <Field label="Currency">
            <input value="SGD — Singapore Dollar" readOnly />
          </Field>
          <Field label="Branch ID">
            <input
              required
              value={v.branchId}
              onChange={(e) => setV({ ...v, branchId: e.target.value })}
            />
          </Field>
        </div>
        <p className="notice">
          An account ID is assigned automatically. The initial deposit is a demo value; no funds are
          transferred.
        </p>
      </div>
      <div className="modal-footer">
        <span className="muted">Singapore banking entity</span>
        <button className="primary" disabled={busy}>
          {busy ? 'Creating…' : 'Open account'}
        </button>
      </div>
    </form>
  );
}
