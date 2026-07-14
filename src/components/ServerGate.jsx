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
        <p className="brand-mark boot-gate-brand">DHub</p>
        {status === 'loading' ? (
          <>
            <div className="boot-gate-spinner" aria-hidden="true" />
            <h1>Hold tight</h1>
            <p className="muted">We're getting things ready for you. This will only take a moment.</p>
            <p className="boot-gate-footnote">We&rsquo;ll be right with you.</p>
          </>
        ) : (
          <>
            <div className="boot-gate-icon" aria-hidden="true" />
            <h1>We&rsquo;ll be right back</h1>
            <p className="muted">
              Device Hub is taking a short pause. Hold tight — try again in a moment.
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
