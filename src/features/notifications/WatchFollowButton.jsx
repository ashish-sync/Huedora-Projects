import { useCallback, useEffect, useState } from 'react';
import { api } from '../../shared/api.js';

/**
 * Opt-in Watch / Follow for module records.
 * Does not change workflows — only subscription for notification fan-out.
 */
export default function WatchFollowButton({ entityType, entityId, className = '' }) {
  const [watching, setWatching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!entityType || !entityId) return;
    try {
      const res = await api(
        `/entity-watches/status?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}`
      );
      setWatching(Boolean(res.data?.watching));
    } catch {
      /* ignore — user may lack access */
    }
  }, [entityType, entityId]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggle() {
    if (!entityType || !entityId || busy) return;
    setBusy(true);
    setError('');
    try {
      if (watching) {
        await api('/entity-watches', {
          method: 'DELETE',
          body: { entityType, entityId },
        });
        setWatching(false);
      } else {
        await api('/entity-watches', {
          method: 'POST',
          body: { entityType, entityId },
        });
        setWatching(true);
      }
    } catch (e) {
      setError(e.message || 'Could not update watch');
    } finally {
      setBusy(false);
    }
  }

  if (!entityType || !entityId) return null;

  return (
    <span className={`entity-watch ${className}`.trim()}>
      <button
        type="button"
        className={`btn secondary btn-compact entity-watch-btn${watching ? ' is-watching' : ''}`}
        onClick={toggle}
        disabled={busy}
        aria-pressed={watching}
        title={watching ? 'Stop watching this record' : 'Watch this record for updates'}
      >
        {busy ? '…' : watching ? 'Watching' : 'Watch'}
      </button>
      {error ? <span className="error" style={{ marginLeft: 8, fontSize: '0.75rem' }}>{error}</span> : null}
    </span>
  );
}
