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
  updatedAt?: string; // ISO — usado pelo merge de sincronização (reviver re-marcações)
}

export type TombstoneKind =
  | 'category'
  | 'habit'
  | 'completion'
  | 'pomodoroSession'
  | 'kanbanColumn'
  | 'kanbanTask';

// Marca de exclusão propagada na sincronização (tombstone).
// Para 'completion', `id` é o padrão `${habitId}|${date}`.
export interface SyncTombstone {
  kind: TombstoneKind;
  id: string;
  deletedAt: number; // epoch ms
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

export type PomodoroCycleType = 'focus' | 'shortBreak' | 'longBreak';
export type PomodoroSessionStatus = 'running' | 'paused' | 'completed' | 'cancelled';

export interface PomodoroSettings {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  longBreakInterval: number;
  autoStartBreaks: boolean;
  autoStartFocus: boolean;
  notificationsEnabled: boolean;
  soundEnabled: boolean;
  linkedHabitId?: string | null;
  linkedTaskId?: string | null;
}

export interface PomodoroSession {
  id: string;
  habitId?: string | null;
  taskId?: string | null;
  cycleType: PomodoroCycleType;
  plannedSeconds: number;
  remainingSeconds: number;
  status: PomodoroSessionStatus;
  startedAt: string;
  completedAt?: string;
  date: string;
}

export interface PomodoroByHabitStat {
  habitId: string;
  habitName: string;
  cycles: number;
  focusSeconds: number;
}

export interface PomodoroDailyStat {
  date: string;
  label: string;
  cycles: number;
  focusMinutes: number;
}

export interface PomodoroDistributionStat {
  cycleType: PomodoroCycleType;
  label: string;
  count: number;
}

export interface PomodoroStats {
  totalCycles: number;
  totalFocusCycles: number;
  totalFocusSeconds: number;
  totalFocusMinutes: number;
  todayFocusCycles: number;
  byHabit: PomodoroByHabitStat[];
  dailySeries: PomodoroDailyStat[];
  distribution: PomodoroDistributionStat[];
}

export interface KanbanBoard {
  id: string;
  name: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface KanbanColumn {
  id: string;
  name: string;
  color: string;
  order: number;
  createdAt: string;
}

export interface KanbanTask {
  id: string;
  columnId: string;
  title: string;
  description?: string;
  habitId?: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
}
