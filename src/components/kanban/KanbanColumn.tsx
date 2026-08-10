import React from 'react';
import type { Habit, KanbanColumn as KanbanColumnType, KanbanTask } from '@/types';
import { kanbanService } from '@/services/kanbanService';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { KanbanTaskCard } from './KanbanTaskCard';
import { Button } from '@/components/ui/button';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/utils/cn';

interface KanbanColumnProps {
  column: KanbanColumnType;
  tasks: KanbanTask[];
  habits: Habit[];
  onEditColumn: (column: KanbanColumnType) => void;
  onDeleteColumn: (column: KanbanColumnType) => void;
  onAddTask: (column: KanbanColumnType) => void;
  onEditTask: (task: KanbanTask) => void;
  onDeleteTask: (task: KanbanTask) => void;
}

export const KanbanColumn: React.FC<KanbanColumnProps> = ({
  column,
  tasks,
  habits,
  onEditColumn,
  onDeleteColumn,
  onAddTask,
  onEditTask,
  onDeleteTask,
}) => {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const sortedTasks = kanbanService.sortTasks(tasks);
  const habitById = (habitId: string | null | undefined) => habits.find((h) => h.id === habitId);

  return (
    <div
      className={cn(
        'flex w-full lg:w-72 lg:shrink-0 flex-col rounded-xl border bg-muted/40 p-3 transition-colors',
        isOver && 'ring-2 ring-primary/50'
      )}
    >
      <div className="flex items-center gap-2 px-1 pb-2">
        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: column.color }} />
        <span className="text-sm font-bold text-foreground flex-1 truncate">{column.name}</span>
        <span className="text-xs text-muted-foreground">{tasks.length}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          title="Editar coluna"
          onClick={() => onEditColumn(column)}
        >
          <Pencil className="w-3.5 h-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive hover:text-destructive"
          title="Excluir coluna"
          onClick={() => onDeleteColumn(column)}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>

      <div ref={setNodeRef} className="flex-1 min-h-24 space-y-2 rounded-lg">
        <SortableContext items={sortedTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {sortedTasks.map((task) => (
            <KanbanTaskCard
              key={task.id}
              task={task}
              habit={habitById(task.habitId)}
              onEdit={onEditTask}
              onDelete={onDeleteTask}
            />
          ))}
        </SortableContext>
        {sortedTasks.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-6">Arraste tarefas para cá ou adicione uma nova.</p>
        )}
      </div>

      <Button
        type="button"
        variant="ghost"
        className="mt-2 w-full text-muted-foreground hover:text-foreground"
        onClick={() => onAddTask(column)}
      >
        <Plus className="w-4 h-4 mr-1.5" />
        Adicionar tarefa
      </Button>
    </div>
  );
};
