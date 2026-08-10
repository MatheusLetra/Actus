import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
  type DocumentData,
} from 'firebase/firestore';
import type { HabitCompletion, PomodoroSession } from '@/types';
import { db } from './config';
import { syncMergeService, SYNC_VERSION, type ActusData, type ActusSnapshot } from '../syncMergeService';

type StoredCoreData = Omit<ActusData, 'completions' | 'pomodoroSessions'>;

interface StoredCore {
  updatedAt: number;
  data: StoredCoreData;
}

function requireDb() {
  if (!db) throw new Error('Firebase não configurado. Verifique o arquivo .env.');
  return db;
}

function groupByMonth<T extends { date: string }>(items: T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const month = item.date?.slice(0, 7);
    if (!month) continue;
    const list = groups.get(month);
    if (list) list.push(item);
    else groups.set(month, [item]);
  }
  return groups;
}

function toItems(docs: { data: () => DocumentData }[]): Distribution[] {
  return docs.flatMap((d) => (Array.isArray(d.data().items) ? d.data().items : []));
}

type Distribution = HabitCompletion | PomodoroSession;

export const syncService = {
  async readSnapshot(uid: string): Promise<ActusSnapshot | null> {
    const instance = requireDb();
    const coreRef = doc(instance, 'users', uid);
    const coreSnap = await getDoc(coreRef);
    if (!coreSnap.exists()) return null;

    const core = coreSnap.data() as StoredCore;
    const [completionSnap, pomodoroSnap] = await Promise.all([
      getDocs(collection(instance, 'users', uid, 'completions')),
      getDocs(collection(instance, 'users', uid, 'pomodoro')),
    ]);

    const completions = toItems(completionSnap.docs) as HabitCompletion[];
    const pomodoroSessions = toItems(pomodoroSnap.docs) as PomodoroSession[];

    const data = syncMergeService.buildData({ ...core.data, completions, pomodoroSessions });
    return syncMergeService.toSnapshot(data, core.updatedAt || 0);
  },

  async writeSnapshot(uid: string, data: ActusData, updatedAt: number): Promise<void> {
    const instance = requireDb();
    const coreRef = doc(instance, 'users', uid);

    await setDoc(coreRef, {
      updatedAt,
      data: {
        version: SYNC_VERSION,
        categories: data.categories,
        habits: data.habits,
        pomodoroSettings: data.pomodoroSettings,
        kanbanBoard: data.kanbanBoard,
        kanbanColumns: data.kanbanColumns,
        kanbanTasks: data.kanbanTasks,
      },
    });

    const completionsByMonth = groupByMonth(data.completions);
    const pomodoroByMonth = groupByMonth(data.pomodoroSessions);

    const [existingCompletions, existingPomodoro] = await Promise.all([
      getDocs(collection(instance, 'users', uid, 'completions')),
      getDocs(collection(instance, 'users', uid, 'pomodoro')),
    ]);

    const staleCompletions = existingCompletions.docs
      .map((d) => d.id)
      .filter((id) => !completionsByMonth.has(id));
    const stalePomodoro = existingPomodoro.docs.map((d) => d.id).filter((id) => !pomodoroByMonth.has(id));

    const completionWrites = Array.from(completionsByMonth.entries()).map(([month, items]) =>
      setDoc(doc(instance, 'users', uid, 'completions', month), { items })
    );
    const pomodoroWrites = Array.from(pomodoroByMonth.entries()).map(([month, items]) =>
      setDoc(doc(instance, 'users', uid, 'pomodoro', month), { items })
    );
    const staleDeletes = [
      ...staleCompletions.map((id) => deleteDoc(doc(instance, 'users', uid, 'completions', id))),
      ...stalePomodoro.map((id) => deleteDoc(doc(instance, 'users', uid, 'pomodoro', id))),
    ];

    await Promise.all([...completionWrites, ...pomodoroWrites, ...staleDeletes]);
  },

  watchSnapshot(uid: string, callback: (snapshot: ActusSnapshot | null) => void): () => void {
    const instance = requireDb();

    let core: StoredCore | null | undefined;
    let completions: HabitCompletion[] | undefined;
    let pomodoroSessions: PomodoroSession[] | undefined;

    const emit = () => {
      if (core === undefined || completions === undefined || pomodoroSessions === undefined) return;
      if (!core) {
        callback(null);
        return;
      }
      const data = syncMergeService.buildData({
        ...core.data,
        completions,
        pomodoroSessions,
      });
      callback(syncMergeService.toSnapshot(data, core.updatedAt || 0));
    };

    const unsubCore = onSnapshot(doc(instance, 'users', uid), (snap) => {
      core = snap.exists() ? (snap.data() as StoredCore) : null;
      emit();
    });

    const unsubCompletions = onSnapshot(collection(instance, 'users', uid, 'completions'), (snap) => {
      completions = snap.docs.flatMap((d) => (Array.isArray(d.data().items) ? d.data().items : [])) as HabitCompletion[];
      emit();
    });

    const unsubPomodoro = onSnapshot(collection(instance, 'users', uid, 'pomodoro'), (snap) => {
      pomodoroSessions = snap.docs.flatMap((d) =>
        Array.isArray(d.data().items) ? d.data().items : []
      ) as PomodoroSession[];
      emit();
    });

    return () => {
      unsubCore();
      unsubCompletions();
      unsubPomodoro();
    };
  },
};