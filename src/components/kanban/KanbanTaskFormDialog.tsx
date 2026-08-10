import React, { useEffect, useState } from 'react';
import type { KanbanTask } from '@/types';
import { useHabits } from '@/context/HabitContext';
import { kanbanService } from '@/services/kanbanService';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface KanbanTaskFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskToEdit?: KanbanTask | null;
  defaultColumnId?: string;
}

export const KanbanTaskFormDialog: React.FC<KanbanTaskFormDialogProps> = ({
  open,
  onOpenChange,
  taskToEdit,
  defaultColumnId,
}) => {
  const { habits, kanbanColumns, addKanbanTask, updateKanbanTask } = useHabits();

  const [columnId, setColumnId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [habitId, setHabitId] = useState('');
  const [error, setError] = useState('');

  const sortedColumns = kanbanService.sortColumns(kanbanColumns);

  useEffect(() => {
    if (taskToEdit) {
      setColumnId(taskToEdit.columnId);
      setTitle(taskToEdit.title);
      setDescription(taskToEdit.description || '');
      setHabitId(taskToEdit.habitId || '');
    } else {
      setColumnId(defaultColumnId || sortedColumns[0]?.id || '');
      setTitle('');
      setDescription('');
      setHabitId('');
    }
    setError('');
  }, [taskToEdit, open, defaultColumnId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const candidate: KanbanTask = {
      id: taskToEdit?.id ?? '',
      columnId,
      title: title.trim(),
      description: description.trim() || undefined,
      habitId: habitId || null,
      order: taskToEdit?.order ?? 0,
      createdAt: taskToEdit?.createdAt ?? '',
      updatedAt: taskToEdit?.updatedAt ?? '',
    };

    const validation = kanbanService.validateTask(candidate);
    if (!validation.valid) {
      setError(validation.errors.title || '');
      return;
    }

    if (taskToEdit) {
      updateKanbanTask({
        ...candidate,
        id: taskToEdit.id,
        createdAt: taskToEdit.createdAt,
        updatedAt: taskToEdit.updatedAt,
      });
    } else {
      addKanbanTask({
        columnId,
        title: title.trim(),
        description: description.trim() || undefined,
        habitId: habitId || null,
      });
    }

    onOpenChange(false);
  };

  const selectClass =
    'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            {taskToEdit ? 'Editar Tarefa' : 'Nova Tarefa'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="kanban-task-column">Etapa (Coluna) *</Label>
            <select
              id="kanban-task-column"
              className={selectClass}
              value={columnId}
              onChange={(e) => setColumnId(e.target.value)}
            >
              {sortedColumns.map((col) => (
                <option key={col.id} value={col.id}>
                  {col.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="kanban-task-title">Título *</Label>
            <Input
              id="kanban-task-title"
              placeholder="Ex: Revisar o plano de estudos..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            {error && <p className="text-xs font-medium text-destructive">{error}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="kanban-task-description">Descrição (opcional)</Label>
            <textarea
              id="kanban-task-description"
              rows={3}
              className={selectClass}
              placeholder="Detalhes adicionais da tarefa..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="kanban-task-habit">Hábito vinculado (opcional)</Label>
            <select
              id="kanban-task-habit"
              className={selectClass}
              value={habitId}
              onChange={(e) => setHabitId(e.target.value)}
            >
              <option value="">Nenhum</option>
              {habits.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">Relacione esta tarefa a um hábito cadastrado.</p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit">{taskToEdit ? 'Salvar Alterações' : 'Criar Tarefa'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
