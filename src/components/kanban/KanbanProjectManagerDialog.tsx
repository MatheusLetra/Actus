import React, { useEffect, useState } from 'react';
import type { Project } from '@/types';
import { useHabits } from '@/context/HabitContext';
import { ColorPicker } from '@/components/common/ColorPicker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Pencil, Plus, Trash2 } from 'lucide-react';

interface KanbanProjectManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const KanbanProjectManagerDialog: React.FC<KanbanProjectManagerDialogProps> = ({
  open,
  onOpenChange,
}) => {
  const { projects, addProject, updateProject, deleteProject } = useHabits();
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#8b5cf6');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEditingProject(null);
    setProjectToDelete(null);
    setName('');
    setColor('#8b5cf6');
    setError('');
  }, [open]);

  const resetForm = () => {
    setEditingProject(null);
    setName('');
    setColor('#8b5cf6');
    setError('');
  };

  const handleEdit = (project: Project) => {
    setEditingProject(project);
    setName(project.name);
    setColor(project.color);
    setError('');
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const result = editingProject
        ? updateProject({ ...editingProject, name: name.trim(), color })
        : addProject({ name: name.trim(), color });

      if (!result) {
        setError('Informe um nome e selecione uma cor válida.');
        return;
      }
      resetForm();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = () => {
    if (!projectToDelete || submitting) return;
    setSubmitting(true);
    try {
      deleteProject(projectToDelete.id);
      if (editingProject?.id === projectToDelete.id) resetForm();
      setProjectToDelete(null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Projetos</DialogTitle>
          <DialogDescription>
            Crie identificadores para reconhecer rapidamente as tarefas do quadro.
          </DialogDescription>
        </DialogHeader>

        {projectToDelete ? (
          <div className="space-y-4" role="alertdialog" aria-labelledby="kanban-project-delete-title">
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <h3 id="kanban-project-delete-title" className="font-semibold text-foreground">
                Excluir o projeto &quot;{projectToDelete.name}&quot;?
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                As tarefas associadas continuarão existindo, mas ficarão sem projeto.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setProjectToDelete(null)} disabled={submitting}>
                Cancelar
              </Button>
              <Button type="button" variant="destructive" onClick={handleDelete} disabled={submitting}>
                Confirmar exclusão
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border bg-muted/20 p-3">
              <div className="space-y-1.5">
                <Label htmlFor="kanban-project-name">
                  {editingProject ? 'Editar projeto' : 'Novo projeto'}
                </Label>
                <Input
                  id="kanban-project-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Ex: Trabalho"
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? 'kanban-project-error' : undefined}
                  autoComplete="off"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Cor do projeto</Label>
                <ColorPicker selectedColor={color} onSelectColor={setColor} />
              </div>

              {error && <p id="kanban-project-error" className="text-xs font-medium text-destructive" role="alert">{error}</p>}

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                {editingProject && (
                  <Button type="button" variant="ghost" onClick={resetForm} disabled={submitting}>
                    Cancelar edição
                  </Button>
                )}
                <Button type="submit" disabled={submitting}>
                  <Plus className="mr-1.5 h-4 w-4" />
                  {editingProject ? 'Salvar projeto' : 'Criar projeto'}
                </Button>
              </div>
            </form>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Projetos cadastrados</h3>
              {projects.length === 0 ? (
                <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                  Nenhum projeto criado.
                </p>
              ) : (
                <ul className="max-h-56 space-y-2 overflow-y-auto pr-1" aria-label="Projetos cadastrados">
                  {projects.map((project) => (
                    <li key={project.id} className="flex min-w-0 items-center gap-2 rounded-lg border bg-card p-2.5">
                      <span
                        className="h-3 w-3 shrink-0 rounded-full ring-1 ring-black/10 dark:ring-white/20"
                        style={{ backgroundColor: project.color }}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium" title={project.name}>
                        {project.name}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 shrink-0"
                        onClick={() => handleEdit(project)}
                        aria-label={`Editar projeto ${project.name}`}
                        title="Editar projeto"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 shrink-0 text-destructive hover:text-destructive"
                        onClick={() => setProjectToDelete(project)}
                        aria-label={`Excluir projeto ${project.name}`}
                        title="Excluir projeto"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
