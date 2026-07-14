import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../shared/auth.jsx';

export default function LoginPage() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState('admin@dhub.local');
  const [password, setPassword] = useState('Admin@12345');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const onSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email, password);
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
          <p className="brand-mark">DHub</p>
        </div>
        <div className="login-hero-inner">
          <h1>Onboard devices, get them signed, then verify them.</h1>
          <p>
            Asset Inventory, Document Hub, and Asset Verification — one sequence for the full
            lifecycle.
          </p>
        </div>
      </aside>

      <div className="login-panel">
        <form className="card login-card" onSubmit={onSubmit} aria-labelledby="login-heading">
          <p className="login-kicker">Welcome back</p>
          <h2 id="login-heading">Sign in</h2>
          <p>Use your work email to continue to Device Hub.</p>

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
          <div className="field">
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="btn" disabled={busy} type="submit">
            {busy ? 'Signing in…' : 'Continue'}
          </button>
          <p className="login-hint">
            Demo: admin@dhub.local · manager@dhub.local · verifier@dhub.local —
            Admin@12345
          </p>
        </form>
      </div>
    </div>
  );
}
