import type { Category, CategoryStat, DashboardStats, Habit, HabitCompletion } from '@/types';
import { dateService } from './dateService';
import { streakService } from './streakService';

export const statisticsService = {
  getDashboardStats(
    habits: Habit[],
    _categories: Category[],
    completions: HabitCompletion[],
    today = dateService.getTodayString()
  ): DashboardStats {
    const activeHabits = habits.filter((h) => h.active);
    const scheduledToday = activeHabits.filter((h) => streakService.isHabitScheduledOnDate(h, today));

    const completedTodayCount = scheduledToday.filter((h) =>
      streakService.isCompletedOnDate(h.id, today, completions)
    ).length;

    const todayCompletionRate =
      scheduledToday.length > 0 ? Math.round((completedTodayCount / scheduledToday.length) * 100) : 0;

    // Calculate streaks across active habits
    let overallCurrentStreak = 0;
    let overallLongestStreak = 0;

    activeHabits.forEach((h) => {
      const current = streakService.calculateCurrentStreak(h, completions, today);
      const longest = streakService.calculateLongestStreak(h, completions, today);
      if (current > overallCurrentStreak) overallCurrentStreak = current;
      if (longest > overallLongestStreak) overallLongestStreak = longest;
    });

    const totalCompletions = completions.filter((c) => c.completed).length;

    const last7DaysRate = this.getPeriodCompletionRate(activeHabits, completions, 7, today);
    const last30DaysRate = this.getPeriodCompletionRate(activeHabits, completions, 30, today);

    return {
      activeHabitsCount: activeHabits.length,
      completedTodayCount,
      todayCompletionRate,
      overallCurrentStreak,
      overallLongestStreak,
      totalCompletions,
      last7DaysRate,
      last30DaysRate,
    };
  },

  getPeriodCompletionRate(
    habits: Habit[],
    completions: HabitCompletion[],
    daysCount: number,
    endDateStr = dateService.getTodayString()
  ): number {
    if (habits.length === 0) return 0;
    const dates = dateService.getLastNDays(daysCount, endDateStr);

    let totalScheduled = 0;
    let totalCompleted = 0;

    dates.forEach((dateStr: string) => {
      habits.forEach((habit) => {
        if (streakService.isHabitScheduledOnDate(habit, dateStr)) {
          totalScheduled++;
          if (streakService.isCompletedOnDate(habit.id, dateStr, completions)) {
            totalCompleted++;
          }
        }
      });
    });

    if (totalScheduled === 0) return 0;
    return Math.round((totalCompleted / totalScheduled) * 100);
  },

  getDailyCompletionsSeries(
    habits: Habit[],
    completions: HabitCompletion[],
    daysCount: number,
    endDateStr = dateService.getTodayString()
  ) {
    const dates = dateService.getLastNDays(daysCount, endDateStr);
    const activeHabits = habits.filter((h) => h.active);

    return dates.map((dateStr: string) => {
      const scheduled = activeHabits.filter((h) => streakService.isHabitScheduledOnDate(h, dateStr));
      const completed = scheduled.filter((h) => streakService.isCompletedOnDate(h.id, dateStr, completions));

      return {
        date: dateStr,
        label: dateService.formatDisplayDate(dateStr, { short: true }),
        scheduled: scheduled.length,
        completed: completed.length,
        rate: scheduled.length > 0 ? Math.round((completed.length / scheduled.length) * 100) : 0,
      };
    });
  },

  getCategoryStats(
    categories: Category[],
    habits: Habit[],
    completions: HabitCompletion[]
  ): CategoryStat[] {
    return categories.map((cat) => {
      const catHabits = habits.filter((h) => h.categoryId === cat.id);
      const catHabitIds = new Set(catHabits.map((h) => h.id));
      const catCompletions = completions.filter((c) => catHabitIds.has(c.habitId) && c.completed);

      // 30 day completion rate for category
      const rate = this.getPeriodCompletionRate(catHabits.filter((h) => h.active), completions, 30);

      return {
        categoryId: cat.id,
        categoryName: cat.name,
        color: cat.color,
        icon: cat.icon,
        habitCount: catHabits.length,
        totalCompletions: catCompletions.length,
        completionRate: rate,
      };
    });
  },

  getHabitPerformanceSeries(
    habits: Habit[],
    completions: HabitCompletion[]
  ) {
    return habits
      .filter((h) => h.active)
      .map((habit) => {
        const rate = streakService.calculateMonthlyCompletion(habit, completions);
        const streak = streakService.calculateCurrentStreak(habit, completions);
        return {
          name: habit.name,
          completionRate: rate,
          streak,
        };
      })
      .sort((a, b) => b.completionRate - a.completionRate);
  },
};
