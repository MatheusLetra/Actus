import React, { useEffect, useState } from 'react';
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

interface KanbanBoardSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const KanbanBoardSettingsDialog: React.FC<KanbanBoardSettingsDialogProps> = ({ open, onOpenChange }) => {
  const { kanbanBoard, updateKanbanBoard } = useHabits();

  const [name, setName] = useState('');
  const [color, setColor] = useState('#8b5cf6');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setName(kanbanBoard.name);
      setColor(kanbanBoard.color);
      setError('');
    }
  }, [open, kanbanBoard]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const candidate = { ...kanbanBoard, name: name.trim(), color };
    const validation = kanbanService.validateBoard(candidate);
    if (!validation.valid) {
      setError(validation.errors.name || '');
      return;
    }

    updateKanbanBoard(candidate);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Configurar Quadro</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="kanban-board-name">Nome do Quadro *</Label>
            <Input
              id="kanban-board-name"
              placeholder="Ex: Meu Quadro de Tarefas..."
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            {error && <p className="text-xs font-medium text-destructive">{error}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Cor do Quadro</Label>
            <ColorPicker selectedColor={color} onSelectColor={setColor} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit">Salvar Alterações</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
