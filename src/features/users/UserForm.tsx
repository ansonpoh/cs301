import { useState } from 'react';
import type { User, UserInput } from '../../lib/types';
import { Field } from '../../components/ui';

export default function UserForm({
  user,
  onSave,
  busy,
}: {
  user?: User;
  onSave: (v: UserInput) => void;
  busy: boolean;
}) {
  const [v, setV] = useState<UserInput>({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    role: user?.role || 'Agent',
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
          {(['firstName', 'lastName', 'email'] as const).map((k) => (
            <Field
              key={k}
              label={
                k === 'firstName' ? 'First name' : k === 'lastName' ? 'Last name' : 'Email address'
              }
            >
              <input
                required
                minLength={k === 'email' ? 5 : 2}
                maxLength={k === 'email' ? 254 : 50}
                type={k === 'email' ? 'email' : 'text'}
                pattern={k === 'email' ? undefined : '[A-Za-z ]{2,50}'}
                value={v[k]}
                onChange={(e) => setV({ ...v, [k]: e.target.value })}
              />
            </Field>
          ))}
          <Field label="Role">
            <select
              disabled={user?.root}
              value={v.role}
              onChange={(e) => setV({ ...v, role: e.target.value as UserInput['role'] })}
            >
              <option>Agent</option>
              <option>Admin</option>
            </select>
          </Field>
        </div>
        <p className="notice">
          Agents manage their own client relationships. Admins manage users and review all activity.
          No email invitation will be sent.
        </p>
      </div>
      <div className="modal-footer">
        <span className="muted">
          {user?.root ? 'Root administrator role is protected.' : 'Demo user account'}
        </span>
        <button className="primary" disabled={busy}>
          {busy ? 'Saving…' : user ? 'Save changes' : 'Create user'}
        </button>
      </div>
    </form>
  );
}
