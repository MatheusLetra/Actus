import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type {
  Category,
  CategoryStat,
  DashboardStats,
  Habit,
  HabitCompletion,
  KanbanBoard,
  KanbanColumn,
  KanbanTask,
  Project,
  PomodoroSession,
  PomodoroSettings,
  PomodoroStats,
  SyncTombstone,
} from '@/types';
import { categoryRepository } from '@/repositories/categoryRepository';
import { habitRepository } from '@/repositories/habitRepository';
import { completionRepository } from '@/repositories/completionRepository';
import { pomodoroRepository } from '@/repositories/pomodoroRepository';
import { kanbanRepository } from '@/repositories/kanbanRepository';
import { projectRepository } from '@/repositories/projectRepository';
import { tombstoneRepository } from '@/repositories/tombstoneRepository';
import { seedService } from '@/services/seedService';
import { statisticsService } from '@/services/statisticsService';
import { pomodoroService } from '@/services/pomodoroService';
import { kanbanService } from '@/services/kanbanService';
import { projectService } from '@/services/projectService';
import { dateService } from '@/services/dateService';

interface HabitContextType {
  categories: Category[];
  habits: Habit[];
  completions: HabitCompletion[];
  dashboardStats: DashboardStats;
  categoryStats: CategoryStat[];
  tombstones: SyncTombstone[];

  // Project Actions
  projects: Project[];
  addProject: (project: Pick<Project, 'name' | 'color'>) => Project | null;
  updateProject: (project: Project) => boolean;
  deleteProject: (id: string) => boolean;

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
  completeHabitCompletion: (habitId: string, dateStr?: string) => void;

  // Pomodoro State & Actions
  pomodoroSettings: PomodoroSettings;
  pomodoroSessions: PomodoroSession[];
  pomodoroStats: PomodoroStats;
  updatePomodoroSettings: (settings: PomodoroSettings) => void;
  createPomodoroSession: (session: Omit<PomodoroSession, 'id'>) => PomodoroSession;
  createRetroactivePomodoro: (
    input: Parameters<typeof pomodoroService.createRetroactiveSession>[0],
    now?: number,
  ) => ReturnType<typeof pomodoroService.createRetroactiveSession>;
  updatePomodoroSession: (id: string, updates: Partial<Omit<PomodoroSession, 'id'>>) => void;
  removePomodoroSession: (id: string) => void;
  removeCompletedPomodoroSession: (id: string) => void;
  clearPomodoroSessions: () => void;

  // Kanban State & Actions
  kanbanBoard: KanbanBoard;
  kanbanColumns: KanbanColumn[];
  kanbanTasks: KanbanTask[];
  updateKanbanBoard: (board: KanbanBoard) => void;
  addKanbanColumn: (column: Omit<KanbanColumn, 'id' | 'createdAt' | 'order'>) => void;
  updateKanbanColumn: (column: KanbanColumn) => void;
  deleteKanbanColumn: (id: string) => void;
  addKanbanTask: (task: Omit<KanbanTask, 'id' | 'createdAt' | 'updatedAt' | 'order'>) => void;
  updateKanbanTask: (task: KanbanTask) => void;
  updateKanbanTaskProject: (taskId: string, projectId: string | null) => void;
  deleteKanbanTask: (id: string) => void;
  moveKanbanTask: (taskId: string, targetColumnId: string, targetIndex?: number) => void;

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
  const [pomodoroSettings, setPomodoroSettings] = useState<PomodoroSettings>(pomodoroService.getDefaultSettings());
  const [pomodoroSessions, setPomodoroSessions] = useState<PomodoroSession[]>([]);
  const [kanbanBoard, setKanbanBoard] = useState<KanbanBoard>(kanbanService.getDefaultBoard);
  const [kanbanColumns, setKanbanColumns] = useState<KanbanColumn[]>([]);
  const [kanbanTasks, setKanbanTasks] = useState<KanbanTask[]>([]);
  const [tombstones, setTombstones] = useState<SyncTombstone[]>(() => tombstoneRepository.getAll());
  const [projects, setProjects] = useState<Project[]>([]);

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
    setPomodoroSettings(pomodoroRepository.getSettings());
    setPomodoroSessions(pomodoroRepository.getAll());
    setKanbanBoard(kanbanRepository.initBoardIfMissing());
    setKanbanColumns(kanbanRepository.getColumns());
    setKanbanTasks(kanbanRepository.getTasks());
    setProjects(projectRepository.getAll());
    setTombstones(tombstoneRepository.getAll());
  }, []);

  // Compute Dashboard Stats reactively
  const dashboardStats = useMemo(() => {
    return statisticsService.getDashboardStats(habits, categories, completions);
  }, [habits, categories, completions]);

  // Compute Category Stats reactively
  const categoryStats = useMemo(() => {
    return statisticsService.getCategoryStats(categories, habits, completions);
  }, [categories, habits, completions]);

  // Compute Pomodoro Stats reactively
  const pomodoroStats = useMemo(() => {
    return pomodoroService.getPomodoroStats(pomodoroSessions, habits);
  }, [pomodoroSessions, habits]);

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
    setTombstones(tombstoneRepository.add('category', id));
    return { success: true };
  };

  // Project Operations
  const addProject = (input: Pick<Project, 'name' | 'color'>): Project | null => {
    if (!projectService.validate(input).valid) return null;
    const project = projectService.create(input);
    const updated = projectRepository.add(project);
    setProjects(updated);
    return project;
  };

  const updateProject = (project: Project): boolean => {
    const current = projects.find((item) => item.id === project.id);
    if (!current || !projectService.validate(project).valid) return false;
    const updatedProject = projectService.update(current, project);
    const updated = projectRepository.update(updatedProject);
    setProjects(updated);
    return true;
  };

  const deleteProject = (id: string): boolean => {
    if (!projects.some((project) => project.id === id)) return false;
    const deletedAt = Date.now();
    const updatedProjects = projectRepository.delete(id);
    const updatedTasks = kanbanTasks.map((task) =>
      task.projectId === id
        ? { ...task, projectId: null, updatedAt: new Date(deletedAt).toISOString() }
        : task
    );
    kanbanRepository.saveTasks(updatedTasks);
    setProjects(updatedProjects);
    setKanbanTasks(updatedTasks);
    setTombstones(tombstoneRepository.add('project', id, deletedAt));
    return true;
  };

  // Habit Operations
  const addHabit = (h: Omit<Habit, 'id' | 'createdAt'>) => {
    const now = new Date().toISOString();
    const newHabit: Habit = {
      ...h,
      id: `habit_${Date.now()}`,
      createdAt: now,
      updatedAt: now,
    };
    const updated = habitRepository.add(newHabit);
    setHabits(updated);
  };

  const updateHabit = (h: Habit) => {
    const updated = habitRepository.update({ ...h, updatedAt: new Date().toISOString() });
    setHabits(updated);
  };

  const deleteHabit = (id: string) => {
    const habitCompletionTombstones: SyncTombstone[] = completions
      .filter((c) => c.habitId === id)
      .map((c) => ({ kind: 'completion', id: `${c.habitId}|${c.date}`, deletedAt: Date.now() }));
    const updatedHabits = habitRepository.delete(id);
    const updatedCompletions = completionRepository.deleteByHabitId(id);
    setHabits(updatedHabits);
    setCompletions(updatedCompletions);
    setTombstones(
      tombstoneRepository.addAll([{ kind: 'habit', id, deletedAt: Date.now() }, ...habitCompletionTombstones])
    );
  };

  const toggleHabitActive = (id: string) => {
    const updated = habitRepository.toggleActive(id);
    setHabits(updated);
  };

  // Completion Operations
  const toggleHabitCompletion = (habitId: string, dateStr = dateService.getTodayString()) => {
    const result = completionRepository.toggle(habitId, dateStr);
    setCompletions(result.completions);
    setTombstones(
      result.completed
        ? tombstoneRepository.removeCompletion(habitId, dateStr)
        : tombstoneRepository.addCompletion(habitId, dateStr)
    );
    return { completed: result.completed };
  };

  const completeHabitCompletion = (habitId: string, dateStr = dateService.getTodayString()) => {
    const updated = completionRepository.complete(habitId, dateStr);
    setCompletions(updated);
    setTombstones(tombstoneRepository.removeCompletion(habitId, dateStr));
  };

  // Pomodoro Operations
  const updatePomodoroSettings = (settings: PomodoroSettings) => {
    pomodoroRepository.saveSettings(settings);
    setPomodoroSettings(settings);
  };

  const createPomodoroSession = (session: Omit<PomodoroSession, 'id'>): PomodoroSession => {
    const newSession: PomodoroSession = { ...session, id: `pomo_${Date.now()}` };
    const updated = pomodoroRepository.add(newSession);
    setPomodoroSessions(updated);
    return newSession;
  };

  const createRetroactivePomodoro = (
    input: Parameters<typeof pomodoroService.createRetroactiveSession>[0],
    now = Date.now(),
  ) => {
    const validation = pomodoroService.createRetroactiveSession(
      input,
      now,
      habits.map((habit) => habit.id),
      kanbanTasks.map((task) => task.id),
    );
    if (!validation.valid || !validation.session) return validation;

    createPomodoroSession(validation.session);
    if (validation.session.habitId) {
      completeHabitCompletion(validation.session.habitId, validation.session.date);
    }
    return validation;
  };

  const updatePomodoroSession = (id: string, updates: Partial<Omit<PomodoroSession, 'id'>>) => {
    const updated = pomodoroRepository.update(id, updates);
    setPomodoroSessions(updated);
  };

  const removePomodoroSession = (id: string) => {
    const updated = pomodoroRepository.remove(id);
    setPomodoroSessions(updated);
    setTombstones(tombstoneRepository.add('pomodoroSession', id));
  };

  const removeCompletedPomodoroSession = (id: string) => {
    const session = pomodoroSessions.find((item) => item.id === id);
    if (!session || session.status !== 'completed') return;
    const updated = pomodoroRepository.removeCompleted(id);
    setPomodoroSessions(updated);
    setTombstones(tombstoneRepository.add('pomodoroSession', id));
  };

  const clearPomodoroSessions = () => {
    const current = pomodoroSessions;
    const updated = pomodoroRepository.clear();
    setPomodoroSessions(updated);
    setTombstones(
      tombstoneRepository.addAll(
        current.map((s) => ({ kind: 'pomodoroSession' as const, id: s.id, deletedAt: Date.now() }))
      )
    );
  };

  // Kanban Operations
  const updateKanbanBoard = (board: KanbanBoard) => {
    const updated = { ...board, updatedAt: new Date().toISOString() };
    kanbanRepository.saveBoard(updated);
    setKanbanBoard(updated);
  };

  const addKanbanColumn = (column: Omit<KanbanColumn, 'id' | 'createdAt' | 'order'>) => {
    const order = kanbanColumns.length;
    const newColumn: KanbanColumn = {
      ...column,
      id: `col_${Date.now()}`,
      order,
      createdAt: new Date().toISOString(),
    };
    const updated = kanbanRepository.addColumn(newColumn);
    setKanbanColumns(kanbanService.reindexColumns(updated));
  };

  const updateKanbanColumn = (column: KanbanColumn) => {
    const updated = kanbanRepository.updateColumn(column);
    setKanbanColumns(updated);
  };

  const deleteKanbanColumn = (id: string) => {
    const columns = kanbanRepository.deleteColumn(id);
    const remainingColumns = kanbanService.sortColumns(columns);
    let tasks = kanbanRepository.getTasks();

    const orphanTasks = tasks.filter((t) => t.columnId === id);
    if (orphanTasks.length > 0) {
      const fallbackColumn = remainingColumns[0];
      if (fallbackColumn) {
        tasks = orphanTasks.reduce(
          (acc, t) => kanbanService.moveTask(acc, t.id, fallbackColumn.id),
          tasks
        );
      } else {
        tasks = tasks.filter((t) => t.columnId !== id);
        setTombstones(
          tombstoneRepository.addAll([
            { kind: 'kanbanColumn', id, deletedAt: Date.now() },
            ...orphanTasks.map((t) => ({ kind: 'kanbanTask' as const, id: t.id, deletedAt: Date.now() })),
          ])
        );
      }
      kanbanRepository.saveTasks(tasks);
      setKanbanTasks(tasks);
    } else {
      setTombstones(tombstoneRepository.add('kanbanColumn', id));
    }

    setKanbanColumns(kanbanService.reindexColumns(remainingColumns));
  };

  const addKanbanTask = (task: Omit<KanbanTask, 'id' | 'createdAt' | 'updatedAt' | 'order'>) => {
    const columnTasks = kanbanTasks.filter((t) => t.columnId === task.columnId);
    const newTask: KanbanTask = {
      ...task,
      id: `task_${Date.now()}`,
      order: columnTasks.length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const updated = kanbanRepository.addTask(newTask);
    setKanbanTasks(updated);
  };

  const updateKanbanTask = (task: KanbanTask) => {
    const updated = kanbanRepository.updateTask({ ...task, updatedAt: new Date().toISOString() });
    setKanbanTasks(updated);
  };

  const updateKanbanTaskProject = (taskId: string, projectId: string | null) => {
    const task = kanbanTasks.find((item) => item.id === taskId);
    if (!task || (projectId !== null && !projects.some((project) => project.id === projectId))) return;
    updateKanbanTask({ ...task, projectId });
  };

  const deleteKanbanTask = (id: string) => {
    const updated = kanbanRepository.deleteTask(id);
    setKanbanTasks(updated);
    setTombstones(tombstoneRepository.add('kanbanTask', id));

    if (pomodoroSettings.linkedTaskId === id) {
      updatePomodoroSettings({ ...pomodoroSettings, linkedTaskId: null });
    }
  };

  const moveKanbanTask = (taskId: string, targetColumnId: string, targetIndex?: number) => {
    const updated = kanbanService.moveTask(kanbanTasks, taskId, targetColumnId, targetIndex);
    kanbanRepository.saveTasks(updated);
    setKanbanTasks(updated);
  };

  // Reset to Demo
  const resetToDemoData = () => {
    const now = Date.now();
    const tombstonesToRecord: SyncTombstone[] = [
      ...categories.map((c) => ({ kind: 'category' as const, id: c.id, deletedAt: now })),
      ...habits.map((h) => ({ kind: 'habit' as const, id: h.id, deletedAt: now })),
      ...completions.map((c) => ({
        kind: 'completion' as const,
        id: `${c.habitId}|${c.date}`,
        deletedAt: now,
      })),
      ...pomodoroSessions.map((s) => ({ kind: 'pomodoroSession' as const, id: s.id, deletedAt: now })),
      ...kanbanColumns.map((c) => ({ kind: 'kanbanColumn' as const, id: c.id, deletedAt: now })),
      ...kanbanTasks.map((t) => ({ kind: 'kanbanTask' as const, id: t.id, deletedAt: now })),
      ...projects.map((project) => ({ kind: 'project' as const, id: project.id, deletedAt: now })),
    ];
    const data = seedService.seedDemoData();
    setCategories(data.categories);
    setHabits(data.habits);
    setCompletions(data.completions);
    projectRepository.saveAll([]);
    setProjects([]);
    setTombstones(tombstoneRepository.addAll(tombstonesToRecord));
  };

  // Backup & Restore
  const exportData = () => {
    return JSON.stringify(
      {
        categories,
        habits,
        completions,
        projects,
        pomodoroSettings,
        pomodoroSessions,
        kanbanBoard,
        kanbanColumns,
        kanbanTasks,
        tombstones,
        version: 3,
      },
      null,
      2
    );
  };

  const importData = (jsonStr: string): boolean => {
    try {
      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed.categories) && Array.isArray(parsed.habits) && Array.isArray(parsed.completions)) {
        const parsedProjects = Array.isArray(parsed.projects) ? parsed.projects : [];
        if (!parsedProjects.every((project: unknown) => {
          if (!project || typeof project !== 'object') return false;
          const candidate = project as Partial<Project>;
          return typeof candidate.id === 'string'
            && typeof candidate.name === 'string'
            && typeof candidate.color === 'string'
            && typeof candidate.createdAt === 'string'
            && typeof candidate.updatedAt === 'string'
            && projectService.validate(candidate as Project).valid;
        })) return false;
        const importedTombstones = Array.isArray(parsed.tombstones) ? parsed.tombstones : [];
        const importedProjects = parsedProjects.filter((project: Project) => {
          const tombstone = importedTombstones.find(
            (item: SyncTombstone) => item.kind === 'project' && item.id === project.id
          );
          return !tombstone || new Date(project.updatedAt).getTime() > tombstone.deletedAt;
        });

        categoryRepository.saveAll(parsed.categories);
        habitRepository.saveAll(parsed.habits);
        completionRepository.saveAll(parsed.completions);
        setCategories(parsed.categories);
        setHabits(parsed.habits);
        setCompletions(parsed.completions);
        projectRepository.saveAll(importedProjects);
        setProjects(importedProjects);

        if (Array.isArray(parsed.pomodoroSessions)) {
          pomodoroRepository.saveAll(parsed.pomodoroSessions);
          setPomodoroSessions(parsed.pomodoroSessions);
        }

        if (
          parsed.pomodoroSettings &&
          typeof parsed.pomodoroSettings === 'object' &&
          Number.isFinite(parsed.pomodoroSettings.focusMinutes)
        ) {
          const validation = pomodoroService.validateSettings(parsed.pomodoroSettings);
          if (validation.valid) {
            pomodoroRepository.saveSettings(parsed.pomodoroSettings);
            setPomodoroSettings(parsed.pomodoroSettings);
          }
        }

        if (
          parsed.kanbanBoard &&
          typeof parsed.kanbanBoard === 'object' &&
          typeof parsed.kanbanBoard.name === 'string'
        ) {
          kanbanRepository.saveBoard(parsed.kanbanBoard);
          setKanbanBoard(parsed.kanbanBoard);
        }

        if (Array.isArray(parsed.kanbanColumns)) {
          kanbanRepository.saveAllColumns(parsed.kanbanColumns);
          setKanbanColumns(parsed.kanbanColumns);
        }

        if (Array.isArray(parsed.kanbanTasks)) {
          const projectIds = new Set(importedProjects.map((project: Project) => project.id));
          const importedTasks = parsed.kanbanTasks.map((task: KanbanTask) =>
            task.projectId && !projectIds.has(task.projectId) ? { ...task, projectId: null } : task
          );
          kanbanRepository.saveAllTasks(importedTasks);
          setKanbanTasks(importedTasks);
        }

        if (Array.isArray(parsed.tombstones)) {
          tombstoneRepository.saveAll(parsed.tombstones);
          setTombstones(parsed.tombstones);
        }

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
        tombstones,
        projects,
        addProject,
        updateProject,
        deleteProject,
        addCategory,
        updateCategory,
        deleteCategory,
        addHabit,
        updateHabit,
        deleteHabit,
        toggleHabitActive,
        toggleHabitCompletion,
        completeHabitCompletion,
        pomodoroSettings,
        pomodoroSessions,
        pomodoroStats,
        updatePomodoroSettings,
        createPomodoroSession,
        createRetroactivePomodoro,
        updatePomodoroSession,
        removePomodoroSession,
        removeCompletedPomodoroSession,
        clearPomodoroSessions,
        kanbanBoard,
        kanbanColumns,
        kanbanTasks,
        updateKanbanBoard,
        addKanbanColumn,
        updateKanbanColumn,
        deleteKanbanColumn,
        addKanbanTask,
        updateKanbanTask,
        updateKanbanTaskProject,
        deleteKanbanTask,
        moveKanbanTask,
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
