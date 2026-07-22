import { useEffect } from 'react';

export const AUTO_DISMISS_MS = 2500;

export function useAutoDismiss(value, onDismiss, delayMs = AUTO_DISMISS_MS) {
  useEffect(() => {
    if (!value) return undefined;

    const timer = window.setTimeout(onDismiss, delayMs);
    return () => window.clearTimeout(timer);
  }, [value, onDismiss, delayMs]);
}
