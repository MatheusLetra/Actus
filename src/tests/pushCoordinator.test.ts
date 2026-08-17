import { describe, expect, it } from 'vitest';
import { createPushCoordinator } from '../services/firebase/pushCoordinator';

function deferred() {
  let resolve!: () => void;
  let reject!: () => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function settle() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('pushCoordinator', () => {
  it('acknowledges T2 and then publishes pending T3', async () => {
    const first = deferred();
    const writes: string[] = [];
    const coordinator = createPushCoordinator({
      serialize: (value: string) => value,
      write: async (value: string) => {
        writes.push(value);
        if (value === 'T2') await first.promise;
      },
    });

    coordinator.request('T2');
    await settle();
    coordinator.request('T3');
    expect(coordinator.getState()).toEqual({ acknowledged: null, writing: 'T2', pending: 'T3' });

    first.resolve();
    await settle();
    await settle();

    expect(writes).toEqual(['T2', 'T3']);
    expect(coordinator.getState()).toEqual({ acknowledged: 'T3', writing: null, pending: null });
  });

  it('coalesces T3 and T4 while T2 is writing', async () => {
    const first = deferred();
    const writes: string[] = [];
    const coordinator = createPushCoordinator({
      serialize: (value: string) => value,
      write: async (value: string) => {
        writes.push(value);
        if (value === 'T2') await first.promise;
      },
    });

    coordinator.request('T2');
    await settle();
    coordinator.request('T3');
    coordinator.request('T4');
    first.resolve();
    await settle();
    await settle();

    expect(writes).toEqual(['T2', 'T4']);
    expect(coordinator.getState()).toEqual({ acknowledged: 'T4', writing: null, pending: null });
  });

  it('keeps a failed payload pending without an automatic retry loop', async () => {
    let attempts = 0;
    const coordinator = createPushCoordinator({
      serialize: (value: string) => value,
      write: async () => {
        attempts += 1;
        throw new Error('resource-exhausted');
      },
    });

    coordinator.request('T2');
    await settle();
    expect(attempts).toBe(1);
    expect(coordinator.getState()).toEqual({ acknowledged: null, writing: null, pending: 'T2' });

    coordinator.retry();
    await settle();
    expect(attempts).toBe(2);
    expect(coordinator.getState()).toEqual({ acknowledged: null, writing: null, pending: 'T2' });
  });

  it('ignores a request equal to the acknowledged payload', async () => {
    let attempts = 0;
    const coordinator = createPushCoordinator({
      serialize: (value: string) => value,
      write: async () => { attempts += 1; },
    });

    coordinator.request('T1');
    await settle();
    coordinator.request('T1');
    await settle();

    expect(attempts).toBe(1);
    expect(coordinator.getState()).toEqual({ acknowledged: 'T1', writing: null, pending: null });
  });

  it('invalidates an old write after reset', async () => {
    const oldWrite = deferred();
    const writes: string[] = [];
    const coordinator = createPushCoordinator({
      serialize: (value: string) => value,
      write: async (value: string) => {
        writes.push(value);
        if (value === 'A') await oldWrite.promise;
      },
    });

    coordinator.request('A');
    await settle();
    coordinator.reset();
    coordinator.request('B');
    oldWrite.resolve();
    await settle();
    await settle();

    expect(writes).toEqual(['A', 'B']);
    expect(coordinator.getState()).toEqual({ acknowledged: 'B', writing: null, pending: null });
  });
});
