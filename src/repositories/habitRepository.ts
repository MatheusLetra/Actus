import { STORAGE_KEYS } from '@/constants';
import type { Habit } from '@/types';
import { storageService } from './storageService';

export const habitRepository = {
  getAll(): Habit[] {
    return storageService.getItem<Habit[]>(STORAGE_KEYS.habits, []);
  },

  saveAll(habits: Habit[]): void {
    storageService.setItem(STORAGE_KEYS.habits, habits);
  },

  add(habit: Habit): Habit[] {
    const list = this.getAll();
    const updated = [{ ...habit, updatedAt: habit.updatedAt ?? new Date().toISOString() }, ...list];
    this.saveAll(updated);
    return updated;
  },

  update(updatedHabit: Habit): Habit[] {
    const list = this.getAll();
    const updated = list.map((h) =>
      h.id === updatedHabit.id ? { ...updatedHabit, updatedAt: new Date().toISOString() } : h
    );
    this.saveAll(updated);
    return updated;
  },

  delete(id: string): Habit[] {
    const list = this.getAll();
    const updated = list.filter((h) => h.id !== id);
    this.saveAll(updated);
    return updated;
  },

  toggleActive(id: string): Habit[] {
    const list = this.getAll();
    const updated = list.map((h) =>
      h.id === id ? { ...h, active: !h.active, updatedAt: new Date().toISOString() } : h
    );
    this.saveAll(updated);
    return updated;
  },
};
