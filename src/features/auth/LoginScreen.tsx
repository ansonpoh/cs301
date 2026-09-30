import { useState, type FormEvent } from 'react';
import { ArrowRight, KeyRound, ShieldCheck } from 'lucide-react';
import type { User } from '../../lib/types';
import { Avatar, Field } from '../../components/ui';
import Brand from '../../components/Brand';
import Toast from '../../components/Toast';

const DEMO_MFA_CODE = '123456';

export default function LoginScreen({
  users,
  loginId,
  busy,
  error,
  toast,
  onSelect,
  onError,
  onLogin,
  onResetPassword,
}: {
  users: User[];
  loginId: string;
  busy: boolean;
  error: string;
  toast: string;
  onSelect: (id: string) => void;
  onError: (message: string) => void;
  onLogin: () => void;
  onResetPassword: () => void;
}) {
  const [mfa, setMfa] = useState(false);
  const [code, setCode] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onError('');
    if (!mfa) {
      setMfa(true);
      return;
    }
    if (code !== DEMO_MFA_CODE) {
      onError(`Use the demo verification code: ${DEMO_MFA_CODE}.`);
      return;
    }
    onLogin();
  };

  const backToProfiles = () => {
    setMfa(false);
    setCode('');
    onError('');
  };

  return (
    <div className="login-layout">
      <section className="login-story">
        <Brand />
        <div className="story-main">
          <span className="story-kicker">BUILT AROUND RELATIONSHIPS</span>
          <h1>
            Every client.
            <br />A clearer
            <br />
            <em>connection.</em>
          </h1>
          <p>
            Your people, their accounts, and the moments that matter. Together in one thoughtful
            workspace.
          </p>
          <div className="story-line" />
          <div className="story-foot">
            <ShieldCheck size={20} />
            <span>
              Scrooge Global Bank
              <br />
              <small>Singapore relationship workspace</small>
            </span>
          </div>
        </div>
        <div className="orb orb-one" />
        <div className="orb orb-two" />
        <span className="story-copyright">© 2026 Scrooge Global Bank · CS301 Prototype</span>
      </section>

      <main className="login-main">
        <span className="demo-label">
          <i />
          INTERACTIVE DEMO
        </span>
        <div className="login-card">
          <span className="round-icon">
            <KeyRound size={24} />
          </span>
          <h2>{mfa ? 'One more step.' : 'Welcome to your workspace.'}</h2>
          <p>
            {mfa
              ? 'Enter the demo code to complete simulated MFA.'
              : 'Choose a demo profile to explore the CRM.'}
          </p>
          <form onSubmit={submit}>
            {!mfa ? (
              <div className="login-users">
                {users
                  .filter((u) => u.active)
                  .map((u) => (
                    <label
                      key={u.id}
                      className={`login-user ${loginId === u.id ? 'selected' : ''}`}
                    >
                      <input
                        type="radio"
                        name="demo-user"
                        value={u.id}
                        checked={loginId === u.id}
                        onChange={() => onSelect(u.id)}
                      />
                      <Avatar name={`${u.firstName} ${u.lastName}`} />
                      <span>
                        <strong>
                          {u.firstName} {u.lastName}
                        </strong>
                        <small>
                          {u.role === 'Agent'
                            ? 'Relationship agent'
                            : u.root
                              ? 'Root administrator'
                              : 'Administrator'}
                        </small>
                      </span>
                      <span className="radio-indicator" />
                    </label>
                  ))}
              </div>
            ) : (
              <>
                <Field label="Verification code">
                  <input
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    autoFocus
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="Enter 6-digit code"
                  />
                </Field>
                <div className="notice">
                  Demo code: <strong>{DEMO_MFA_CODE}</strong>. No message is sent.
                </div>
              </>
            )}
            {error && (
              <p className="error-banner" role="alert">
                {error}
              </p>
            )}
            <button className="primary login-submit" disabled={busy}>
              {busy ? 'Opening workspace…' : mfa ? 'Verify & sign in' : 'Continue to workspace'}
              <ArrowRight size={18} />
            </button>
          </form>
          <div className="login-secondary">
            {mfa ? (
              <button className="text-button" onClick={backToProfiles}>
                Choose another profile
              </button>
            ) : (
              <button className="text-button" onClick={onResetPassword}>
                Simulate password reset
              </button>
            )}
          </div>
          <p className="login-note">
            <ShieldCheck size={15} />
            Fictional data. Local browser storage. No bank connection.
          </p>
        </div>
        <span className="login-bottom">RELATIONSHIPS FIRST. ALWAYS.</span>
      </main>

      {toast && <Toast message={toast} />}
    </div>
  );
}
