import { useState } from 'react';

function EyeIcon({ hidden }) {
  if (hidden) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
        <path d="M3 3l18 18" strokeLinecap="round" />
        <path
          d="M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.1A9.8 9.8 0 0 1 12 5c5 0 8.5 4.5 9.5 6-.4.6-1.1 1.6-2.2 2.7M6.1 6.1C4.2 7.5 2.9 9.3 2.5 11c1 1.5 4.5 6 9.5 6 1.2 0 2.3-.2 3.3-.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6S2.5 12 2.5 12Z" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}

function PasswordField({ id, label, value, onChange, autoComplete, show, onToggle }) {
  return (
    <div className="ll-field">
      <label htmlFor={id}>{label}</label>
      <div className="ll-input-wrap">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          required
        />
        <button
          type="button"
          className="ll-eye"
          onClick={onToggle}
          aria-label={show ? 'Hide password' : 'Show password'}
          aria-pressed={show}
        >
          <EyeIcon hidden={show} />
        </button>
      </div>
    </div>
  );
}

/**
 * Frosted-glass auth panel — styles are CSS-scoped under .lamp-login.
 */
export default function LoginGlassCard({
  mode,
  onModeChange,
  email,
  setEmail,
  password,
  setPassword,
  currentPassword,
  setCurrentPassword,
  newPassword,
  setNewPassword,
  confirmPassword,
  setConfirmPassword,
  rememberMe,
  setRememberMe,
  busy,
  error,
  success,
  onSignIn,
  onReset,
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  if (mode === 'reset') {
    return (
      <form
        className="ll-card"
        onSubmit={onReset}
        data-allow-autocomplete="login"
        autoComplete="on"
        aria-labelledby="reset-heading"
      >
        <h2 id="reset-heading">Reset password</h2>
        <p className="ll-card-lead">
          Confirm your current password, then choose a new one (at least 12 characters).
        </p>

        <div className="ll-fields">
          <div className="ll-field">
            <label htmlFor="reset-email">Username</label>
            <div className="ll-input-wrap">
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
          </div>
          <PasswordField
            id="reset-current"
            label="Current password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            show={showCurrent}
            onToggle={() => setShowCurrent((v) => !v)}
          />
          <PasswordField
            id="reset-new"
            label="New password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            show={showNew}
            onToggle={() => setShowNew((v) => !v)}
          />
          <PasswordField
            id="reset-confirm"
            label="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            show={showConfirm}
            onToggle={() => setShowConfirm((v) => !v)}
          />
        </div>

        {error ? (
          <p className="ll-error" role="alert">
            {error}
          </p>
        ) : null}

        <button className="ll-submit" type="submit" disabled={busy}>
          {busy ? 'Updating…' : 'Update password'}
        </button>

        <p className="ll-footer-link">
          <button type="button" className="ll-link" onClick={() => onModeChange('signin')}>
            Back to sign in
          </button>
        </p>
      </form>
    );
  }

  return (
    <form
      className="ll-card"
      onSubmit={onSignIn}
      data-allow-autocomplete="login"
      autoComplete="on"
      aria-labelledby="login-heading"
    >
      <h2 id="login-heading">Welcome Back</h2>
      <p className="ll-card-lead">Sign in to continue to your workspace.</p>

      <div className="ll-fields">
        <div className="ll-field">
          <label htmlFor="login-email">Username</label>
          <div className="ll-input-wrap">
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
        </div>
        <PasswordField
          id="login-password"
          label="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          show={showPassword}
          onToggle={() => setShowPassword((v) => !v)}
        />
      </div>

      <div className="ll-row">
        <label className="ll-remember">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
          />
          Remember Me
        </label>
        <button type="button" className="ll-link" onClick={() => onModeChange('reset')}>
          Forgot Password
        </button>
      </div>

      {success ? (
        <p className="ll-success" role="status">
          {success}
        </p>
      ) : null}
      {error ? (
        <p className="ll-error" role="alert">
          {error}
        </p>
      ) : null}

      <button className="ll-submit" type="submit" disabled={busy}>
        {busy ? 'Signing in…' : 'Login'}
      </button>
    </form>
  );
}
