import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import type { Client, ClientInput } from '../../lib/types';
import { validateClient } from '../../lib/validation';
import { Field } from '../../components/ui';

export default function ClientForm({
  client,
  clients,
  onSave,
  busy,
}: {
  client?: Client;
  clients: Client[];
  onSave: (v: ClientInput) => void;
  busy: boolean;
}) {
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [v, setV] = useState<ClientInput>(
    client
      ? {
          firstName: client.firstName,
          lastName: client.lastName,
          dob: client.dob,
          gender: client.gender,
          email: client.email,
          phone: client.phone,
          address: client.address,
          city: client.city,
          state: client.state,
          country: client.country,
          postal: client.postal,
        }
      : {
          firstName: '',
          lastName: '',
          dob: '',
          gender: '',
          email: '',
          phone: '+65',
          address: '',
          city: 'Singapore',
          state: 'Singapore',
          country: 'Singapore',
          postal: '',
        },
  );

  const input = (key: keyof ClientInput, label: string, type = 'text') => (
    <Field label={label} error={errors[key]}>
      <input
        type={type}
        value={v[key]}
        onInput={(e) => {
          const value = e.currentTarget.value;
          setV((current) => ({ ...current, [key]: value }));
        }}
        onChange={(e) => setV({ ...v, [key]: e.target.value })}
        aria-invalid={!!errors[key]}
      />
    </Field>
  );

  const next = () => {
    const all = validateClient(v, clients, client?.id);
    const keys =
      step === 0
        ? ['firstName', 'lastName', 'dob', 'gender']
        : ['email', 'phone', 'address', 'city', 'state', 'country', 'postal'];
    const filtered = Object.fromEntries(Object.entries(all).filter(([k]) => keys.includes(k)));
    setErrors(filtered);
    if (!Object.keys(filtered).length) setStep(step + 1);
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (step < 2) next();
        else {
          const all = validateClient(v, clients, client?.id);
          setErrors(all);
          if (Object.keys(all).length) setStep(0);
          else onSave(v);
        }
      }}
      noValidate
    >
      <div className="steps">
        {['Personal details', 'Contact & address', 'Review'].map((s, i) => (
          <div key={s} className={step >= i ? 'current' : ''}>
            <span>{step > i ? <Check size={13} /> : i + 1}</span>
            {s}
          </div>
        ))}
      </div>
      <div className="modal-body">
        {step === 0 ? (
          <>
            <h3>Let’s start with the essentials.</h3>
            <p className="muted">Enter your client’s personal information.</p>
            <div className="form-grid">
              {input('firstName', 'First name')}
              {input('lastName', 'Last name')}
              {input('dob', 'Date of birth', 'date')}
              <Field label="Gender" error={errors.gender}>
                <select value={v.gender} onChange={(e) => setV({ ...v, gender: e.target.value })}>
                  <option value="">Select gender</option>
                  {['Male', 'Female', 'Non-binary', 'Prefer not to say'].map((g) => (
                    <option key={g}>{g}</option>
                  ))}
                </select>
              </Field>
            </div>
          </>
        ) : step === 1 ? (
          <>
            <h3>Stay connected.</h3>
            <p className="muted">Contact and residential details for this Singapore client.</p>
            <div className="form-grid">
              {input('email', 'Email address', 'email')}
              {input('phone', 'Phone number', 'tel')}
              <div className="span-two">{input('address', 'Residential address')}</div>
              {input('city', 'City')}
              {input('state', 'State')}
              <Field label="Country">
                <input value="Singapore" readOnly />
              </Field>
              {input('postal', 'Postal code')}
            </div>
          </>
        ) : (
          <>
            <div className="review-heading">
              <span className="round-icon">
                <Check />
              </span>
              <h3>Ready to {client ? 'update' : 'onboard'}.</h3>
              <p className="muted">Review the details before saving this profile.</p>
            </div>
            <dl className="detail-grid">
              {Object.entries(v).map(([key, value]) => (
                <div key={key}>
                  <dt>
                    {(
                      {
                        firstName: 'First name',
                        lastName: 'Last name',
                        dob: 'Date of birth',
                        postal: 'Postal code',
                      } as Record<string, string>
                    )[key] || key}
                  </dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <p className="notice">
              {client
                ? 'Changes are recorded in the audit log.'
                : 'A unique client ID is assigned on creation. Identity verification follows after onboarding.'}
            </p>
          </>
        )}
      </div>
      <div className="modal-footer">
        <button
          type="button"
          className="secondary"
          disabled={step === 0 || busy}
          onClick={() => setStep(step - 1)}
        >
          <ArrowLeft size={16} />
          Back
        </button>
        <button className="primary" disabled={busy}>
          {busy ? 'Saving…' : step === 2 ? (client ? 'Save changes' : 'Create client') : 'Continue'}
          {step < 2 && <ArrowRight size={16} />}
        </button>
      </div>
    </form>
  );
}
