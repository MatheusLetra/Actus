import { describe, expect, it } from 'vitest';
import { createSyncDiagnostics, fingerprint } from '../services/firebase/syncDiagnostics';

describe('sync diagnostics fingerprints', () => {
  it('keeps the same object stable', () => {
    expect(fingerprint({ a: 1, nested: { b: true } })).toEqual(fingerprint({ a: 1, nested: { b: true } }));
  });

  it('ignores object property order only in the canonical hash', () => {
    const first = fingerprint({ a: 1, b: { c: 2, d: 3 } });
    const second = fingerprint({ b: { d: 3, c: 2 }, a: 1 });
    expect(first.canonical).toBe(second.canonical);
    expect(first.raw).not.toBe(second.raw);
  });

  it('preserves array order in both hashes', () => {
    expect(fingerprint([1, 2]).canonical).not.toBe(fingerprint([2, 1]).canonical);
  });

  it('normalizes undefined and absent fields but preserves null', () => {
    expect(fingerprint({ value: undefined }).canonical).toBe(fingerprint({}).canonical);
    expect(fingerprint({ value: null }).canonical).not.toBe(fingerprint({}).canonical);
    expect(fingerprint({ value: undefined }).canonical).not.toBe(fingerprint({ value: null }).canonical);
    expect(fingerprint({ value: undefined }).raw).not.toBe(fingerprint({}).raw);
  });

  it('handles nested Project, KanbanTask and Pomodoro fields without exposing values', () => {
    const value = {
      projects: [{ id: 'project_1', name: 'private', updatedAt: '2026-01-01' }],
      task: { id: 'task_1', projectId: null },
      session: { id: 'pomo_1', endAt: undefined },
    };
    const result = fingerprint(value);
    expect(result.raw).toMatch(/^[0-9a-f]{8}$/);
    expect(result.canonical).toMatch(/^[0-9a-f]{8}$/);
    expect(result.raw).not.toContain('private');
  });

  it('does not log or sequence events when disabled', () => {
    const output: string[] = [];
    const diagnostics = createSyncDiagnostics({ enabled: false, output: (line) => output.push(line) });
    diagnostics.log('LOCAL_CHANGED', { privateValue: 'not logged' });
    expect(output).toEqual([]);
  });
});
