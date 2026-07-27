import { useEffect, useState } from 'react';
import BrandLogo from './BrandLogo.jsx';
import { API_BASE, checkServerLive } from '../shared/api.js';

/**
 * Blocks the app behind a loading screen until the API liveness check succeeds.
 */
export default function ServerGate({ children }) {
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const maxAttempts = 6;

    const probe = async () => {
      setStatus('loading');
      for (let i = 1; i <= maxAttempts; i += 1) {
        if (cancelled) return;
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 15000);
        try {
          await checkServerLive({ signal: controller.signal });
          if (!cancelled) setStatus('ready');
          return;
        } catch {
          if (cancelled) return;
          if (i < maxAttempts) {
            await new Promise((resolve) => window.setTimeout(resolve, i * 2000));
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

  if (status === 'ready') return children;

  return (
    <div className="boot-gate" role="status" aria-live="polite" aria-busy={status === 'loading'}>
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
  );
}
