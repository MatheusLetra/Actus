import { STORAGE_KEYS } from '@/constants';
import type { PomodoroSession, PomodoroSettings } from '@/types';
import { pomodoroService } from '@/services/pomodoroService';
import { storageService } from './storageService';

export const pomodoroRepository = {
  getSettings(): PomodoroSettings {
    return storageService.getItem<PomodoroSettings>(STORAGE_KEYS.pomodoroSettings, pomodoroService.getDefaultSettings());
  },

  saveSettings(settings: PomodoroSettings): void {
    storageService.setItem(STORAGE_KEYS.pomodoroSettings, settings);
  },

  getAll(): PomodoroSession[] {
    return storageService.getItem<PomodoroSession[]>(STORAGE_KEYS.pomodoroSessions, []);
  },

  saveAll(sessions: PomodoroSession[]): void {
    storageService.setItem(STORAGE_KEYS.pomodoroSessions, sessions);
  },

  add(session: PomodoroSession): PomodoroSession[] {
    const list = this.getAll();
    const withoutActive = session.status === 'running' || session.status === 'paused'
      ? list.filter((s) => s.status !== 'running' && s.status !== 'paused')
      : list;
    const updated = [session, ...withoutActive];
    this.saveAll(updated);
    return updated;
  },

  update(id: string, updates: Partial<Omit<PomodoroSession, 'id'>>): PomodoroSession[] {
    const list = this.getAll();
    const updated = list.map((s) => (s.id === id ? { ...s, ...updates } : s));
    this.saveAll(updated);
    return updated;
  },

  remove(id: string): PomodoroSession[] {
    const list = this.getAll();
    const updated = list.filter((s) => s.id !== id);
    this.saveAll(updated);
    return updated;
  },

  removeCompleted(id: string): PomodoroSession[] {
    const list = this.getAll();
    const updated = list.filter((s) => s.id !== id || s.status !== 'completed');
    this.saveAll(updated);
    return updated;
  },

  clear(): PomodoroSession[] {
    this.saveAll([]);
    return [];
  },
};
