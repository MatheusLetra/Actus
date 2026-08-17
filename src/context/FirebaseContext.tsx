import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useHabits } from '@/context/HabitContext';
import { storageService } from '@/repositories/storageService';
import { STORAGE_KEYS } from '@/constants';
import { authService, type SyncUser } from '@/services/firebase/authService';
import { syncService } from '@/services/firebase/syncService';
import { createPushCoordinator, type PushCoordinator } from '@/services/firebase/pushCoordinator';
import { isFirebaseConfigured } from '@/services/firebase/config';
import { syncMergeService, SYNC_VERSION, type ActusData, type ActusSnapshot } from '@/services/syncMergeService';

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
  const onWriteSettledRef = useRef<() => void>(() => undefined);
  const pushCoordinatorRef = useRef<PushCoordinator<ActusData> | null>(null);

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
    importData(syncMergeService.dataToJson(data));
  };

  const writeToCloud = async (uid: string, data: ActusData, updatedAt: number, generation: number): Promise<void> => {
    if (!isCurrentSession(uid, generation)) throw new Error('sync-session-invalidated');
    try {
      await syncService.writeSnapshot(uid, data, updatedAt);
      if (!isCurrentSession(uid, generation)) throw new Error('sync-session-invalidated');
      const now = Date.now();
      setLastSyncAt(now);
      setError(null);
      storageService.setItem(STORAGE_KEYS.lastSyncAt, now);
    } catch (err) {
      if (!isCurrentSession(uid, generation)) throw err;
      const message = getErrorMessage(err);
      if (message) setError(message);
      throw err;
    }
  };

  if (pushCoordinatorRef.current === null) {
    pushCoordinatorRef.current = createPushCoordinator<ActusData>({
      serialize: (data) => syncMergeService.dataToJson(data),
      write: async (data) => {
        const uid = activeUidRef.current;
        const generation = sessionGenerationRef.current;
        if (!uid) throw new Error('sync-session-invalidated');
        await writeToCloud(uid, data, Date.now(), generation);
      },
      onSettled: () => onWriteSettledRef.current(),
    });
  }

  const runInitialSync = async (uid: string, generation: number) => {
    if (syncInProgressRef.current) return;
    syncInProgressRef.current = true;
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
        await writeToCloud(uid, mergedData, merged.updatedAt, generation);
        pushCoordinatorRef.current?.acknowledge(mergedData);
      }
      if (!isCurrentSession(uid, generation)) return;
      startWatch(uid);
      setStatus('signedIn');
    } catch (err) {
      if (!isCurrentSession(uid, generation)) return;
      startWatch(uid);
      const message = getErrorMessage(err);
      if (message) setError(message);
      setStatus('signedIn');
    } finally {
      if (isCurrentSession(uid, generation)) syncInProgressRef.current = false;
    }
  };

  const processRemoteSnapshot = (uid: string, generation: number, remote: ActusSnapshot | null) => {
    if (!isCurrentSession(uid, generation) || syncInProgressRef.current) return;

    if (!remote) {
      if (!pushCoordinatorRef.current?.getState().acknowledged && dataRef.current) pushCoordinatorRef.current?.request(dataRef.current);
      return;
    }

    const remoteData = syncMergeService.snapshotToData(remote);
    const coordinatorState = pushCoordinatorRef.current?.getState();
    if (coordinatorState?.writing) {
      remotePendingRef.current = remote;
      return;
    }

    if (coordinatorState?.acknowledged === syncMergeService.dataToJson(remoteData)) return;

    const localData = dataRef.current;
    const remoteUpdatedAt = remote.updatedAt;
    const acknowledgedData = coordinatorState?.acknowledged
      ? syncMergeService.buildData(JSON.parse(coordinatorState.acknowledged) as Partial<ActusData>)
      : null;
    if (acknowledgedData) {
      const acknowledgedMerge = syncMergeService.mergeSnapshots(
        syncMergeService.toSnapshot(acknowledgedData, remoteUpdatedAt - 1),
        remote,
      );
      if (acknowledgedMerge && syncMergeService.dataEquals(syncMergeService.snapshotToData(acknowledgedMerge), acknowledgedData)) return;
    }

    const localSnapshot = syncMergeService.toSnapshot(localData, remoteUpdatedAt - 1);
    const merged = syncMergeService.mergeSnapshots(localSnapshot, remote);

    if (merged) {
      const mergedData = syncMergeService.snapshotToData(merged);
      if (!syncMergeService.dataEquals(mergedData, localData)) {
        applyToLocal(mergedData);
        dataRef.current = mergedData;
      }
      if (!syncMergeService.dataEquals(mergedData, remoteData)) pushCoordinatorRef.current?.request(mergedData);
    }
  };

  const handleRemoteSnapshot = (uid: string, generation: number) => (remote: ActusSnapshot | null) => {
    if (!isCurrentSession(uid, generation)) return;
    if (pushCoordinatorRef.current?.getState().writing) {
      remotePendingRef.current = remote;
      return;
    }
    processRemoteSnapshot(uid, generation, remote);
  };

  onWriteSettledRef.current = () => {
    const remote = remotePendingRef.current;
    remotePendingRef.current = null;
    const uid = activeUidRef.current;
    const generation = sessionGenerationRef.current;
    if (remote && uid) processRemoteSnapshot(uid, generation, remote);
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
      remotePendingRef.current = null;
      syncInProgressRef.current = false;
      if (fbUser) {
        activeUidRef.current = fbUser.uid;
        setUser(fbUser);
        setError(null);
        storageService.setItem(STORAGE_KEYS.syncUser, fbUser);
        void runInitialSync(fbUser.uid, generation);
      } else {
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
      sessionGenerationRef.current += 1;
      activeUidRef.current = null;
      pushCoordinatorRef.current?.reset();
      remotePendingRef.current = null;
      syncInProgressRef.current = false;
      stopWatch();
      cancelPendingPush();
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user || syncInProgressRef.current) return;

    cancelPendingPush();
    debounceTimerRef.current = setTimeout(() => {
      const data = dataRef.current;
      pushCoordinatorRef.current?.request(data);
    }, SYNC_DEBOUNCE_MS);

    return cancelPendingPush;
  }, [localSerialized, user]);

  useEffect(() => {
    return () => {
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
        pushCoordinatorRef.current?.request(mergedData);
        pushCoordinatorRef.current?.retry();
      }
      setStatus('signedIn');
    } catch (err) {
      if (!isCurrentSession(uid, generation)) return;
      const message = getErrorMessage(err);
      if (message) setError(message);
      setStatus('signedIn');
    } finally {
      if (isCurrentSession(uid, generation)) syncInProgressRef.current = false;
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
