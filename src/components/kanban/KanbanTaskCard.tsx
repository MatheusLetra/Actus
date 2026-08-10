import React from 'react';
import type { Habit, KanbanTask } from '@/types';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { IconRenderer } from '@/components/common/IconRenderer';
import { Button } from '@/components/ui/button';
import { GripVertical, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/utils/cn';

interface KanbanTaskCardProps {
  task: KanbanTask;
  habit?: Habit;
  onEdit: (task: KanbanTask) => void;
  onDelete: (task: KanbanTask) => void;
  overlay?: boolean;
}

export const KanbanTaskCardContent: React.FC<{ task: KanbanTask; habit?: Habit }> = ({ task, habit }) => (
  <div className="flex items-start gap-2">
    <GripVertical className="w-4 h-4 mt-0.5 text-muted-foreground/60 shrink-0" />
    <div className="flex-1 min-w-0">
      <p className="text-sm font-semibold text-foreground break-words">{task.title}</p>
      {task.description && (
        <p className="text-xs text-muted-foreground mt-0.5 break-words line-clamp-2">{task.description}</p>
      )}
      {habit && (
        <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-medium text-foreground bg-muted/60 rounded-full px-2 py-0.5">
          <IconRenderer name={habit.icon || 'Target'} size={10} style={{ color: habit.color }} />
          {habit.name}
        </span>
      )}
    </div>
  </div>
);

export const KanbanTaskCard: React.FC<KanbanTaskCardProps> = ({ task, habit, onEdit, onDelete, overlay }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  if (overlay) {
    return (
      <div className="rounded-lg border bg-card p-3 shadow-md ring-2 ring-primary/40">
        <KanbanTaskCardContent task={task} habit={habit} />
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group rounded-lg border bg-card p-3 shadow-xs cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-60 shadow-md ring-2 ring-primary/40'
      )}
      {...attributes}
      {...listeners}
    >
      <KanbanTaskCardContent task={task} habit={habit} />

      <div className="flex items-center justify-end gap-1 mt-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          title="Editar tarefa"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(task);
          }}
        >
          <Pencil className="w-3.5 h-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive hover:text-destructive"
          title="Excluir tarefa"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(task);
          }}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
};
