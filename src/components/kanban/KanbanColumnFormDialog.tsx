import React, { useEffect, useState } from 'react';
import type { KanbanColumn } from '@/types';
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
import { ColorPicker } from '@/components/common/ColorPicker';

interface KanbanColumnFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columnToEdit?: KanbanColumn | null;
}

export const KanbanColumnFormDialog: React.FC<KanbanColumnFormDialogProps> = ({
  open,
  onOpenChange,
  columnToEdit,
}) => {
  const { addKanbanColumn, updateKanbanColumn } = useHabits();

  const [name, setName] = useState('');
  const [color, setColor] = useState('#8b5cf6');
  const [error, setError] = useState('');

  useEffect(() => {
    if (columnToEdit) {
      setName(columnToEdit.name);
      setColor(columnToEdit.color);
    } else {
      setName('');
      setColor('#8b5cf6');
    }
    setError('');
  }, [columnToEdit, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const candidate: KanbanColumn = {
      id: columnToEdit?.id ?? '',
      name: name.trim(),
      color,
      order: columnToEdit?.order ?? 0,
      createdAt: columnToEdit?.createdAt ?? '',
    };

    const validation = kanbanService.validateColumn(candidate);
    if (!validation.valid) {
      setError(validation.errors.name || '');
      return;
    }

    if (columnToEdit) {
      updateKanbanColumn({ ...candidate, id: columnToEdit.id, createdAt: columnToEdit.createdAt });
    } else {
      addKanbanColumn({ name: name.trim(), color });
    }

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            {columnToEdit ? 'Editar Coluna' : 'Nova Coluna'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="kanban-column-name">Nome da Coluna *</Label>
            <Input
              id="kanban-column-name"
              placeholder="Ex: A Fazer, Em Andamento, Concluído..."
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            {error && <p className="text-xs font-medium text-destructive">{error}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Cor da Coluna</Label>
            <ColorPicker selectedColor={color} onSelectColor={setColor} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit">{columnToEdit ? 'Salvar Alterações' : 'Criar Coluna'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
