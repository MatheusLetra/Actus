import { describe, expect, it } from 'vitest';
import type { KanbanColumn, KanbanTask } from '../types';
import { kanbanService } from '../services/kanbanService';

const nowIso = '2026-08-10T10:00:00.000Z';

function column(overrides: Partial<KanbanColumn>): KanbanColumn {
  return { id: `col_${overrides.order ?? 0}`, name: 'Coluna', color: '#ef4444', order: 0, createdAt: nowIso, ...overrides };
}

function task(overrides: Partial<KanbanTask>): KanbanTask {
  return {
    id: `task_${overrides.order ?? 0}`,
    columnId: 'col_0',
    title: 'Tarefa',
    order: 0,
    createdAt: nowIso,
    updatedAt: nowIso,
    ...overrides,
  };
}

describe('kanbanService', () => {
  it('should return default columns', () => {
    const columns = kanbanService.getDefaultColumns();
    expect(columns).toHaveLength(3);
    expect(columns.map((c) => c.name)).toEqual(['A Fazer', 'Em Andamento', 'Concluído']);
    expect(columns[0].order).toBe(0);
    expect(columns[2].order).toBe(2);
  });

  it('should validate board/column/task names', () => {
    expect(kanbanService.validateColumn(column({ name: '' })).valid).toBe(false);
    expect(kanbanService.validateColumn(column({ name: 'Em Andamento' })).valid).toBe(true);
    expect(kanbanService.validateTask(task({ title: '  ' })).valid).toBe(false);
    expect(kanbanService.validateTask(task({ title: 'Estudar' })).valid).toBe(true);
    expect(kanbanService.validateBoard({ id: 'b1', name: '', color: '#000', createdAt: nowIso, updatedAt: nowIso }).valid).toBe(false);
  });

  it('should sort columns and tasks by order', () => {
    const columns = [column({ id: 'c2', order: 2 }), column({ id: 'c0', order: 0 }), column({ id: 'c1', order: 1 })];
    expect(kanbanService.sortColumns(columns).map((c) => c.id)).toEqual(['c0', 'c1', 'c2']);

    const tasks = [task({ id: 't2', order: 2 }), task({ id: 't0', order: 0 }), task({ id: 't1', order: 1 })];
    expect(kanbanService.sortTasks(tasks).map((t) => t.id)).toEqual(['t0', 't1', 't2']);
  });

  it('should reindex columns and tasks', () => {
    const columns = [column({ id: 'c0', order: 5 }), column({ id: 'c1', order: 2 }), column({ id: 'c2', order: 9 })];
    expect(kanbanService.reindexColumns(columns).map((c) => c.order)).toEqual([0, 1, 2]);

    const tasks = [task({ id: 't0', order: 7 }), task({ id: 't1', order: 1 })];
    expect(kanbanService.reindexTasks(tasks).map((t) => t.order)).toEqual([0, 1]);
  });

  it('should reorder a task within the same column without duplicating', () => {
    const tasks = [
      task({ id: 't1', columnId: 'col_0', order: 0 }),
      task({ id: 't2', columnId: 'col_0', order: 1 }),
      task({ id: 't3', columnId: 'col_0', order: 2 }),
      task({ id: 't4', columnId: 'col_1', order: 0 }),
    ];

    const updated = kanbanService.moveTask(tasks, 't3', 'col_0', 0);
    expect(updated.filter((t) => t.id === 't3')).toHaveLength(1);
    expect(updated.filter((t) => t.id === 't1')).toHaveLength(1);
    expect(updated).toHaveLength(4);

    const col0 = updated.filter((t) => t.columnId === 'col_0').sort((a, b) => a.order - b.order);
    expect(col0.map((t) => t.id)).toEqual(['t3', 't1', 't2']);
    expect(col0.map((t) => t.order)).toEqual([0, 1, 2]);
  });

  it('should move a task to another column at the end by default', () => {
    const tasks = [
      task({ id: 't1', columnId: 'col_0', order: 0 }),
      task({ id: 't2', columnId: 'col_0', order: 1 }),
      task({ id: 't3', columnId: 'col_1', order: 0 }),
    ];

    const updated = kanbanService.moveTask(tasks, 't1', 'col_1');
    const moved = updated.find((t) => t.id === 't1');
    expect(moved?.columnId).toBe('col_1');
    expect(moved?.order).toBe(1);
    expect(updated.find((t) => t.id === 't3')?.order).toBe(0);
    expect(updated.find((t) => t.id === 't2')?.order).toBe(0);
  });

  it('should preserve a task project while moving it', () => {
    const tasks = [
      task({ id: 't1', columnId: 'col_0', order: 0, projectId: 'project_1' }),
      task({ id: 't2', columnId: 'col_1', order: 0 }),
    ];

    const updated = kanbanService.moveTask(tasks, 't1', 'col_1');

    expect(updated.find((item) => item.id === 't1')?.projectId).toBe('project_1');
  });

  it('should move a task to a specific index within the target column', () => {
    const tasks = [
      task({ id: 't1', columnId: 'col_0', order: 0 }),
      task({ id: 't2', columnId: 'col_0', order: 1 }),
      task({ id: 't3', columnId: 'col_1', order: 0 }),
      task({ id: 't4', columnId: 'col_1', order: 1 }),
    ];

    const updated = kanbanService.moveTask(tasks, 't1', 'col_1', 0);
    const col1 = updated.filter((t) => t.columnId === 'col_1').sort((a, b) => a.order - b.order);
    expect(col1.map((t) => t.id)).toEqual(['t1', 't3', 't4']);
    expect(col1.map((t) => t.order)).toEqual([0, 1, 2]);
  });

  it('should return the original tasks when the task does not exist', () => {
    const tasks = [task({ id: 't1', columnId: 'col_0', order: 0 })];
    expect(kanbanService.moveTask(tasks, 'missing', 'col_1')).toEqual(tasks);
  });

  it('should aggregate kanban stats', () => {
    const tasks = [
      task({ id: 't1', columnId: 'col_0', order: 0 }),
      task({ id: 't2', columnId: 'col_0', order: 1, habitId: 'h1' }),
      task({ id: 't3', columnId: 'col_1', order: 0 }),
    ];

    const stats = kanbanService.getKanbanStats(tasks);
    expect(stats.totalTasks).toBe(3);
    expect(stats.totalLinkedTasks).toBe(1);
    expect(stats.tasksPerColumn.find((c) => c.columnId === 'col_0')?.count).toBe(2);
    expect(stats.tasksPerColumn.find((c) => c.columnId === 'col_1')?.count).toBe(1);
  });
});
