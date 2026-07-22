import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../../shared/api.js';
import { useAuth } from '../../shared/auth.jsx';

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  required = true,
  placeholder,
  show,
  onToggleShow,
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="login-password-wrap">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          placeholder={placeholder}
          required={required}
        />
        <button
          type="button"
          className="login-password-toggle"
          onClick={onToggleShow}
          aria-label={show ? 'Hide password' : 'Show password'}
          aria-pressed={show}
        >
          {show ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
              <path d="M3 3l18 18" strokeLinecap="round" />
              <path
                d="M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.1A9.8 9.8 0 0 1 12 5c5 0 8.5 4.5 9.5 6-.4.6-1.1 1.6-2.2 2.7M6.1 6.1C4.2 7.5 2.9 9.3 2.5 11c1 1.5 4.5 6 9.5 6 1.2 0 2.3-.2 3.3-.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
              <path
                d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6S2.5 12 2.5 12Z"
                strokeLinejoin="round"
              />
              <circle cx="12" cy="12" r="2.5" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const { user, login } = useAuth();
  const [mode, setMode] = useState('signin'); // signin | reset
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const switchMode = (next) => {
    setMode(next);
    setError('');
    setSuccess('');
    setShowPassword(false);
    setShowCurrent(false);
    setShowNew(false);
    setShowConfirm(false);
  };

  const onSignIn = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const onReset = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      if (newPassword !== confirmPassword) {
        throw new Error('New password and confirmation do not match.');
      }
      if (newPassword.length < 12) {
        throw new Error('New password must be at least 12 characters.');
      }
      await api('/auth/reset-password', {
        method: 'POST',
        body: {
          email: email.trim(),
          currentPassword,
          newPassword,
        },
      });
      setSuccess('Password updated. Sign in with your new password.');
      setPassword('');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setMode('signin');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <aside className="login-hero">
        <div className="login-hero-top">
          <p className="brand-wordmark brand-wordmark--hero">
            TYLO <span>One</span>
          </p>
        </div>
        <div className="login-hero-inner">
          <h1>One workspace for all healthcare activation operations.</h1>
          <p>Manage assets, documents, camps, requests, logistics, and more.</p>
        </div>
      </aside>

      <div className="login-panel">
        {mode === 'signin' ? (
          <form className="card login-card" onSubmit={onSignIn} aria-labelledby="login-heading">
            <p className="login-kicker">Welcome back</p>
            <h2 id="login-heading">Sign in</h2>
            <p>Enter your work email and password.</p>

            <div className="field">
              <label htmlFor="login-email">Work email</label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                placeholder="you@company.com"
                required
              />
            </div>

            <PasswordField
              id="login-password"
              label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              show={showPassword}
              onToggleShow={() => setShowPassword((v) => !v)}
            />

            {success && (
              <p className="login-success" role="status">
                {success}
              </p>
            )}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}

            <button className="btn" disabled={busy} type="submit">
              {busy ? 'Signing in…' : 'Continue'}
            </button>

            <p className="login-switch">
              <button type="button" className="login-link" onClick={() => switchMode('reset')}>
                Reset password
              </button>
            </p>
          </form>
        ) : (
          <form className="card login-card" onSubmit={onReset} aria-labelledby="reset-heading">
            <p className="login-kicker">Account security</p>
            <h2 id="reset-heading">Reset password</h2>
            <p>Confirm your current password, then choose a new one (at least 12 characters).</p>

            <div className="field">
              <label htmlFor="reset-email">Work email</label>
              <input
                id="reset-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                placeholder="you@company.com"
                required
              />
            </div>

            <PasswordField
              id="reset-current"
              label="Current password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              show={showCurrent}
              onToggleShow={() => setShowCurrent((v) => !v)}
            />

            <PasswordField
              id="reset-new"
              label="New password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              show={showNew}
              onToggleShow={() => setShowNew((v) => !v)}
            />

            <PasswordField
              id="reset-confirm"
              label="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              show={showConfirm}
              onToggleShow={() => setShowConfirm((v) => !v)}
            />

            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}

            <button className="btn" disabled={busy} type="submit">
              {busy ? 'Updating…' : 'Update password'}
            </button>

            <p className="login-hint">
              If you do not know your current password, ask an administrator to reset it.
            </p>

            <p className="login-switch">
              <button type="button" className="login-link" onClick={() => switchMode('signin')}>
                Back to sign in
              </button>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
