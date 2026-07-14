import { useCallback, useEffect, useState } from 'react';
import { checkServerLive } from '../shared/api.js';

/**
 * Blocks the app behind a loading screen until the API liveness check succeeds.
 */
export default function ServerGate({ children }) {
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  const probe = useCallback(async () => {
    setStatus('loading');
    setError('');
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12000);
    try {
      await checkServerLive({ signal: controller.signal });
      setStatus('ready');
    } catch (err) {
      const message =
        err?.name === 'AbortError'
          ? 'Server did not respond in time.'
          : err?.message || 'Could not reach the server.';
      setError(message);
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
            <h1>Connecting to server…</h1>
            <p className="muted">Please wait while we confirm the API is live.</p>
          </>
        ) : (
          <>
            <h1>Server unavailable</h1>
            <p className="muted">{error}</p>
            <button
              type="button"
              className="btn"
              onClick={() => setAttempt((n) => n + 1)}
            >
              Retry
            </button>
          </>
        )}
      </div>
    </div>
  );
}
