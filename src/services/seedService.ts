import { STORAGE_KEYS } from '@/constants';
import type { Category, Habit, HabitCompletion } from '@/types';
import { dateService } from './dateService';
import { storageService } from '../repositories/storageService';

export const seedService = {
  isInitialized(): boolean {
    return storageService.getItem<boolean>(STORAGE_KEYS.initialized, false);
  },

  seedDemoData(): { categories: Category[]; habits: Habit[]; completions: HabitCompletion[] } {
    const today = dateService.getTodayString();
    const startDate = dateService.subtractDays(today, 30);
    const createdAt = new Date().toISOString();

    const categories: Category[] = [
      {
        id: 'cat_saude',
        name: 'Saúde',
        icon: 'Heart',
        color: '#ef4444',
        createdAt,
      },
      {
        id: 'cat_estudos',
        name: 'Estudos',
        icon: 'BookOpen',
        color: '#3b82f6',
        createdAt,
      },
      {
        id: 'cat_exercicios',
        name: 'Exercícios',
        icon: 'Dumbbell',
        color: '#10b981',
        createdAt,
      },
      {
        id: 'cat_produtividade',
        name: 'Produtividade',
        icon: 'Brain',
        color: '#8b5cf6',
        createdAt,
      },
    ];

    const habits: Habit[] = [
      {
        id: 'habit_agua',
        name: 'Beber 2 Litros de Água',
        description: 'Manter a hidratação adequada ao longo do dia',
        categoryId: 'cat_saude',
        icon: 'Droplets',
        color: '#06b6d4',
        frequency: 'daily',
        startDate,
        active: true,
        createdAt,
      },
      {
        id: 'habit_leitura',
        name: 'Ler 30 Minutos',
        description: 'Ler livros de tecnologia ou desenvolvimento pessoal',
        categoryId: 'cat_estudos',
        icon: 'BookOpen',
        color: '#3b82f6',
        frequency: 'daily',
        startDate,
        active: true,
        createdAt,
      },
      {
        id: 'habit_treino',
        name: 'Fazer Exercícios',
        description: 'Musculação ou corrida 3 vezes na semana',
        categoryId: 'cat_exercicios',
        icon: 'Dumbbell',
        color: '#10b981',
        frequency: 'custom',
        targetDays: [1, 3, 5], // Segunda, Quarta, Sexta
        startDate,
        active: true,
        createdAt,
      },
      {
        id: 'habit_meditacao',
        name: 'Meditar por 10 min',
        description: 'Praticar atenção plena ao acordar',
        categoryId: 'cat_saude',
        icon: 'Moon',
        color: '#ec4899',
        frequency: 'daily',
        startDate,
        active: true,
        createdAt,
      },
      {
        id: 'habit_code',
        name: 'Estudar Programação',
        description: 'Praticar projetos em TypeScript e React',
        categoryId: 'cat_produtividade',
        icon: 'Code',
        color: '#8b5cf6',
        frequency: 'daily',
        startDate,
        active: true,
        createdAt,
      },
    ];

    // Generate 30 days of realistic history
    const completions: HabitCompletion[] = [];
    const past30Days = dateService.getLastNDays(31, today);

    past30Days.forEach((dateStr: string) => {
      // Habit: Água (85% completion rate)
      if (Math.random() < 0.85) {
        completions.push({
          id: `c_agua_${dateStr}`,
          habitId: 'habit_agua',
          date: dateStr,
          completed: true,
        });
      }

      // Habit: Leitura (75% completion rate)
      if (Math.random() < 0.75) {
        completions.push({
          id: `c_leitura_${dateStr}`,
          habitId: 'habit_leitura',
          date: dateStr,
          completed: true,
        });
      }

      // Habit: Treino (Seg, Qua, Sex - 90% completion rate on scheduled days)
      const dayOfWeek = dateService.getDayOfWeek(dateStr);
      if ([1, 3, 5].includes(dayOfWeek) && Math.random() < 0.9) {
        completions.push({
          id: `c_treino_${dateStr}`,
          habitId: 'habit_treino',
          date: dateStr,
          completed: true,
        });
      }

      // Habit: Meditação (65% completion rate)
      if (Math.random() < 0.65) {
        completions.push({
          id: `c_meditacao_${dateStr}`,
          habitId: 'habit_meditacao',
          date: dateStr,
          completed: true,
        });
      }

      // Habit: Code (80% completion rate)
      if (Math.random() < 0.8) {
        completions.push({
          id: `c_code_${dateStr}`,
          habitId: 'habit_code',
          date: dateStr,
          completed: true,
        });
      }
    });

    // Save to storage
    storageService.setItem(STORAGE_KEYS.categories, categories);
    storageService.setItem(STORAGE_KEYS.habits, habits);
    storageService.setItem(STORAGE_KEYS.completions, completions);
    storageService.setItem(STORAGE_KEYS.initialized, true);

    return { categories, habits, completions };
  },
};
