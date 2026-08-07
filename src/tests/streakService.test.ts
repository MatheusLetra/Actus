import { describe, expect, it } from 'vitest';
import type { Habit, HabitCompletion } from '../types';
import { streakService } from '../services/streakService';

describe('streakService', () => {
  const dailyHabit: Habit = {
    id: 'h1',
    name: 'Beber Água',
    categoryId: 'c1',
    frequency: 'daily',
    startDate: '2026-08-01',
    active: true,
    createdAt: '2026-08-01',
  };

  it('should calculate current streak when consecutive days are completed', () => {
    const completions: HabitCompletion[] = [
      { id: '1', habitId: 'h1', date: '2026-08-05', completed: true },
      { id: '2', habitId: 'h1', date: '2026-08-06', completed: true },
      { id: '3', habitId: 'h1', date: '2026-08-07', completed: true },
    ];

    const streak = streakService.calculateCurrentStreak(dailyHabit, completions, '2026-08-07');
    expect(streak).toBe(3);
  });

  it('should keep streak alive if today is not completed yet but yesterday was completed', () => {
    const completions: HabitCompletion[] = [
      { id: '1', habitId: 'h1', date: '2026-08-05', completed: true },
      { id: '2', habitId: 'h1', date: '2026-08-06', completed: true },
    ];

    // Evaluate on 2026-08-07 (today not completed yet)
    const streak = streakService.calculateCurrentStreak(dailyHabit, completions, '2026-08-07');
    expect(streak).toBe(2);
  });

  it('should reset streak when a day is skipped in history', () => {
    const completions: HabitCompletion[] = [
      { id: '1', habitId: 'h1', date: '2026-08-04', completed: true },
      // 2026-08-05 missing
      { id: '2', habitId: 'h1', date: '2026-08-06', completed: true },
      { id: '3', habitId: 'h1', date: '2026-08-07', completed: true },
    ];

    const streak = streakService.calculateCurrentStreak(dailyHabit, completions, '2026-08-07');
    expect(streak).toBe(2);
  });

  it('should calculate longest historical streak accurately', () => {
    const completions: HabitCompletion[] = [
      { id: '1', habitId: 'h1', date: '2026-08-01', completed: true },
      { id: '2', habitId: 'h1', date: '2026-08-02', completed: true },
      { id: '3', habitId: 'h1', date: '2026-08-03', completed: true },
      { id: '4', habitId: 'h1', date: '2026-08-04', completed: true },
      { id: '5', habitId: 'h1', date: '2026-08-05', completed: true }, // Streak 5
      // 2026-08-06 missing
      { id: '6', habitId: 'h1', date: '2026-08-07', completed: true }, // Current streak 1
    ];

    const longest = streakService.calculateLongestStreak(dailyHabit, completions, '2026-08-07');
    expect(longest).toBe(5);
  });
});
