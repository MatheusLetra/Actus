import type { PomodoroCycleType } from '@/types';

export const STORAGE_KEYS = {
  habits: 'actus:habits',
  categories: 'actus:categories',
  completions: 'actus:completions',
  theme: 'actus:theme',
  initialized: 'actus:initialized',
  pomodoroSettings: 'actus:pomodoroSettings',
  pomodoroSessions: 'actus:pomodoroSessions',
  kanbanBoard: 'actus:kanbanBoard',
  kanbanColumns: 'actus:kanbanColumns',
  kanbanTasks: 'actus:kanbanTasks',
} as const;

export const POMODORO_CYCLE_LABELS: Record<PomodoroCycleType, string> = {
  focus: 'Foco',
  shortBreak: 'Pausa Curta',
  longBreak: 'Pausa Longa',
};

export const POMODORO_DISTRIBUTION_COLORS: Record<PomodoroCycleType, string> = {
  focus: '#8b5cf6',
  shortBreak: '#10b981',
  longBreak: '#3b82f6',
};

export const AVAILABLE_ICONS = [
  'Heart',
  'Dumbbell',
  'BookOpen',
  'Brain',
  'Briefcase',
  'Wallet',
  'Coffee',
  'Moon',
  'Sun',
  'Smile',
  'Activity',
  'Bike',
  'Apple',
  'Droplets',
  'Music',
  'Gamepad',
  'Code',
  'GraduationCap',
  'Target',
  'Zap',
  'Flame',
  'Sparkles',
  'CheckCircle2',
  'ShieldCheck',
] as const;

export const COLOR_OPTIONS = [
  { name: 'Roxo', value: '#8b5cf6', bgClass: 'bg-purple-500' },
  { name: 'Azul', value: '#3b82f6', bgClass: 'bg-blue-500' },
  { name: 'Verde', value: '#10b981', bgClass: 'bg-emerald-500' },
  { name: 'Amarelo', value: '#f59e0b', bgClass: 'bg-amber-500' },
  { name: 'Laranja', value: '#f97316', bgClass: 'bg-orange-500' },
  { name: 'Rosa', value: '#ec4899', bgClass: 'bg-pink-500' },
  { name: 'Vermelho', value: '#ef4444', bgClass: 'bg-red-500' },
  { name: 'Ciano', value: '#06b6d4', bgClass: 'bg-cyan-500' },
  { name: 'Índigo', value: '#6366f1', bgClass: 'bg-indigo-500' },
  { name: 'Teal', value: '#14b8a6', bgClass: 'bg-teal-500' },
] as const;

export const DAYS_OF_WEEK = [
  { id: 0, short: 'Dom', full: 'Domingo' },
  { id: 1, short: 'Seg', full: 'Segunda-feira' },
  { id: 2, short: 'Ter', full: 'Terça-feira' },
  { id: 3, short: 'Qua', full: 'Quarta-feira' },
  { id: 4, short: 'Qui', full: 'Quinta-feira' },
  { id: 5, short: 'Sex', full: 'Sexta-feira' },
  { id: 6, short: 'Sáb', full: 'Sábado' },
] as const;

export const KANBAN_DEFAULT_COLUMNS = [
  { name: 'A Fazer', color: '#ef4444' },
  { name: 'Em Andamento', color: '#f59e0b' },
  { name: 'Concluído', color: '#10b981' },
] as const;
