import type { Habit, HabitCompletion, HabitStreakInfo } from '@/types';
import { dateService } from './dateService';

export const streakService = {
  isHabitScheduledOnDate(habit: Habit, dateStr: string): boolean {
    if (dateService.isBefore(dateStr, habit.startDate)) {
      return false;
    }

    if (habit.frequency === 'daily') {
      return true;
    }

    if (habit.frequency === 'custom' && habit.targetDays && habit.targetDays.length > 0) {
      const dayOfWeek = dateService.getDayOfWeek(dateStr);
      return habit.targetDays.includes(dayOfWeek);
    }

    if (habit.frequency === 'weekly') {
      // For weekly habits, scheduled every day unless targetDays specified
      if (habit.targetDays && habit.targetDays.length > 0) {
        const dayOfWeek = dateService.getDayOfWeek(dateStr);
        return habit.targetDays.includes(dayOfWeek);
      }
      return true;
    }

    return true;
  },

  isCompletedOnDate(habitId: string, dateStr: string, completions: HabitCompletion[]): boolean {
    return completions.some((c) => c.habitId === habitId && c.date === dateStr && c.completed);
  },

  calculateCurrentStreak(habit: Habit, completions: HabitCompletion[], referenceDate = dateService.getTodayString()): number {
    if (dateService.isBefore(referenceDate, habit.startDate)) {
      return 0;
    }

    let streak = 0;
    let checkDate = referenceDate;

    // Check if scheduled today. If scheduled today and not completed yet, start check from yesterday so active streak isn't lost before day ends.
    const scheduledToday = this.isHabitScheduledOnDate(habit, checkDate);
    const completedToday = this.isCompletedOnDate(habit.id, checkDate, completions);

    if (scheduledToday && !completedToday) {
      // Move to yesterday to evaluate historical streak
      checkDate = dateService.subtractDays(checkDate, 1);
    }

    while (dateService.isAfter(checkDate, habit.startDate) || dateService.isSameDay(checkDate, habit.startDate)) {
      const scheduled = this.isHabitScheduledOnDate(habit, checkDate);

      if (scheduled) {
        const completed = this.isCompletedOnDate(habit.id, checkDate, completions);
        if (completed) {
          streak++;
        } else {
          // Broken streak
          break;
        }
      }
      checkDate = dateService.subtractDays(checkDate, 1);
    }

    return streak;
  },

  calculateLongestStreak(habit: Habit, completions: HabitCompletion[], referenceDate = dateService.getTodayString()): number {
    if (dateService.isBefore(referenceDate, habit.startDate)) {
      return 0;
    }

    let maxStreak = 0;
    let currentStreak = 0;
    let checkDate = habit.startDate;

    while (dateService.isBefore(checkDate, referenceDate) || dateService.isSameDay(checkDate, referenceDate)) {
      const scheduled = this.isHabitScheduledOnDate(habit, checkDate);

      if (scheduled) {
        const completed = this.isCompletedOnDate(habit.id, checkDate, completions);
        if (completed) {
          currentStreak++;
          if (currentStreak > maxStreak) {
            maxStreak = currentStreak;
          }
        } else {
          currentStreak = 0;
        }
      }
      checkDate = dateService.addDays(checkDate, 1);
    }

    return maxStreak;
  },

  calculateWeeklyCompletion(habit: Habit, completions: HabitCompletion[], referenceDate = dateService.getTodayString()): number {
    const startOfWeek = dateService.getStartOfWeek(referenceDate);
    const endOfWeek = dateService.getEndOfWeek(referenceDate);
    const weekDates = dateService.getDateRange(startOfWeek, endOfWeek);

    let scheduledCount = 0;
    let completedCount = 0;

    for (const d of weekDates) {
      if (this.isHabitScheduledOnDate(habit, d)) {
        scheduledCount++;
        if (this.isCompletedOnDate(habit.id, d, completions)) {
          completedCount++;
        }
      }
    }

    if (scheduledCount === 0) return 0;
    return Math.round((completedCount / scheduledCount) * 100);
  },

  calculateMonthlyCompletion(habit: Habit, completions: HabitCompletion[], referenceDate = dateService.getTodayString()): number {
    const startOfMonth = dateService.getStartOfMonth(referenceDate);
    const endOfMonth = dateService.getEndOfMonth(referenceDate);
    const monthDates = dateService.getDateRange(startOfMonth, endOfMonth);

    let scheduledCount = 0;
    let completedCount = 0;

    for (const d of monthDates) {
      if (this.isHabitScheduledOnDate(habit, d)) {
        scheduledCount++;
        if (this.isCompletedOnDate(habit.id, d, completions)) {
          completedCount++;
        }
      }
    }

    if (scheduledCount === 0) return 0;
    return Math.round((completedCount / scheduledCount) * 100);
  },

  getHabitStreakInfo(habit: Habit, completions: HabitCompletion[], referenceDate = dateService.getTodayString()): HabitStreakInfo {
    const habitCompletions = completions.filter((c) => c.habitId === habit.id && c.completed);

    return {
      currentStreak: this.calculateCurrentStreak(habit, completions, referenceDate),
      longestStreak: this.calculateLongestStreak(habit, completions, referenceDate),
      weeklyCompletionRate: this.calculateWeeklyCompletion(habit, completions, referenceDate),
      monthlyCompletionRate: this.calculateMonthlyCompletion(habit, completions, referenceDate),
      totalCompletions: habitCompletions.length,
    };
  },
};
