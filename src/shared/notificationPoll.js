/** Background badge poll interval (Layout). */
export const NOTIFICATION_POLL_MS = 180_000;
/** Min gap for force/visibility refreshes. */
export const NOTIFICATION_VISIBLE_MIN_GAP_MS = 45_000;
/** Min gap for background interval / window focus. */
export const NOTIFICATION_BACKGROUND_MIN_GAP_MS = 5_000;

/**
 * Decide whether Layout should skip a badge poll to avoid duplicate traffic.
 */
export function shouldSkipNotificationPoll({
  now = Date.now(),
  lastPollAt = 0,
  force = false,
  documentHidden = false,
} = {}) {
  if (documentHidden && !force) return true;
  if (!lastPollAt) return false;
  const minGap = force ? NOTIFICATION_VISIBLE_MIN_GAP_MS : NOTIFICATION_BACKGROUND_MIN_GAP_MS;
  return now - lastPollAt < minGap;
}
