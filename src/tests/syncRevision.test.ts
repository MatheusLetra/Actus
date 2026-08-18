import { describe, expect, it } from 'vitest';
import { getManifestRevision, isSyncManifest, manifestMatchesBase } from '../services/firebase/syncService';

function manifest(currentRevision: string, previousRevision: string | null = null) {
  return {
    formatVersion: 2 as const,
    currentRevision,
    previousRevision,
    publishedAt: 1,
    shardMonths: { completions: ['2026-01'], pomodoro: ['2026-01'] },
  };
}

describe('versioned Firebase revision protocol', () => {
  it('validates a complete manifest and rejects incomplete metadata', () => {
    expect(isSyncManifest(manifest('R1'))).toBe(true);
    expect(isSyncManifest({ ...manifest('R1'), shardMonths: { completions: [], pomodoro: [] } })).toBe(true);
    expect(isSyncManifest({ formatVersion: 2, currentRevision: 'R1' })).toBe(false);
    expect(getManifestRevision(manifest('R2', 'R1'))).toBe('R2');
  });

  it('models CAS winner and loser behavior without changing Firebase state', () => {
    let current: unknown = manifest('R1');
    const publish = (expected: string, next: string): boolean => {
      if (!manifestMatchesBase(current, expected)) return false;
      current = manifest(next, expected);
      return true;
    };

    expect(publish('R1', 'RA')).toBe(true);
    expect(publish('R1', 'RB')).toBe(false);
    expect(publish('RA', 'RC')).toBe(true);
    expect(getManifestRevision(current)).toBe('RC');
  });

  it('treats a missing manifest as the legacy base only', () => {
    expect(manifestMatchesBase(null, null)).toBe(true);
    expect(manifestMatchesBase(null, 'R1')).toBe(false);
  });
});
