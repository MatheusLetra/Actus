import type { KanbanBoard, KanbanColumn, KanbanTask } from '@/types';
import { KANBAN_DEFAULT_COLUMNS } from '@/constants';

export interface KanbanColumnValidation {
  valid: boolean;
  errors: Partial<Record<'name', string>>;
}

export interface KanbanTaskValidation {
  valid: boolean;
  errors: Partial<Record<'title', string>>;
}

export interface KanbanBoardValidation {
  valid: boolean;
  errors: Partial<Record<'name', string>>;
}

export interface KanbanStats {
  totalTasks: number;
  totalLinkedTasks: number;
  tasksPerColumn: { columnId: string; count: number }[];
}

export interface KanbanTaskGroup {
  columnId: string;
  columnName: string;
  tasks: KanbanTask[];
}

function nowIso(): string {
  return new Date().toISOString();
}

export const kanbanService = {
  getDefaultBoard(): KanbanBoard {
    return {
      id: `board_${Date.now()}`,
      name: 'Meu Quadro',
      color: '#8b5cf6',
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
  },

  getDefaultColumns(): KanbanColumn[] {
    const timestamp = Date.now();
    return KANBAN_DEFAULT_COLUMNS.map((col, index) => ({
      id: `col_${timestamp}_${index}`,
      name: col.name,
      color: col.color,
      order: index,
      createdAt: nowIso(),
    }));
  },

  validateBoard(board: KanbanBoard): KanbanBoardValidation {
    const errors: Partial<Record<'name', string>> = {};
    if (!board.name || !board.name.trim()) {
      errors.name = 'O nome do quadro é obrigatório.';
    }
    return { valid: Object.keys(errors).length === 0, errors };
  },

  validateColumn(column: KanbanColumn): KanbanColumnValidation {
    const errors: Partial<Record<'name', string>> = {};
    if (!column.name || !column.name.trim()) {
      errors.name = 'O nome da coluna é obrigatório.';
    }
    return { valid: Object.keys(errors).length === 0, errors };
  },

  validateTask(task: KanbanTask): KanbanTaskValidation {
    const errors: Partial<Record<'title', string>> = {};
    if (!task.title || !task.title.trim()) {
      errors.title = 'O título da tarefa é obrigatório.';
    }
    return { valid: Object.keys(errors).length === 0, errors };
  },

  sortColumns(columns: KanbanColumn[]): KanbanColumn[] {
    return [...columns].sort((a, b) => a.order - b.order);
  },

  sortTasks(tasks: KanbanTask[]): KanbanTask[] {
    return [...tasks].sort((a, b) => a.order - b.order);
  },

  reindexColumns(columns: KanbanColumn[]): KanbanColumn[] {
    return columns.map((col, index) => ({ ...col, order: index }));
  },

  reindexTasks(tasks: KanbanTask[]): KanbanTask[] {
    return tasks.map((task, index) => ({ ...task, order: index }));
  },

  reindexTasksInColumn(tasks: KanbanTask[], columnId: string): KanbanTask[] {
    const columnTasks = tasks
      .filter((t) => t.columnId === columnId)
      .sort((a, b) => a.order - b.order)
      .map((task, index) => ({ ...task, order: index }));
    const others = tasks.filter((t) => t.columnId !== columnId);
    return [...others, ...columnTasks];
  },

  moveTask(tasks: KanbanTask[], taskId: string, targetColumnId: string, targetIndex?: number): KanbanTask[] {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return tasks;

    const withoutTask = tasks.filter((t) => t.id !== taskId);
    const sourceColumnId = task.columnId;
    const moved: KanbanTask = { ...task, columnId: targetColumnId, updatedAt: nowIso() };

    const targetTasks = withoutTask
      .filter((t) => t.columnId === targetColumnId)
      .sort((a, b) => a.order - b.order);

    const normalizedIndex =
      targetIndex === undefined || targetIndex < 0 || targetIndex > targetTasks.length
        ? targetTasks.length
        : targetIndex;

    targetTasks.splice(normalizedIndex, 0, moved);

    if (sourceColumnId === targetColumnId) {
      const reindexed = targetTasks.map((t, index) => ({ ...t, order: index }));
      const others = withoutTask.filter((t) => t.columnId !== targetColumnId);
      return [...others, ...reindexed];
    }

    const sourceTasks = withoutTask
      .filter((t) => t.columnId === sourceColumnId)
      .sort((a, b) => a.order - b.order);
    const reindexedSource = sourceTasks.map((t, index) => ({ ...t, order: index }));
    const reindexedTarget = targetTasks.map((t, index) => ({ ...t, order: index }));

    const ids = new Set([...reindexedSource, ...reindexedTarget].map((t) => t.id));
    const untouched = withoutTask.filter((t) => !ids.has(t.id));

    return [...untouched, ...reindexedSource, ...reindexedTarget];
  },

  getKanbanStats(tasks: KanbanTask[]): KanbanStats {
    const columnIds = [...new Set(tasks.map((t) => t.columnId))];
    return {
      totalTasks: tasks.length,
      totalLinkedTasks: tasks.filter((t) => t.habitId).length,
      tasksPerColumn: columnIds.map((columnId) => ({
        columnId,
        count: tasks.filter((t) => t.columnId === columnId).length,
      })),
    };
  },

  getColumnsSortedForSelect(columns: KanbanColumn[], tasks: KanbanTask[]): KanbanTaskGroup[] {
    return this.sortColumns(columns).map((col) => ({
      columnId: col.id,
      columnName: col.name,
      tasks: this.sortTasks(tasks.filter((t) => t.columnId === col.id)),
    }));
  },
};
