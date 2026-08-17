import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Habit } from '../types';
import { habitRepository } from '../repositories/habitRepository';

const habit: Habit = {
  id: 'habit_1',
  name: 'Beber água',
  categoryId: 'cat_1',
  frequency: 'daily',
  startDate: '2026-08-01',
  active: true,
  createdAt: '2026-08-01T10:00:00.000Z',
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-08-17T10:00:00.000Z'));
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => key === 'actus:habits' ? JSON.stringify([habit]) : null,
    setItem: vi.fn(),
  });
});

describe('habitRepository versioning', () => {
  it('adds an updatedAt without changing createdAt', () => {
    const added = habitRepository.add(habit)[0];

    expect(added.updatedAt).toBe('2026-08-17T10:00:00.000Z');
    expect(added.createdAt).toBe(habit.createdAt);
  });

  it('updates the version while preserving createdAt', () => {
    const updated = habitRepository.update({ ...habit, name: 'Ler' })[0];

    expect(updated.name).toBe('Ler');
    expect(updated.updatedAt).toBe('2026-08-17T10:00:00.000Z');
    expect(updated.createdAt).toBe(habit.createdAt);
  });

  it('versions active toggles', () => {
    const updated = habitRepository.toggleActive(habit.id)[0];

    expect(updated.active).toBe(false);
    expect(updated.updatedAt).toBe('2026-08-17T10:00:00.000Z');
  });
});
