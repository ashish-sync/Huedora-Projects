import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import BrandLogo from '../../../components/BrandLogo.jsx';
import { api } from '../../../shared/api.js';
import { useAuth } from '../../../shared/auth.jsx';
import Flashlight from './Flashlight.jsx';
import LoginGlassCard from './LoginGlassCard.jsx';
import './lamp-login.css';

const REMEMBER_KEY = 'tylo-lamp-login-email';

/**
 * Dark-room login: flashlight beam reveals the frosted glass sign-in card.
 */
export default function LampLoginPage() {
  const { user, login } = useAuth();
  const [torchOn, setTorchOn] = useState(false);
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
      <div className={`ll-veil ${torchOn ? 'is-on' : ''}`} aria-hidden="true" />
      <div className={`ll-wash ${torchOn ? 'is-on' : ''}`} aria-hidden="true" />
      <div className="ll-noise" aria-hidden="true" />

      <div className="ll-stage">
        <section className="ll-brand-col" aria-label="TYLO One">
          <div className="ll-brand-lockup">
            <BrandLogo className="ll-brand-logo" size={48} />
            <div className="ll-brand-lockup-text">
              <strong className="brand-wordmark brand-wordmark--ll-hero">
                TYLO <span>One</span>
              </strong>
              <p className="ll-kicker">Mission Control</p>
            </div>
          </div>

          <div className="ll-brand-copy">
            <h1 className="ll-headline">
              <span className="ll-headline-line">Powering End-to-End</span>
              <span className="ll-headline-line">Healthcare Activation</span>
            </h1>
            <p className="ll-sub">
              Manage assets, documents, camps, requests, logistics, and more.
            </p>
          </div>

          <Flashlight on={torchOn} onToggle={() => setTorchOn((v) => !v)} />

          <p className="ll-signature">TYLO One · Healthcare Operations Platform.</p>
        </section>

        <div
          className={`ll-card-shell ${torchOn ? 'is-on' : 'is-off'}`}
          aria-hidden={!torchOn}
        >
          <div {...(!torchOn ? { inert: true } : {})}>
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
        </div>
      </div>
    </div>
  );
}
