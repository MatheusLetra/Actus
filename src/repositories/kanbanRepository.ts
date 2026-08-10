import { STORAGE_KEYS } from '@/constants';
import type { KanbanBoard, KanbanColumn, KanbanTask } from '@/types';
import { kanbanService } from '@/services/kanbanService';
import { storageService } from './storageService';

export const kanbanRepository = {
  getBoard(): KanbanBoard | null {
    return storageService.getItem<KanbanBoard | null>(STORAGE_KEYS.kanbanBoard, null);
  },

  saveBoard(board: KanbanBoard): void {
    storageService.setItem(STORAGE_KEYS.kanbanBoard, board);
  },

  initBoardIfMissing(): KanbanBoard {
    const existing = this.getBoard();
    if (existing) return existing;
    const board = kanbanService.getDefaultBoard();
    this.saveBoard(board);
    return board;
  },

  getColumns(): KanbanColumn[] {
    return storageService.getItem<KanbanColumn[]>(STORAGE_KEYS.kanbanColumns, []);
  },

  saveColumns(columns: KanbanColumn[]): void {
    storageService.setItem(STORAGE_KEYS.kanbanColumns, columns);
  },

  addColumn(column: KanbanColumn): KanbanColumn[] {
    const columns = this.getColumns();
    const updated = [...columns, column];
    this.saveColumns(updated);
    return updated;
  },

  updateColumn(column: KanbanColumn): KanbanColumn[] {
    const columns = this.getColumns();
    const updated = columns.map((c) => (c.id === column.id ? column : c));
    this.saveColumns(updated);
    return updated;
  },

  deleteColumn(id: string): KanbanColumn[] {
    const columns = this.getColumns();
    const updated = columns.filter((c) => c.id !== id);
    this.saveColumns(updated);
    return updated;
  },

  saveAllColumns(columns: KanbanColumn[]): void {
    this.saveColumns(columns);
  },

  getTasks(): KanbanTask[] {
    return storageService.getItem<KanbanTask[]>(STORAGE_KEYS.kanbanTasks, []);
  },

  saveTasks(tasks: KanbanTask[]): void {
    storageService.setItem(STORAGE_KEYS.kanbanTasks, tasks);
  },

  addTask(task: KanbanTask): KanbanTask[] {
    const tasks = this.getTasks();
    const updated = [...tasks, task];
    this.saveTasks(updated);
    return updated;
  },

  updateTask(task: KanbanTask): KanbanTask[] {
    const tasks = this.getTasks();
    const updated = tasks.map((t) => (t.id === task.id ? task : t));
    this.saveTasks(updated);
    return updated;
  },

  deleteTask(id: string): KanbanTask[] {
    const tasks = this.getTasks();
    const updated = tasks.filter((t) => t.id !== id);
    this.saveTasks(updated);
    return updated;
  },

  saveAllTasks(tasks: KanbanTask[]): void {
    this.saveTasks(tasks);
  },
};
