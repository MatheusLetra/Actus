import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Category, CategoryStat, DashboardStats, Habit, HabitCompletion } from '@/types';
import { categoryRepository } from '@/repositories/categoryRepository';
import { habitRepository } from '@/repositories/habitRepository';
import { completionRepository } from '@/repositories/completionRepository';
import { seedService } from '@/services/seedService';
import { statisticsService } from '@/services/statisticsService';
import { dateService } from '@/services/dateService';

interface HabitContextType {
  categories: Category[];
  habits: Habit[];
  completions: HabitCompletion[];
  dashboardStats: DashboardStats;
  categoryStats: CategoryStat[];
  
  // Category Actions
  addCategory: (category: Omit<Category, 'id' | 'createdAt'>) => void;
  updateCategory: (category: Category) => void;
  deleteCategory: (id: string) => { success: boolean; message?: string };
  
  // Habit Actions
  addHabit: (habit: Omit<Habit, 'id' | 'createdAt'>) => void;
  updateHabit: (habit: Habit) => void;
  deleteHabit: (id: string) => void;
  toggleHabitActive: (id: string) => void;
  
  // Completion Actions
  toggleHabitCompletion: (habitId: string, dateStr?: string) => { completed: boolean };
  
  // Admin / Seed Actions
  resetToDemoData: () => void;
  exportData: () => string;
  importData: (jsonStr: string) => boolean;
}

const HabitContext = createContext<HabitContextType | undefined>(undefined);

export const HabitProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [completions, setCompletions] = useState<HabitCompletion[]>([]);

  // Initialize data on mount
  useEffect(() => {
    if (!seedService.isInitialized()) {
      const data = seedService.seedDemoData();
      setCategories(data.categories);
      setHabits(data.habits);
      setCompletions(data.completions);
    } else {
      setCategories(categoryRepository.getAll());
      setHabits(habitRepository.getAll());
      setCompletions(completionRepository.getAll());
    }
  }, []);

  // Compute Dashboard Stats reactively
  const dashboardStats = useMemo(() => {
    return statisticsService.getDashboardStats(habits, categories, completions);
  }, [habits, categories, completions]);

  // Compute Category Stats reactively
  const categoryStats = useMemo(() => {
    return statisticsService.getCategoryStats(categories, habits, completions);
  }, [categories, habits, completions]);

  // Category Operations
  const addCategory = (cat: Omit<Category, 'id' | 'createdAt'>) => {
    const newCat: Category = {
      ...cat,
      id: `cat_${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    const updated = categoryRepository.add(newCat);
    setCategories(updated);
  };

  const updateCategory = (cat: Category) => {
    const updated = categoryRepository.update(cat);
    setCategories(updated);
  };

  const deleteCategory = (id: string) => {
    const linkedHabits = habits.filter((h) => h.categoryId === id);
    if (linkedHabits.length > 0) {
      return {
        success: false,
        message: `Não é possível excluir. Existem ${linkedHabits.length} hábito(s) associados a esta categoria.`,
      };
    }
    const updated = categoryRepository.delete(id);
    setCategories(updated);
    return { success: true };
  };

  // Habit Operations
  const addHabit = (h: Omit<Habit, 'id' | 'createdAt'>) => {
    const newHabit: Habit = {
      ...h,
      id: `habit_${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    const updated = habitRepository.add(newHabit);
    setHabits(updated);
  };

  const updateHabit = (h: Habit) => {
    const updated = habitRepository.update(h);
    setHabits(updated);
  };

  const deleteHabit = (id: string) => {
    const updatedHabits = habitRepository.delete(id);
    const updatedCompletions = completionRepository.deleteByHabitId(id);
    setHabits(updatedHabits);
    setCompletions(updatedCompletions);
  };

  const toggleHabitActive = (id: string) => {
    const updated = habitRepository.toggleActive(id);
    setHabits(updated);
  };

  // Completion Operations
  const toggleHabitCompletion = (habitId: string, dateStr = dateService.getTodayString()) => {
    const result = completionRepository.toggle(habitId, dateStr);
    setCompletions(result.completions);
    return { completed: result.completed };
  };

  // Reset to Demo
  const resetToDemoData = () => {
    const data = seedService.seedDemoData();
    setCategories(data.categories);
    setHabits(data.habits);
    setCompletions(data.completions);
  };

  // Backup & Restore
  const exportData = () => {
    return JSON.stringify({ categories, habits, completions, version: 1 }, null, 2);
  };

  const importData = (jsonStr: string): boolean => {
    try {
      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed.categories) && Array.isArray(parsed.habits) && Array.isArray(parsed.completions)) {
        categoryRepository.saveAll(parsed.categories);
        habitRepository.saveAll(parsed.habits);
        completionRepository.saveAll(parsed.completions);
        setCategories(parsed.categories);
        setHabits(parsed.habits);
        setCompletions(parsed.completions);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  return (
    <HabitContext.Provider
      value={{
        categories,
        habits,
        completions,
        dashboardStats,
        categoryStats,
        addCategory,
        updateCategory,
        deleteCategory,
        addHabit,
        updateHabit,
        deleteHabit,
        toggleHabitActive,
        toggleHabitCompletion,
        resetToDemoData,
        exportData,
        importData,
      }}
    >
      {children}
    </HabitContext.Provider>
  );
};

export const useHabits = () => {
  const context = useContext(HabitContext);
  if (!context) {
    throw new Error('useHabits must be used within a HabitProvider');
  }
  return context;
};
