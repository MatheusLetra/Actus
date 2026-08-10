import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useHabits } from '@/context/HabitContext';
import { storageService } from '@/repositories/storageService';
import { STORAGE_KEYS } from '@/constants';
import { authService, type SyncUser } from '@/services/firebase/authService';
import { syncService } from '@/services/firebase/syncService';
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
    tombstones,
  };

  const lastWrittenUpdatedAtRef = useRef(0);
  const lastPushedSerializedRef = useRef<string | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncInProgressRef = useRef(false);
  const pushInProgressRef = useRef(false);
  const unsubscribeWatchRef = useRef<(() => void) | null>(null);

  const localSerialized = useMemo(
    () => JSON.stringify({ categories, habits, completions, pomodoroSettings, pomodoroSessions, kanbanBoard, kanbanColumns, kanbanTasks, tombstones }),
    [categories, habits, completions, pomodoroSettings, pomodoroSessions, kanbanBoard, kanbanColumns, kanbanTasks, tombstones]
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

  const applyToLocal = (data: ActusData) => {
    importData(syncMergeService.dataToJson(data));
  };

  const writeToCloud = async (uid: string, data: ActusData, updatedAt: number): Promise<void> => {
    if (pushInProgressRef.current) return;
    pushInProgressRef.current = true;
    try {
      await syncService.writeSnapshot(uid, data, updatedAt);
      lastWrittenUpdatedAtRef.current = updatedAt;
      lastPushedSerializedRef.current = syncMergeService.dataToJson(data);
      const now = Date.now();
      setLastSyncAt(now);
      setError(null);
      storageService.setItem(STORAGE_KEYS.lastSyncAt, now);
    } catch (err) {
      const message = getErrorMessage(err);
      if (message) setError(message);
    } finally {
      pushInProgressRef.current = false;
    }
  };

  const runInitialSync = async (uid: string) => {
    if (syncInProgressRef.current) return;
    syncInProgressRef.current = true;
    setStatus('syncing');
    stopWatch();
    cancelPendingPush();
    try {
      const localData = dataRef.current;
      const remote = await syncService.readSnapshot(uid);
      const localSnapshot = syncMergeService.toSnapshot(localData, Date.now());
      const merged = syncMergeService.mergeSnapshots(localSnapshot, remote);

      if (merged) {
        if (!syncMergeService.dataEquals(merged, localData)) {
          applyToLocal(merged);
          dataRef.current = merged;
        }
        await writeToCloud(uid, merged, merged.updatedAt);
      }
      startWatch(uid);
      setStatus('signedIn');
    } catch (err) {
      startWatch(uid);
      const message = getErrorMessage(err);
      if (message) setError(message);
      setStatus('signedIn');
    } finally {
      syncInProgressRef.current = false;
    }
  };

  const handleRemoteSnapshot = (uid: string) => (remote: ActusSnapshot | null) => {
    if (syncInProgressRef.current) return;

    if (!remote) {
      if (lastPushedSerializedRef.current === null && dataRef.current) {
        const now = Date.now();
        void writeToCloud(uid, dataRef.current, now);
      }
      return;
    }

    if (remote.updatedAt <= lastWrittenUpdatedAtRef.current) return;

    const localData = dataRef.current;
    const localSnapshot = syncMergeService.toSnapshot(localData, remote.updatedAt - 1);
    const merged = syncMergeService.mergeSnapshots(localSnapshot, remote);

    lastWrittenUpdatedAtRef.current = remote.updatedAt;

    if (merged && !syncMergeService.dataEquals(merged, localData)) {
      applyToLocal(merged);
      dataRef.current = merged;
      lastPushedSerializedRef.current = syncMergeService.dataToJson(merged);
      void writeToCloud(uid, merged, remote.updatedAt);
    }
  };

  const startWatch = (uid: string) => {
    stopWatch();
    unsubscribeWatchRef.current = syncService.watchSnapshot(uid, handleRemoteSnapshot(uid));
  };

  useEffect(() => {
    if (!isFirebaseConfigured) return;

    const unsubscribe = authService.onAuthStateChanged((fbUser) => {
      if (fbUser) {
        setUser(fbUser);
        setError(null);
        storageService.setItem(STORAGE_KEYS.syncUser, fbUser);
        void runInitialSync(fbUser.uid);
      } else {
        setUser(null);
        setStatus('idle');
        setError(null);
        stopWatch();
        cancelPendingPush();
        lastWrittenUpdatedAtRef.current = 0;
        lastPushedSerializedRef.current = null;
        storageService.removeItem(STORAGE_KEYS.syncUser);
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user || syncInProgressRef.current) return;

    const serialized = syncMergeService.dataToJson(dataRef.current);
    if (lastPushedSerializedRef.current === serialized) return;

    cancelPendingPush();
    debounceTimerRef.current = setTimeout(() => {
      const data = dataRef.current;
      if (lastPushedSerializedRef.current === syncMergeService.dataToJson(data)) return;
      const attemptPush = () => {
        if (pushInProgressRef.current) {
          debounceTimerRef.current = setTimeout(attemptPush, SYNC_DEBOUNCE_MS);
          return;
        }
        void writeToCloud(user.uid, data, Date.now());
      };
      attemptPush();
    }, SYNC_DEBOUNCE_MS);

    return cancelPendingPush;
  }, [localSerialized, user]);

  useEffect(() => {
    return () => {
      stopWatch();
      cancelPendingPush();
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
    syncInProgressRef.current = true;
    setStatus('syncing');
    try {
      const remote = await syncService.readSnapshot(user.uid);
      const localData = dataRef.current;
      const localSnapshot = syncMergeService.toSnapshot(localData, Date.now());
      const merged = syncMergeService.mergeSnapshots(localSnapshot, remote);
      if (merged) {
        if (!syncMergeService.dataEquals(merged, localData)) {
          applyToLocal(merged);
          dataRef.current = merged;
        }
        await writeToCloud(user.uid, merged, merged.updatedAt);
      }
      setStatus('signedIn');
    } catch (err) {
      const message = getErrorMessage(err);
      if (message) setError(message);
      setStatus('signedIn');
    } finally {
      syncInProgressRef.current = false;
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