import React, { useState } from 'react';
import { useHabits } from '@/context/HabitContext';
import type { KanbanColumn, KanbanTask } from '@/types';
import { kanbanService } from '@/services/kanbanService';
import { KanbanBoard } from '@/components/kanban/KanbanBoard';
import { KanbanColumnFormDialog } from '@/components/kanban/KanbanColumnFormDialog';
import { KanbanTaskFormDialog } from '@/components/kanban/KanbanTaskFormDialog';
import { KanbanBoardSettingsDialog } from '@/components/kanban/KanbanBoardSettingsDialog';
import { DeleteConfirmDialog } from '@/components/common/DeleteConfirmDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { Button } from '@/components/ui/button';
import { Settings2, Plus } from 'lucide-react';

export const KanbanPage: React.FC = () => {
  const {
    kanbanBoard,
    kanbanColumns,
    kanbanTasks,
    habits,
    deleteKanbanColumn,
    deleteKanbanTask,
  } = useHabits();

  const [columnDialogOpen, setColumnDialogOpen] = useState(false);
  const [editingColumn, setEditingColumn] = useState<KanbanColumn | null>(null);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<KanbanTask | null>(null);
  const [defaultTaskColumnId, setDefaultTaskColumnId] = useState<string | undefined>(undefined);
  const [boardDialogOpen, setBoardDialogOpen] = useState(false);
  const [columnToDelete, setColumnToDelete] = useState<KanbanColumn | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<KanbanTask | null>(null);

  const stats = kanbanService.getKanbanStats(kanbanTasks);
  const hasColumns = kanbanColumns.length > 0;

  const handleCreateColumn = () => {
    setEditingColumn(null);
    setColumnDialogOpen(true);
  };

  const handleEditColumn = (column: KanbanColumn) => {
    setEditingColumn(column);
    setColumnDialogOpen(true);
  };

  const handleAddTask = (column: KanbanColumn) => {
    setEditingTask(null);
    setDefaultTaskColumnId(column.id);
    setTaskDialogOpen(true);
  };

  const handleCreateTask = () => {
    setEditingTask(null);
    setDefaultTaskColumnId(kanbanService.sortColumns(kanbanColumns)[0]?.id);
    setTaskDialogOpen(true);
  };

  const handleEditTask = (task: KanbanTask) => {
    setEditingTask(task);
    setDefaultTaskColumnId(undefined);
    setTaskDialogOpen(true);
  };

  const handleDeleteColumn = (column: KanbanColumn) => {
    setColumnToDelete(column);
  };

  const confirmDeleteColumn = () => {
    if (columnToDelete) {
      deleteKanbanColumn(columnToDelete.id);
      setColumnToDelete(null);
    }
  };

  const handleDeleteTask = (task: KanbanTask) => {
    setTaskToDelete(task);
  };

  const confirmDeleteTask = () => {
    if (taskToDelete) {
      deleteKanbanTask(taskToDelete.id);
      setTaskToDelete(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-foreground truncate">{kanbanBoard.name}</h2>
          <p className="text-xs text-muted-foreground">
            {stats.totalTasks} tarefa(s) · {kanbanColumns.length} etapa(s)
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setBoardDialogOpen(true)}>
            <Settings2 className="w-4 h-4 mr-1.5" />
            Configurar
          </Button>
          <Button variant="outline" size="sm" onClick={handleCreateColumn}>
            <Plus className="w-4 h-4 mr-1.5" />
            Nova Coluna
          </Button>
          <Button size="sm" onClick={handleCreateTask} disabled={!hasColumns}>
            <Plus className="w-4 h-4 mr-1.5" />
            Nova Tarefa
          </Button>
        </div>
      </div>

      {hasColumns ? (
        <KanbanBoard
          columns={kanbanColumns}
          tasks={kanbanTasks}
          habits={habits}
          onEditColumn={handleEditColumn}
          onDeleteColumn={handleDeleteColumn}
          onAddTask={handleAddTask}
          onEditTask={handleEditTask}
          onDeleteTask={handleDeleteTask}
        />
      ) : (
        <EmptyState
          icon="KanbanSquare"
          title="Nenhuma etapa cadastrada"
          description="Crie a primeira coluna do seu quadro para começar a organizar suas tarefas."
          actionLabel="+ Nova Coluna"
          onAction={handleCreateColumn}
        />
      )}

      <KanbanColumnFormDialog
        open={columnDialogOpen}
        onOpenChange={setColumnDialogOpen}
        columnToEdit={editingColumn}
      />

      <KanbanTaskFormDialog
        open={taskDialogOpen}
        onOpenChange={setTaskDialogOpen}
        taskToEdit={editingTask}
        defaultColumnId={defaultTaskColumnId}
      />

      <KanbanBoardSettingsDialog open={boardDialogOpen} onOpenChange={setBoardDialogOpen} />

      <DeleteConfirmDialog
        open={columnToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setColumnToDelete(null);
        }}
        title="Excluir coluna"
        description={`A coluna "${columnToDelete?.name ?? ''}" será excluída. As tarefas dela serão movidas para a primeira coluna restante.`}
        onConfirm={confirmDeleteColumn}
      />

      <DeleteConfirmDialog
        open={taskToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setTaskToDelete(null);
        }}
        title="Excluir tarefa"
        description={`A tarefa "${taskToDelete?.title ?? ''}" será excluída definitivamente.`}
        onConfirm={confirmDeleteTask}
      />
    </div>
  );
};
