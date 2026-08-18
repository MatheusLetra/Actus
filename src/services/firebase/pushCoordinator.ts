export interface PushCoordinatorState {
  acknowledged: string | null;
  writing: string | null;
  pending: string | null;
}

export interface PushCoordinator<T> {
  request(payload: T, metadata?: PushRequestMetadata): void;
  retry(): void;
  reset(): void;
  acknowledge(payload: T): void;
  getState(): PushCoordinatorState;
}

export interface PushRequestMetadata {
  source?: string;
  reason?: string;
  forceAcknowledged?: boolean;
}

interface PushItem<T> {
  payload: T;
  serialized: string;
  metadata: PushRequestMetadata;
}

interface PushCoordinatorDiagnostics {
  log: (event: 'PUSH_ENQUEUED' | 'PUSH_START' | 'PUSH_SUCCESS' | 'PUSH_ERROR', metadata?: Record<string, unknown> | (() => Record<string, unknown>)) => void;
}

interface PushCoordinatorOptions<T> {
  serialize: (payload: T) => string;
  write: (payload: T, metadata?: PushRequestMetadata) => Promise<T | void>;
  onSettled?: () => void;
  diagnostics?: PushCoordinatorDiagnostics;
  diagnosticFingerprint?: (payload: T) => string;
}

export function createPushCoordinator<T>({ serialize, write, onSettled, diagnostics, diagnosticFingerprint }: PushCoordinatorOptions<T>): PushCoordinator<T> {
  let acknowledged: PushItem<T> | null = null;
  let writing: PushItem<T> | null = null;
  let pending: PushItem<T> | null = null;
  let latestRequestedSerialized: string | null = null;
  let processing = false;
  let active = true;
  let generation = 0;

  const diagnosticPayload = (item: PushItem<T> | null) => (
    item ? (diagnosticFingerprint ? diagnosticFingerprint(item.payload) : item.serialized) : undefined
  );

  const process = async () => {
    if (!active || processing || !pending) return;

    const item = pending;
    pending = null;
    if (acknowledged?.serialized === item.serialized && !item.metadata.forceAcknowledged) {
      onSettled?.();
      if (pending) void process();
      return;
    }

    const itemGeneration = generation;
    writing = item;
    processing = true;
    let succeeded = false;

    diagnostics?.log('PUSH_START', () => ({
      payload: diagnosticPayload(item),
      source: item.metadata.source,
      reason: item.metadata.reason,
      acknowledged: diagnosticPayload(acknowledged),
      pending: diagnosticPayload(pending),
    }));

    try {
      const confirmedPayload = await write(item.payload, item.metadata);
      succeeded = true;
      if (itemGeneration === generation && active) {
        const payload = confirmedPayload === undefined ? item.payload : confirmedPayload;
        acknowledged = { payload, serialized: serialize(payload), metadata: item.metadata };
      }
      diagnostics?.log('PUSH_SUCCESS', () => ({
        payload: diagnosticPayload(item),
        source: item.metadata.source,
        acknowledged: diagnosticPayload(item),
      }));
    } catch (error) {
      diagnostics?.log('PUSH_ERROR', () => ({
        payload: diagnosticPayload(item),
        source: item.metadata.source,
        acknowledged: diagnosticPayload(acknowledged),
        pending: diagnosticPayload(pending),
      }));
      if (itemGeneration === generation && active && !pending && latestRequestedSerialized === item.serialized) {
        pending = item;
      }
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
    request(payload, metadata = {}) {
      active = true;
      const serialized = serialize(payload);
      latestRequestedSerialized = serialized;
      if (writing?.serialized === serialized
        || (acknowledged?.serialized === serialized && !metadata.forceAcknowledged)) {
        pending = null;
        return;
      }
      pending = { payload, serialized, metadata };
      diagnostics?.log('PUSH_ENQUEUED', () => ({
        payload: diagnosticFingerprint ? diagnosticFingerprint(payload) : serialized,
        source: metadata.source,
        reason: metadata.reason,
        acknowledged: diagnosticPayload(acknowledged),
        writing: diagnosticPayload(writing),
        pending: diagnosticFingerprint ? diagnosticFingerprint(payload) : serialized,
      }));
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
      acknowledged = { payload, serialized, metadata: { source: 'initial_sync' } };
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
