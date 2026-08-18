export class SyncQuotaGuardBlockedError extends Error {
  readonly code = 'sync-diagnostics-quota-blocked';
  readonly count: number;
  readonly windowMs: number;

  constructor(count: number, windowMs: number) {
    super('Firebase write blocked by the development sync quota guard.');
    this.count = count;
    this.windowMs = windowMs;
  }
}

export function isSyncQuotaGuardBlockedError(error: unknown): error is SyncQuotaGuardBlockedError {
  return error instanceof SyncQuotaGuardBlockedError;
}

export interface SyncQuotaGuardOptions {
  enabled: boolean;
  limit?: number;
  windowMs?: number;
  now?: () => number;
  onBlocked?: (details: { count: number; limit: number; windowMs: number }) => void;
}

export function createSyncQuotaGuard({
  enabled,
  limit = 3,
  windowMs = 60_000,
  now = Date.now,
  onBlocked,
}: SyncQuotaGuardOptions) {
  const writes: number[] = [];

  const prune = () => {
    const threshold = now() - windowMs;
    while (writes[0] !== undefined && writes[0] <= threshold) writes.shift();
  };

  return {
    allow(): boolean {
      if (!enabled) return true;
      prune();
      return writes.length < limit;
    },
    consume(): void {
      if (!enabled) return;
      prune();
      if (writes.length >= limit) {
        onBlocked?.({ count: writes.length + 1, limit, windowMs });
        throw new SyncQuotaGuardBlockedError(writes.length + 1, windowMs);
      }
      writes.push(now());
    },
    getCount(): number {
      prune();
      return writes.length;
    },
    reset(): void {
      writes.length = 0;
    },
  };
}
