export type HabitFrequency = 'daily' | 'weekly' | 'custom';

export interface Category {
  id: string;
  name: string;
  icon: string; // Lucide icon name, e.g. "Heart", "Dumbbell"
  color: string; // Hex or tailwind color class
  createdAt: string;
}

export interface Habit {
  id: string;
  name: string;
  description?: string;
  categoryId: string;
  icon?: string;
  color?: string;
  frequency: HabitFrequency;
  targetDays?: number[]; // Days of the week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
  startDate: string; // YYYY-MM-DD
  active: boolean;
  createdAt: string;
}

export interface HabitCompletion {
  id: string;
  habitId: string;
  date: string; // YYYY-MM-DD
  completed: boolean;
}

export type Theme = 'light' | 'dark' | 'system';

export interface HabitStreakInfo {
  currentStreak: number;
  longestStreak: number;
  weeklyCompletionRate: number; // 0 - 100
  monthlyCompletionRate: number; // 0 - 100
  totalCompletions: number;
}

export interface DashboardStats {
  activeHabitsCount: number;
  completedTodayCount: number;
  todayCompletionRate: number; // 0 - 100
  overallCurrentStreak: number;
  overallLongestStreak: number;
  totalCompletions: number;
  last7DaysRate: number; // 0 - 100
  last30DaysRate: number; // 0 - 100
}

export interface CategoryStat {
  categoryId: string;
  categoryName: string;
  color: string;
  icon: string;
  habitCount: number;
  totalCompletions: number;
  completionRate: number;
}

export interface HabitWithStats extends Habit {
  category?: Category;
  streakInfo: HabitStreakInfo;
  completedToday: boolean;
}

export type DateFilterOption = 'today' | 'last7' | 'last30' | 'thisMonth' | 'custom';
