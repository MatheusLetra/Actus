import { STORAGE_KEYS } from '@/constants';
import type { HabitCompletion } from '@/types';
import { storageService } from './storageService';

export const completionRepository = {
  getAll(): HabitCompletion[] {
    return storageService.getItem<HabitCompletion[]>(STORAGE_KEYS.completions, []);
  },

  saveAll(completions: HabitCompletion[]): void {
    storageService.setItem(STORAGE_KEYS.completions, completions);
  },

  toggle(habitId: string, date: string): { completions: HabitCompletion[]; completed: boolean } {
    const list = this.getAll();
    const existingIndex = list.findIndex((c) => c.habitId === habitId && c.date === date);

    let updated: HabitCompletion[];
    let completed = false;

    if (existingIndex >= 0) {
      const existing = list[existingIndex];
      if (existing.completed) {
        // Unmark or remove
        updated = list.filter((_, idx) => idx !== existingIndex);
        completed = false;
      } else {
        // Mark as true
        updated = [...list];
        updated[existingIndex] = { ...existing, completed: true };
        completed = true;
      }
    } else {
      // Add new completion record
      const newCompletion: HabitCompletion = {
        id: `${habitId}_${date}_${Date.now()}`,
        habitId,
        date,
        completed: true,
      };
      updated = [...list, newCompletion];
      completed = true;
    }

    this.saveAll(updated);
    return { completions: updated, completed };
  },

  complete(habitId: string, date: string): HabitCompletion[] {
    const list = this.getAll();
    const existingIndex = list.findIndex((c) => c.habitId === habitId && c.date === date);

    if (existingIndex >= 0) {
      const existing = list[existingIndex];
      if (existing.completed) return list;
      const updated = [...list];
      updated[existingIndex] = { ...existing, completed: true };
      this.saveAll(updated);
      return updated;
    }

    const newCompletion: HabitCompletion = {
      id: `c_${habitId}_${date}`,
      habitId,
      date,
      completed: true,
    };
    const updated = [...list, newCompletion];
    this.saveAll(updated);
    return updated;
  },

  deleteByHabitId(habitId: string): HabitCompletion[] {
    const list = this.getAll();
    const updated = list.filter((c) => c.habitId !== habitId);
    this.saveAll(updated);
    return updated;
  },
};
