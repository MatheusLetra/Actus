import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useHabits } from '@/context/HabitContext';
import { storageService } from '@/repositories/storageService';
import { STORAGE_KEYS } from '@/constants';
import { authService, type SyncUser } from '@/services/firebase/authService';
import { syncService } from '@/services/firebase/syncService';
import { createPushCoordinator, type PushCoordinator, type PushRequestMetadata } from '@/services/firebase/pushCoordinator';
import { isFirebaseConfigured } from '@/services/firebase/config';
import { syncMergeService, SYNC_VERSION, type ActusData, type ActusSnapshot } from '@/services/syncMergeService';
import { syncDiagnostics, summarizeData } from '@/services/firebase/syncDiagnostics';
import { createSyncQuotaGuard, SyncQuotaGuardBlockedError } from '@/services/firebase/syncQuotaGuard';

export type SyncStatus = 'idle' | 'connecting' | 'syncing' | 'signedIn' | 'signingOut';

interface FirebaseContextType {
  status: SyncStatus;
  user: SyncUser | null;
  lastSyncAt: number | null;
  error: string | null;
  isConfigured: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  syncNow: () => Promise<void>;
}

const FirebaseContext = createContext<FirebaseContextType | undefined>(undefined);

const SYNC_DEBOUNCE_MS = 800;

function getErrorMessage(error: unknown): string | null {
  const code = (error as { code?: string })?.code;
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return null;
  return 'Falha ao sincronizar os dados. Verifique sua conexão e tente novamente.';
}

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    categories,
    habits,
    completions,
    pomodoroSettings,
    pomodoroSessions,
    kanbanBoard,
    kanbanColumns,
    kanbanTasks,
    projects,
    tombstones,
    importData,
  } = useHabits();

  const [status, setStatus] = useState<SyncStatus>('idle');
  const [user, setUser] = useState<SyncUser | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(() =>
    storageService.getItem<number>(STORAGE_KEYS.lastSyncAt, -1) > 0
      ? storageService.getItem<number>(STORAGE_KEYS.lastSyncAt, -1)
      : null
  );
  const [error, setError] = useState<string | null>(null);

  const dataRef = useRef<ActusData>({
    version: SYNC_VERSION,
    categories,
    habits,
    completions,
    pomodoroSettings,
    pomodoroSessions,
    kanbanBoard,
    kanbanColumns,
    kanbanTasks,
    projects,
    tombstones,
  });
  dataRef.current = {
    version: SYNC_VERSION,
    categories,
    habits,
    completions,
    pomodoroSettings,
    pomodoroSessions,
    kanbanBoard,
    kanbanColumns,
    kanbanTasks,
    projects,
    tombstones,
  };

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncInProgressRef = useRef(false);
  const unsubscribeWatchRef = useRef<(() => void) | null>(null);
  const activeUidRef = useRef<string | null>(null);
  const sessionGenerationRef = useRef(0);
  const remotePendingRef = useRef<ActusSnapshot | null>(null);
  const remotePendingAvailableRef = useRef(false);
  const onWriteSettledRef = useRef<() => void>(() => undefined);
  const lastWrittenUpdatedAtRef = useRef<number | null>(null);
  const lastStaleRemoteKeyRef = useRef<string | null>(null);
  const remoteAppliedDataRef = useRef<ActusData | null>(null);
  const pushCoordinatorRef = useRef<PushCoordinator<ActusData> | null>(null);
  const quotaGuardRef = useRef<ReturnType<typeof createSyncQuotaGuard> | null>(null);
  if (quotaGuardRef.current === null) {
    quotaGuardRef.current = createSyncQuotaGuard({
      enabled: syncDiagnostics.enabled,
      onBlocked: ({ count, limit, windowMs }) => syncDiagnostics.log('QUOTA_GUARD_BLOCKED', {
        count,
        limit,
        windowMs,
        reason: 'write_snapshot_budget_exhausted',
      }),
    });
  }

  const localSerialized = useMemo(
    () => JSON.stringify({ categories, habits, completions, pomodoroSettings, pomodoroSessions, kanbanBoard, kanbanColumns, kanbanTasks, projects, tombstones }),
    [categories, habits, completions, pomodoroSettings, pomodoroSessions, kanbanBoard, kanbanColumns, kanbanTasks, projects, tombstones]
  );

  const stopWatch = () => {
    if (unsubscribeWatchRef.current) {
      unsubscribeWatchRef.current();
      unsubscribeWatchRef.current = null;
    }
  };

  const cancelPendingPush = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  };

  const isCurrentSession = (uid: string, generation: number) => (
    activeUidRef.current === uid && sessionGenerationRef.current === generation
  );

  const applyToLocal = (data: ActusData) => {
    remoteAppliedDataRef.current = data;
    importData(syncMergeService.dataToJson(data));
  };

  const requestPush = (data: ActusData, source: string, reason: string) => {
    if (source === 'remote_writeback') {
      syncDiagnostics.log('REMOTE_WRITEBACK_REQUESTED', () => ({ payload: summarizeData(data).snapshotHash, source, reason }));
    }
    pushCoordinatorRef.current?.request(data, { source, reason });
  };

  const deferRemoteSnapshot = (remote: ActusSnapshot | null, reason: string) => {
    if (remotePendingAvailableRef.current && remotePendingRef.current && remote) {
      remotePendingRef.current = syncMergeService.mergeSnapshots(remotePendingRef.current, remote);
    } else {
      remotePendingRef.current = remote;
    }
    remotePendingAvailableRef.current = true;
    syncDiagnostics.log('REMOTE_DEFERRED', () => ({
      reason,
      payload: remote ? summarizeData(remote).snapshotHash : 'null',
      pendingPayload: remotePendingRef.current ? summarizeData(remotePendingRef.current).snapshotHash : 'null',
    }));
  };

  const isRemoteEqualToWriting = (remote: ActusSnapshot | null): boolean => {
    if (!remote) return false;
    const writing = pushCoordinatorRef.current?.getState().writing;
    if (!writing) return false;
    const writingData = syncMergeService.buildData(JSON.parse(writing) as Partial<ActusData>);
    return syncMergeService.dataEquals(syncMergeService.snapshotToData(remote), writingData);
  };

  const writeToCloud = async (
    uid: string,
    data: ActusData,
    generation: number,
    source = 'other',
  ): Promise<ActusData> => {
    if (!isCurrentSession(uid, generation)) throw new Error('sync-session-invalidated');
    try {
      if (!syncDiagnostics.writesEnabled) {
        syncDiagnostics.log('QUOTA_GUARD_BLOCKED', {
          reason: 'diagnostic_mode_no_writes',
          source,
          payload: summarizeData(data).snapshotHash,
        });
        throw new SyncQuotaGuardBlockedError(
          (quotaGuardRef.current?.getCount() ?? 0) + 1,
          0,
        );
      }
      quotaGuardRef.current?.consume();
      if (source === 'initial_sync') {
        syncDiagnostics.log('PUSH_START', () => ({
          payload: summarizeData(data).snapshotHash,
          source,
          reason: 'initial_sync',
        }));
      }
      const result = await syncService.publishSnapshot(uid, data);
      if (!syncMergeService.dataEquals(result.data, data)) {
        applyToLocal(result.data);
        dataRef.current = result.data;
      }
      if (result.published) lastWrittenUpdatedAtRef.current = result.publishedAt;
      if (source === 'initial_sync') {
        syncDiagnostics.log('PUSH_SUCCESS', () => ({
          payload: summarizeData(data).snapshotHash,
          source,
          acknowledged: summarizeData(data).snapshotHash,
        }));
      }
      if (!isCurrentSession(uid, generation)) throw new Error('sync-session-invalidated');
      const now = Date.now();
      setLastSyncAt(now);
      setError(null);
      storageService.setItem(STORAGE_KEYS.lastSyncAt, now);
      return result.data;
    } catch (err) {
      if (source === 'initial_sync') {
        syncDiagnostics.log('PUSH_ERROR', () => ({
          payload: summarizeData(data).snapshotHash,
          source,
          code: (err as { code?: string }).code,
        }));
      }
      if (!isCurrentSession(uid, generation)) throw err;
      const message = getErrorMessage(err);
      if (message) setError(message);
      throw err;
    }
  };

  if (pushCoordinatorRef.current === null) {
    pushCoordinatorRef.current = createPushCoordinator<ActusData>({
      serialize: (data) => syncMergeService.dataToJson(data),
      write: async (data, metadata: PushRequestMetadata = {}) => {
        const uid = activeUidRef.current;
        const generation = sessionGenerationRef.current;
        if (!uid) throw new Error('sync-session-invalidated');
        return writeToCloud(uid, data, generation, metadata.source ?? 'other');
      },
      onSettled: () => onWriteSettledRef.current(),
      diagnostics: syncDiagnostics,
      diagnosticFingerprint: (data) => summarizeData(data).snapshotHash,
    });
  }

  const runInitialSync = async (uid: string, generation: number) => {
    if (syncInProgressRef.current) return;
    syncInProgressRef.current = true;
    syncDiagnostics.log('INITIAL_SYNC_START', { generation, uid: maskUid(uid) });
    setStatus('syncing');
    stopWatch();
    cancelPendingPush();
    try {
      const localData = dataRef.current;
      const remote = await syncService.readSnapshot(uid);
      if (!isCurrentSession(uid, generation)) return;
      const localSnapshot = syncMergeService.toSnapshot(localData, Date.now());
      const merged = syncMergeService.mergeSnapshots(localSnapshot, remote);

      if (merged) {
        const mergedData = syncMergeService.snapshotToData(merged);
        if (!syncMergeService.dataEquals(mergedData, localData)) {
          applyToLocal(mergedData);
          dataRef.current = mergedData;
        }
        const remoteData = remote ? syncMergeService.snapshotToData(remote) : null;
        if (remoteData && syncMergeService.dataEquals(mergedData, remoteData)) {
          pushCoordinatorRef.current?.acknowledge(mergedData);
        } else {
          const publishedData = await writeToCloud(uid, mergedData, generation, 'initial_sync');
          pushCoordinatorRef.current?.acknowledge(publishedData);
        }
      }
      if (!isCurrentSession(uid, generation)) return;
      startWatch(uid);
      setStatus('signedIn');
      syncDiagnostics.log('INITIAL_SYNC_END', { generation, uid: maskUid(uid), status: 'success' });
    } catch (err) {
      if (!isCurrentSession(uid, generation)) return;
      startWatch(uid);
      const message = getErrorMessage(err);
      if (message) setError(message);
      setStatus('signedIn');
      syncDiagnostics.log('INITIAL_SYNC_END', {
        generation,
        uid: maskUid(uid),
        status: 'error',
        code: (err as { code?: string }).code,
      });
    } finally {
      if (isCurrentSession(uid, generation)) syncInProgressRef.current = false;
    }
  };

  const processRemoteSnapshot = (uid: string, generation: number, remote: ActusSnapshot | null) => {
    if (!isCurrentSession(uid, generation)) {
      syncDiagnostics.log('REMOTE_IGNORED', { reason: 'stale_session' });
      return;
    }

    if (!remote) {
      syncDiagnostics.log('REMOTE_IGNORED', { reason: 'remote_missing' });
      if (!pushCoordinatorRef.current?.getState().acknowledged && dataRef.current) {
        requestPush(dataRef.current, 'remote_missing', 'remote_snapshot_missing');
      }
      return;
    }

    const coordinatorState = pushCoordinatorRef.current?.getState();
    const remoteData = syncMergeService.snapshotToData(remote);
    const acknowledgedData = coordinatorState?.acknowledged
      ? syncMergeService.buildData(JSON.parse(coordinatorState.acknowledged) as Partial<ActusData>)
      : null;

    if (acknowledgedData && syncMergeService.dataEquals(acknowledgedData, remoteData)) {
      syncDiagnostics.log('REMOTE_IGNORED', () => ({ reason: 'equals_acknowledged', payload: summarizeData(remoteData).snapshotHash }));
      return;
    }

    const localData = dataRef.current;
    const remoteUpdatedAt = remote.updatedAt;
    if (acknowledgedData) {
      const acknowledgedMerge = syncMergeService.mergeSnapshots(
        syncMergeService.toSnapshot(acknowledgedData, remoteUpdatedAt - 1),
        remote,
      );
      if (acknowledgedMerge && syncMergeService.dataEquals(syncMergeService.snapshotToData(acknowledgedMerge), acknowledgedData)) {
        if (remote.updatedAt === lastWrittenUpdatedAtRef.current) {
          syncDiagnostics.log('REMOTE_IGNORED', () => ({ reason: 'covered_by_acknowledged_local_write', payload: summarizeData(remoteData).snapshotHash }));
        } else {
          const staleKey = `${remote.updatedAt}:${summarizeData(remoteData).snapshotHash}`;
          if (lastStaleRemoteKeyRef.current === staleKey) {
            syncDiagnostics.log('REMOTE_IGNORED', { reason: 'stale_already_republished' });
          } else {
            lastStaleRemoteKeyRef.current = staleKey;
            syncDiagnostics.log('REMOTE_STALE', { payload: summarizeData(remoteData).snapshotHash });
            pushCoordinatorRef.current?.request(acknowledgedData, {
              source: 'remote_writeback',
              reason: 'remote_stale_against_acknowledged',
              forceAcknowledged: true,
            });
          }
        }
        return;
      }
    }

    const localSnapshot = syncMergeService.toSnapshot(localData, remoteUpdatedAt - 1);
    const merged = syncMergeService.mergeSnapshots(localSnapshot, remote);

    if (merged) {
      const mergedData = syncMergeService.snapshotToData(merged);
      const changed = !syncMergeService.dataEquals(mergedData, localData);
      if (changed) {
        applyToLocal(mergedData);
        dataRef.current = mergedData;
        syncDiagnostics.log('REMOTE_IMPORTED', () => ({ payload: summarizeData(mergedData).snapshotHash }));
      }
      if (!syncMergeService.dataEquals(mergedData, remoteData)) {
        requestPush(mergedData, 'remote_writeback', 'merge_differs_remote');
      }
      syncDiagnostics.log('REMOTE_RECONCILED', () => ({
        remote: summarizeData(remoteData).snapshotHash,
        merged: summarizeData(mergedData).snapshotHash,
        changed,
      }));
    }
  };

  const handleRemoteSnapshot = (uid: string, generation: number) => (remote: ActusSnapshot | null) => {
    if (!isCurrentSession(uid, generation)) return;
    syncDiagnostics.log('REMOTE_RECEIVED', () => ({
      uid: maskUid(uid),
      generation,
      payload: remote ? summarizeData(remote).snapshotHash : 'null',
    }));
    if (pushCoordinatorRef.current?.getState().writing) {
      if (isRemoteEqualToWriting(remote)) {
        syncDiagnostics.log('REMOTE_IGNORED', { reason: 'equals_writing_payload' });
      } else {
        deferRemoteSnapshot(remote, 'write_in_progress');
      }
      return;
    }
    if (syncInProgressRef.current) {
      deferRemoteSnapshot(remote, 'sync_in_progress');
      return;
    }
    processRemoteSnapshot(uid, generation, remote);
  };

  onWriteSettledRef.current = () => {
    const remote = remotePendingRef.current;
    remotePendingRef.current = null;
    const hasPendingRemote = remotePendingAvailableRef.current;
    remotePendingAvailableRef.current = false;
    const uid = activeUidRef.current;
    const generation = sessionGenerationRef.current;
    if (hasPendingRemote && uid) processRemoteSnapshot(uid, generation, remote);
  };

  const startWatch = (uid: string) => {
    stopWatch();
    const generation = sessionGenerationRef.current;
    unsubscribeWatchRef.current = syncService.watchSnapshot(uid, handleRemoteSnapshot(uid, generation));
  };

  useEffect(() => {
    if (!isFirebaseConfigured) return;

    const unsubscribe = authService.onAuthStateChanged((fbUser) => {
      sessionGenerationRef.current += 1;
      const generation = sessionGenerationRef.current;
      pushCoordinatorRef.current?.reset();
      quotaGuardRef.current?.reset();
      remotePendingRef.current = null;
      remotePendingAvailableRef.current = false;
      lastWrittenUpdatedAtRef.current = null;
      lastStaleRemoteKeyRef.current = null;
      remoteAppliedDataRef.current = null;
      syncInProgressRef.current = false;
      if (fbUser) {
        activeUidRef.current = fbUser.uid;
        setUser(fbUser);
        setError(null);
        syncDiagnostics.log('SYNC_SESSION_START', { generation, uid: maskUid(fbUser.uid) });
        storageService.setItem(STORAGE_KEYS.syncUser, fbUser);
        void runInitialSync(fbUser.uid, generation);
      } else {
        syncDiagnostics.log('SYNC_SESSION_STOP', { generation });
        activeUidRef.current = null;
        setUser(null);
        setStatus('idle');
        setError(null);
        stopWatch();
        cancelPendingPush();
        storageService.removeItem(STORAGE_KEYS.syncUser);
      }
    });

    return () => {
      syncDiagnostics.log('SYNC_SESSION_STOP', { generation: sessionGenerationRef.current, reason: 'provider_cleanup' });
      sessionGenerationRef.current += 1;
      activeUidRef.current = null;
      pushCoordinatorRef.current?.reset();
      quotaGuardRef.current?.reset();
      remotePendingRef.current = null;
      remotePendingAvailableRef.current = false;
      lastWrittenUpdatedAtRef.current = null;
      lastStaleRemoteKeyRef.current = null;
      remoteAppliedDataRef.current = null;
      syncInProgressRef.current = false;
      stopWatch();
      cancelPendingPush();
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user || syncInProgressRef.current) return;

    if (remoteAppliedDataRef.current) {
      if (syncMergeService.dataEquals(dataRef.current, remoteAppliedDataRef.current)) {
        remoteAppliedDataRef.current = null;
        return;
      }
      remoteAppliedDataRef.current = null;
    }

    syncDiagnostics.log('LOCAL_CHANGED', () => ({
      uid: maskUid(user.uid),
      payload: summarizeData(dataRef.current).snapshotHash,
      reason: 'local_serialized_changed',
    }));
    cancelPendingPush();
    syncDiagnostics.log('PUSH_SCHEDULED', { source: 'local_change', reason: 'local_serialized_changed' });
    debounceTimerRef.current = setTimeout(() => {
      const data = dataRef.current;
      requestPush(data, 'local_change', 'local_serialized_changed');
    }, SYNC_DEBOUNCE_MS);

    return cancelPendingPush;
  }, [localSerialized, user]);

  useEffect(() => {
    return () => {
      syncDiagnostics.log('SYNC_SESSION_STOP', { reason: 'provider_unmount' });
      stopWatch();
      cancelPendingPush();
      pushCoordinatorRef.current?.reset();
    };
  }, []);

  const signInWithGoogle = async (): Promise<void> => {
    setError(null);
    setStatus('connecting');
    try {
      await authService.signInWithGoogle();
    } catch (err) {
      const message = getErrorMessage(err);
      if (message) setError(message);
      setStatus('idle');
    }
  };

  const signOut = async (): Promise<void> => {
    setError(null);
    setStatus('signingOut');
    try {
      await authService.signOut();
    } catch {
      setError('Não foi possível sair da conta. Tente novamente.');
      setStatus('signedIn');
    }
  };

  const syncNow = async (): Promise<void> => {
    if (!user || syncInProgressRef.current) return;
    const uid = user.uid;
    const generation = sessionGenerationRef.current;
    syncInProgressRef.current = true;
    setStatus('syncing');
    try {
      const remote = await syncService.readSnapshot(uid);
      if (!isCurrentSession(uid, generation)) return;
      const localData = dataRef.current;
      const localSnapshot = syncMergeService.toSnapshot(localData, Date.now());
      const merged = syncMergeService.mergeSnapshots(localSnapshot, remote);
      if (merged) {
        const mergedData = syncMergeService.snapshotToData(merged);
        if (!syncMergeService.dataEquals(mergedData, localData)) {
          applyToLocal(mergedData);
          dataRef.current = mergedData;
        }
        const remoteData = remote ? syncMergeService.snapshotToData(remote) : null;
        if (remoteData && syncMergeService.dataEquals(mergedData, remoteData)) {
          pushCoordinatorRef.current?.acknowledge(mergedData);
        } else {
          requestPush(mergedData, 'manual_sync', 'sync_now');
          pushCoordinatorRef.current?.retry();
        }
      }
      setStatus('signedIn');
    } catch (err) {
      if (!isCurrentSession(uid, generation)) return;
      const message = getErrorMessage(err);
      if (message) setError(message);
      setStatus('signedIn');
    } finally {
      if (isCurrentSession(uid, generation)) {
        syncInProgressRef.current = false;
        if (!pushCoordinatorRef.current?.getState().writing && remotePendingAvailableRef.current) {
          onWriteSettledRef.current();
        }
      }
    }
  };

  return (
    <FirebaseContext.Provider
      value={{
        status,
        user,
        lastSyncAt,
        error,
        isConfigured: isFirebaseConfigured,
        signInWithGoogle,
        signOut,
        syncNow,
      }}
    >
      {children}
    </FirebaseContext.Provider>
  );
};

export const useFirebase = () => {
  const context = useContext(FirebaseContext);
  if (!context) {
    throw new Error('useFirebase must be used within a FirebaseProvider');
  }
  return context;
};

function maskUid(uid: string): string {
  return syncDiagnostics.fingerprint(uid).canonical;
}
