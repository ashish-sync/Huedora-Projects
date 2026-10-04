/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import {
  NOTIFICATION_BACKGROUND_MIN_GAP_MS,
  NOTIFICATION_POLL_MS,
  NOTIFICATION_VISIBLE_MIN_GAP_MS,
  shouldSkipNotificationPoll,
} from './notificationPoll.js';

describe('notificationPoll gaps', () => {
  it('uses 180s poll interval and 45s visible gap', () => {
    expect(NOTIFICATION_POLL_MS).toBe(180_000);
    expect(NOTIFICATION_VISIBLE_MIN_GAP_MS).toBe(45_000);
    expect(NOTIFICATION_BACKGROUND_MIN_GAP_MS).toBe(5_000);
  });

  it('allows the first poll when lastPollAt is unset', () => {
    expect(shouldSkipNotificationPoll({ now: 1000, lastPollAt: 0, force: true })).toBe(false);
  });

  it('skips force refresh inside the 45s visible gap', () => {
    const last = 100_000;
    expect(
      shouldSkipNotificationPoll({
        now: last + 10_000,
        lastPollAt: last,
        force: true,
        documentHidden: false,
      }),
    ).toBe(true);
    expect(
      shouldSkipNotificationPoll({
        now: last + 46_000,
        lastPollAt: last,
        force: true,
      }),
    ).toBe(false);
  });

  it('skips background/focus refresh inside the 5s gap but not after', () => {
    const last = 100_000;
    expect(
      shouldSkipNotificationPoll({
        now: last + 2_000,
        lastPollAt: last,
        force: false,
      }),
    ).toBe(true);
    expect(
      shouldSkipNotificationPoll({
        now: last + 6_000,
        lastPollAt: last,
        force: false,
      }),
    ).toBe(false);
  });

  it('skips hidden-tab background polls but allows forced ones after gap', () => {
    expect(
      shouldSkipNotificationPoll({
        now: 200_000,
        lastPollAt: 100_000,
        force: false,
        documentHidden: true,
      }),
    ).toBe(true);
    expect(
      shouldSkipNotificationPoll({
        now: 200_000,
        lastPollAt: 100_000,
        force: true,
        documentHidden: true,
      }),
    ).toBe(false);
  });

  it('does not schedule duplicate interval ticks faster than POLL_MS', () => {
    // Interval fires at 0 and 180s; a focus at +10s must be skipped by 5s? No — 10s > 5s so focus runs.
    // Duplicate protection: two force calls 1s apart after a poll must skip the second.
    const t0 = 1_000_000;
    expect(shouldSkipNotificationPoll({ now: t0, lastPollAt: 0, force: true })).toBe(false);
    expect(
      shouldSkipNotificationPoll({
        now: t0 + 1_000,
        lastPollAt: t0,
        force: true,
      }),
    ).toBe(true);
    expect(
      shouldSkipNotificationPoll({
        now: t0 + NOTIFICATION_POLL_MS,
        lastPollAt: t0,
        force: false,
      }),
    ).toBe(false);
  });
});
