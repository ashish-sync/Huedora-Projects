import { useEffect, useState } from 'react';

/**
 * Returns `value` after it has stayed unchanged for `delayMs`.
 * Use for search boxes that trigger network loads.
 */
export function useDebouncedValue(value, delayMs = 300) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
