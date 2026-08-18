import { describe, expect, it, vi } from 'vitest';
import {
  createSyncQuotaGuard,
  isSyncQuotaGuardBlockedError,
  SyncQuotaGuardBlockedError,
} from '../services/firebase/syncQuotaGuard';

describe('sync quota guard', () => {
  it('allows three writes and blocks the fourth without consuming it', () => {
    const guard = createSyncQuotaGuard({ enabled: true, limit: 3, windowMs: 60_000, now: () => 1000 });
    expect(guard.allow()).toBe(true);
    guard.consume();
    guard.consume();
    guard.consume();
    expect(guard.allow()).toBe(false);
    expect(() => guard.consume()).toThrow(SyncQuotaGuardBlockedError);
    expect(guard.getCount()).toBe(3);
  });

  it('does not call the writer when the guard blocks', () => {
    const writer = vi.fn();
    const guard = createSyncQuotaGuard({ enabled: true, limit: 1, now: () => 1000 });
    guard.consume();
    writer();
    try {
      guard.consume();
    } catch (error) {
      expect(isSyncQuotaGuardBlockedError(error)).toBe(true);
    }
    expect(writer).toHaveBeenCalledTimes(1);
  });

  it('allows a write after the rolling window expires', () => {
    let now = 1000;
    const guard = createSyncQuotaGuard({ enabled: true, limit: 1, windowMs: 60_000, now: () => now });
    guard.consume();
    now = 61_001;
    expect(guard.allow()).toBe(true);
    guard.consume();
    expect(guard.getCount()).toBe(1);
  });

  it('keeps production behavior unbounded when disabled', () => {
    const guard = createSyncQuotaGuard({ enabled: false, limit: 1 });
    guard.consume();
    guard.consume();
    expect(guard.getCount()).toBe(0);
  });
});
