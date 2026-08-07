import React, { useEffect, useState } from 'react';
import type { Category } from '@/types';
import { useHabits } from '@/context/HabitContext';
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
import { IconPicker } from '@/components/common/IconPicker';
import { ColorPicker } from '@/components/common/ColorPicker';

interface CategoryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryToEdit?: Category | null;
}

export const CategoryFormDialog: React.FC<CategoryFormDialogProps> = ({
  open,
  onOpenChange,
  categoryToEdit,
}) => {
  const { addCategory, updateCategory } = useHabits();

  const [name, setName] = useState('');
  const [icon, setIcon] = useState('Heart');
  const [color, setColor] = useState('#ef4444');
  const [error, setError] = useState('');

  useEffect(() => {
    if (categoryToEdit) {
      setName(categoryToEdit.name);
      setIcon(categoryToEdit.icon);
      setColor(categoryToEdit.color);
    } else {
      setName('');
      setIcon('Heart');
      setColor('#ef4444');
    }
    setError('');
  }, [categoryToEdit, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('O nome da categoria é obrigatório.');
      return;
    }

    if (categoryToEdit) {
      updateCategory({
        ...categoryToEdit,
        name: name.trim(),
        icon,
        color,
      });
    } else {
      addCategory({
        name: name.trim(),
        icon,
        color,
      });
    }

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            {categoryToEdit ? 'Editar Categoria' : 'Nova Categoria'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="category-name">Nome da Categoria *</Label>
            <Input
              id="category-name"
              placeholder="Ex: Finanças, Lazer, Espiritualidade..."
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            {error && <p className="text-xs font-medium text-destructive">{error}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Ícone Visual</Label>
            <IconPicker selectedIcon={icon} onSelectIcon={setIcon} />
          </div>

          <div className="space-y-1.5">
            <Label>Cor da Categoria</Label>
            <ColorPicker selectedColor={color} onSelectColor={setColor} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit">{categoryToEdit ? 'Salvar Alterações' : 'Criar Categoria'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
