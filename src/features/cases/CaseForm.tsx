import { useState } from 'react';
import type { CaseCategory, CaseInput, Client, Transaction } from '../../lib/types';
import { Field, datetime, money } from '../../components/ui';
import { CASE_CATEGORIES } from '../../lib/cases';

export default function CaseForm({
  clients,
  transactions,
  clientId,
  busy,
  onSave,
}: {
  clients: Client[];
  transactions: Transaction[];
  clientId?: string;
  busy: boolean;
  onSave: (v: CaseInput) => void;
}) {
  const [v, setV] = useState<CaseInput>({
    clientId: clientId ?? '',
    category: 'Transaction dispute',
    description: '',
    transactionId: '',
  });
  const [submitted, setSubmitted] = useState(false);

  const dispute = v.category === 'Transaction dispute';
  const options = transactions.filter((t) => t.clientId === v.clientId);
  const errors: Record<string, string> = {};
  if (!v.clientId) errors.clientId = 'Select a client.';
  if (dispute && !v.transactionId) errors.transactionId = 'Link the disputed transaction.';
  if (v.description.trim().length < 10)
    errors.description = 'Describe the case in at least 10 characters.';
  const show = (k: string) => (submitted ? errors[k] : undefined);

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setSubmitted(true);
        if (!Object.keys(errors).length) onSave(v);
      }}
    >
      <div className="modal-body">
        <div className="form-grid">
          <Field label="Client" error={show('clientId')}>
            <select
              value={v.clientId}
              disabled={!!clientId}
              onChange={(e) => setV({ ...v, clientId: e.target.value, transactionId: '' })}
            >
              <option value="">Select a client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.firstName} {c.lastName} · {c.id}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Category">
            <select
              value={v.category}
              onChange={(e) => setV({ ...v, category: e.target.value as CaseCategory })}
            >
              {CASE_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <div className="span-two">
            <Field
              label={dispute ? 'Disputed transaction' : 'Linked transaction (optional)'}
              error={show('transactionId')}
            >
              <select
                value={v.transactionId}
                disabled={!v.clientId}
                onChange={(e) => setV({ ...v, transactionId: e.target.value })}
              >
                <option value="">
                  {!v.clientId
                    ? 'Select a client first'
                    : options.length
                      ? dispute
                        ? 'Select a transaction'
                        : 'No linked transaction'
                      : 'This client has no transactions'}
                </option>
                {options.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.id} · {t.type} {money(t.amount)} · {datetime(t.date)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="span-two">
            <Field label="Description" error={show('description')}>
              <textarea
                maxLength={1000}
                rows={5}
                placeholder="What happened, when, and what the client is asking for…"
                value={v.description}
                onChange={(e) => setV({ ...v, description: e.target.value })}
              />
            </Field>
            <small className="char-count">{v.description.length}/1000</small>
          </div>
        </div>
        <p className="notice">
          Agent ID, client ID and timestamp are filled in automatically. The case opens with status
          Open and no notes. Avoid entering NRIC or card numbers in the description.
        </p>
      </div>
      <div className="modal-footer">
        <span className="muted">Logged as CASE_CREATED</span>
        <button className="primary" disabled={busy}>
          {busy ? 'Raising…' : 'Raise case'}
        </button>
      </div>
    </form>
  );
}
