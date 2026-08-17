import React from 'react';
import type { Habit, KanbanColumn, KanbanTask, Project } from '@/types';
import { kanbanService } from '@/services/kanbanService';
import { useHabits } from '@/context/HabitContext';
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { KanbanColumn as KanbanColumnView } from './KanbanColumn';
import { KanbanTaskCard } from './KanbanTaskCard';

interface KanbanBoardProps {
  columns: KanbanColumn[];
  tasks: KanbanTask[];
  habits: Habit[];
  projects: Project[];
  onEditColumn: (column: KanbanColumn) => void;
  onDeleteColumn: (column: KanbanColumn) => void;
  onAddTask: (column: KanbanColumn) => void;
  onEditTask: (task: KanbanTask) => void;
  onDeleteTask: (task: KanbanTask) => void;
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  columns,
  tasks,
  habits,
  projects,
  onEditColumn,
  onDeleteColumn,
  onAddTask,
  onEditTask,
  onDeleteTask,
}) => {
  const { moveKanbanTask } = useHabits();
  const [activeTask, setActiveTask] = React.useState<KanbanTask | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === String(event.active.id)) ?? null;
    setActiveTask(task);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    const overTask = tasks.find((t) => t.id === overId);
    const targetColumnId = overTask ? overTask.columnId : overId;

    let targetIndex: number | undefined;
    if (overTask) {
      const columnTasks = kanbanService.sortTasks(
        tasks.filter((t) => t.columnId === targetColumnId && t.id !== activeId)
      );
      const index = columnTasks.findIndex((t) => t.id === overTask.id);
      targetIndex = index === -1 ? columnTasks.length : index;
    }

    moveKanbanTask(activeId, targetColumnId, targetIndex);
  };

  const habitById = (habitId: string | null | undefined) => habits.find((h) => h.id === habitId);
  const projectById = (projectId: string | null | undefined) => projects.find((project) => project.id === projectId);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveTask(null)}
    >
      <div className="flex flex-col items-stretch gap-4 lg:flex-row lg:items-start lg:overflow-x-auto lg:pb-4">
        {kanbanService.sortColumns(columns).map((column) => (
          <KanbanColumnView
            key={column.id}
            column={column}
            tasks={tasks.filter((t) => t.columnId === column.id)}
            habits={habits}
            projects={projects}
            onEditColumn={onEditColumn}
            onDeleteColumn={onDeleteColumn}
            onAddTask={onAddTask}
            onEditTask={onEditTask}
            onDeleteTask={onDeleteTask}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeTask ? (
          <KanbanTaskCard
            task={activeTask}
            habit={habitById(activeTask.habitId)}
            project={projectById(activeTask.projectId)}
            overlay
            onEdit={() => {}}
            onDelete={() => {}}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};
