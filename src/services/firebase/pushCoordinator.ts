export interface PushCoordinatorState {
  acknowledged: string | null;
  writing: string | null;
  pending: string | null;
}

export interface PushCoordinator<T> {
  request(payload: T): void;
  retry(): void;
  reset(): void;
  acknowledge(payload: T): void;
  getState(): PushCoordinatorState;
}

interface PushCoordinatorOptions<T> {
  serialize: (payload: T) => string;
  write: (payload: T) => Promise<void>;
  onSettled?: () => void;
}

export function createPushCoordinator<T>({ serialize, write, onSettled }: PushCoordinatorOptions<T>): PushCoordinator<T> {
  let acknowledged: { payload: T; serialized: string } | null = null;
  let writing: { payload: T; serialized: string } | null = null;
  let pending: { payload: T; serialized: string } | null = null;
  let latestRequestedSerialized: string | null = null;
  let processing = false;
  let active = true;
  let generation = 0;

  const process = async () => {
    if (!active || processing || !pending) return;

    const item = pending;
    pending = null;
    if (acknowledged?.serialized === item.serialized) {
      onSettled?.();
      if (pending) void process();
      return;
    }

    const itemGeneration = generation;
    writing = item;
    processing = true;
    let succeeded = false;

    try {
      await write(item.payload);
      succeeded = true;
      if (itemGeneration === generation && active) acknowledged = item;
    } catch {
      if (itemGeneration === generation && active && !pending && latestRequestedSerialized === item.serialized) pending = item;
    } finally {
      if (itemGeneration === generation) {
        writing = null;
        processing = false;
        onSettled?.();
        if (succeeded && pending) void process();
      } else {
        processing = false;
        if (active && pending) void process();
      }
    }
  };

  return {
    request(payload) {
      active = true;
      const serialized = serialize(payload);
      latestRequestedSerialized = serialized;
      if (acknowledged?.serialized === serialized || writing?.serialized === serialized) {
        pending = null;
        return;
      }
      pending = { payload, serialized };
      void process();
    },

    retry() {
      active = true;
      void process();
    },

    reset() {
      active = false;
      generation += 1;
      acknowledged = null;
      writing = null;
      pending = null;
      latestRequestedSerialized = null;
    },

    acknowledge(payload) {
      const serialized = serialize(payload);
      acknowledged = { payload, serialized };
      latestRequestedSerialized = serialized;
      if (pending?.serialized === serialized) pending = null;
    },

    getState() {
      return {
        acknowledged: acknowledged?.serialized ?? null,
        writing: writing?.serialized ?? null,
        pending: pending?.serialized ?? null,
      };
    },
  };
}
