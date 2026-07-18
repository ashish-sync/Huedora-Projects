import { useCallback, useEffect, useState } from 'react';
import { checkServerLive } from '../shared/api.js';

/**
 * Blocks the app behind a loading screen until the API liveness check succeeds.
 */
export default function ServerGate({ children }) {
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [attempt, setAttempt] = useState(0);

  const probe = useCallback(async () => {
    setStatus('loading');
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12000);
    try {
      await checkServerLive({ signal: controller.signal });
      setStatus('ready');
    } catch {
      setStatus('error');
    } finally {
      window.clearTimeout(timeout);
    }
  }, []);

  useEffect(() => {
    probe();
  }, [probe, attempt]);

  if (status === 'ready') return children;

  return (
    <div className="boot-gate" role="status" aria-live="polite" aria-busy={status === 'loading'}>
      <div className="boot-gate-card">
        <img
          className="boot-gate-logo"
          src="/tylo-one-logo.png"
          alt="TYLO One"
          width="88"
          height="88"
        />
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
              TYLO One is temporarily unavailable. Try again in a moment.
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
