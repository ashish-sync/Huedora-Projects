import { Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { api } from '../../../shared/api.js';
import { useAuth } from '../../../shared/auth.jsx';
import LoginGlassCard from './LoginGlassCard.jsx';
import TyloLoginLogo from './TyloLoginLogo.jsx';
import HealthcareNetworkArt from './HealthcareNetworkArt.jsx';
import './lamp-login.css';

const REMEMBER_KEY = 'tylo-lamp-login-email';

/**
 * TYLO One login — light enterprise split layout.
 * Left brand panel · right sign-in card. Auth logic unchanged.
 */
export default function LampLoginPage() {
  const { user, login } = useAuth();
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBER_KEY);
      if (saved) {
        setEmail(saved);
        setRememberMe(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  if (user) return <Navigate to="/" replace />;

  const switchMode = (next) => {
    setMode(next);
    setError('');
    setSuccess('');
  };

  const onSignIn = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      try {
        if (rememberMe) localStorage.setItem(REMEMBER_KEY, email.trim());
        else localStorage.removeItem(REMEMBER_KEY);
      } catch {
        /* ignore */
      }
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
    <div className="login-page lamp-login">
      <div className="ll-stage">
        <section className="ll-brand-col" aria-label="TYLO One">
          <div className="ll-brand-inner">
            <TyloLoginLogo />
            <div className="ll-brand-copy">
              <h1 className="ll-headline">Unified Healthcare Operations</h1>
              <p className="ll-sub">
                One secure workspace for camps, finance, logistics, documents, and field teams —
                built for healthcare at scale.
              </p>
            </div>
            <HealthcareNetworkArt />
          </div>
        </section>

        <section className="ll-auth-col" aria-label="Sign in">
          <div className="ll-card-shell">
            <LoginGlassCard
              mode={mode}
              onModeChange={switchMode}
              email={email}
              setEmail={setEmail}
              password={password}
              setPassword={setPassword}
              currentPassword={currentPassword}
              setCurrentPassword={setCurrentPassword}
              newPassword={newPassword}
              setNewPassword={setNewPassword}
              confirmPassword={confirmPassword}
              setConfirmPassword={setConfirmPassword}
              rememberMe={rememberMe}
              setRememberMe={setRememberMe}
              busy={busy}
              error={error}
              success={success}
              onSignIn={onSignIn}
              onReset={onReset}
            />
          </div>
        </section>
      </div>

      <footer className="ll-legal">
        <span>© 2026 Tylo Care Pvt. Ltd.</span>
        <span className="ll-legal-sep" aria-hidden="true">
          |
        </span>
        <a href="#privacy">Privacy</a>
        <span className="ll-legal-sep" aria-hidden="true">
          |
        </span>
        <a href="#support">Support</a>
      </footer>
    </div>
  );
}
