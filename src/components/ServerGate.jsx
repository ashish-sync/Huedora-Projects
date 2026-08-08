import { useEffect, useState } from 'react';
import BrandLogo from './BrandLogo.jsx';
import { API_BASE, checkServerLive } from '../shared/api.js';

/**
 * Overlays a connecting / error screen while probing the API.
 * Children mount immediately so AuthProvider can call /auth/me in parallel with /live.
 */
export default function ServerGate({ children }) {
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const maxAttempts = 4;

    const probe = async () => {
      setStatus('loading');
      for (let i = 1; i <= maxAttempts; i += 1) {
        if (cancelled) return;
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 8000);
        try {
          await checkServerLive({ signal: controller.signal });
          if (!cancelled) setStatus('ready');
          return;
        } catch {
          if (cancelled) return;
          if (i < maxAttempts) {
            await new Promise((resolve) => window.setTimeout(resolve, Math.min(i * 1200, 3000)));
          }
        } finally {
          window.clearTimeout(timeout);
        }
      }
      if (!cancelled) setStatus('error');
    };

    probe();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  return (
    <>
      {children}
      {status !== 'ready' ? (
        <div
          className="boot-gate"
          role="status"
          aria-live="polite"
          aria-busy={status === 'loading'}
        >
          <div className="boot-gate-card">
            <BrandLogo className="boot-gate-logo" size={88} />
            <p className="brand-wordmark brand-wordmark--gate">
              TYLO <span>One</span>
            </p>
            {status === 'loading' ? (
              <>
                <div className="boot-gate-spinner" aria-hidden="true" />
                <h1>Connecting</h1>
                <p className="muted">Checking server availability.</p>
                <p className="boot-gate-footnote">Please wait.</p>
              </>
            ) : (
              <>
                <h1>Unable to connect</h1>
                <p className="muted">
                  TYLO One could not reach the API at <code>{API_BASE}</code>.
                  <br />
                  If you are running locally, start the server with <code>npm run dev:server</code> or{' '}
                  <code>npm run dev</code> from the project root.
                </p>
                <button type="button" className="btn" onClick={() => setAttempt((n) => n + 1)}>
                  Try again
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
