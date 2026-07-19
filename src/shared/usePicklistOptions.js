import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';

/**
 * Load static + approved options for a picklist key.
 * Pass fallbackOptions as a stable module-level constant when possible.
 */
export function usePicklistOptions(picklistKey, fallbackOptions = []) {
  const [options, setOptions] = useState(() => fallbackOptions);
  const [otherLabel, setOtherLabel] = useState('Other');
  const [loading, setLoading] = useState(Boolean(picklistKey));
  const [error, setError] = useState('');

  const reload = useCallback(() => {
    if (!picklistKey) {
      setOptions(fallbackOptions);
      setLoading(false);
      return Promise.resolve(fallbackOptions);
    }
    setLoading(true);
    setError('');
    return api(`/picklists/${encodeURIComponent(picklistKey)}`)
      .then((r) => {
        const opts = r.data?.options || fallbackOptions;
        setOptions(opts);
        setOtherLabel(r.data?.otherLabel || 'Other');
        return opts;
      })
      .catch((e) => {
        setError(e.message);
        setOptions(fallbackOptions);
        return fallbackOptions;
      })
      .finally(() => setLoading(false));
    // fallbackOptions intentionally omitted — callers should use stable arrays
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picklistKey]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { options, otherLabel, loading, error, reload };
}

export async function submitPicklistSuggestion(picklistKey, value, source = '') {
  const trimmed = String(value || '').trim();
  if (!picklistKey || !trimmed) return null;
  return api('/picklists/suggestions', {
    method: 'POST',
    body: { picklistKey, value: trimmed, source },
  });
}
