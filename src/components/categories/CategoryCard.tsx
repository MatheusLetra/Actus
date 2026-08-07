import React, { useState } from 'react';
import type { Category } from '@/types';
import { useHabits } from '@/context/HabitContext';
import { IconRenderer } from '@/components/common/IconRenderer';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Edit2, Trash2, CheckSquare } from 'lucide-react';
import { DeleteConfirmDialog } from '@/components/common/DeleteConfirmDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

interface CategoryCardProps {
  category: Category;
  onEdit: (category: Category) => void;
}

export const CategoryCard: React.FC<CategoryCardProps> = ({ category, onEdit }) => {
  const { habits, deleteCategory } = useHabits();
  const linkedHabitsCount = habits.filter((h) => h.categoryId === category.id).length;

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [warningDialogOpen, setWarningDialogOpen] = useState(false);

  const handleDeleteClick = () => {
    if (linkedHabitsCount > 0) {
      setWarningDialogOpen(true);
    } else {
      setDeleteDialogOpen(true);
    }
  };

  return (
    <>
      <Card className="flex flex-col justify-between hover:shadow-md transition-shadow">
        <CardHeader className="p-5 pb-3">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs"
              style={{ backgroundColor: category.color }}
            >
              <IconRenderer name={category.icon} size={24} />
            </div>

            <div>
              <h3 className="font-bold text-lg text-foreground leading-tight">{category.name}</h3>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                <CheckSquare className="w-3.5 h-3.5" />
                <span>{linkedHabitsCount} hábito(s) cadastrado(s)</span>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-5 pt-2">
          <div className="h-1.5 w-full rounded-full" style={{ backgroundColor: `${category.color}30` }}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: linkedHabitsCount > 0 ? '100%' : '0%',
                backgroundColor: category.color,
              }}
            />
          </div>
        </CardContent>

        <CardFooter className="p-4 pt-0 border-t flex items-center justify-end gap-1 mt-auto">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => onEdit(category)}
            title="Editar Categoria"
          >
            <Edit2 className="w-4 h-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={handleDeleteClick}
            title="Excluir Categoria"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </CardFooter>
      </Card>

      {/* Direct Delete Confirm Dialog */}
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Excluir Categoria"
        description={`Tem certeza que deseja excluir a categoria "${category.name}"?`}
        onConfirm={() => deleteCategory(category.id)}
      />

      {/* Warning Dialog when habits are linked */}
      <Dialog open={warningDialogOpen} onOpenChange={setWarningDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive font-bold">Atenção: Hábitos Vinculados</DialogTitle>
          </DialogHeader>
          <div className="py-2 text-sm text-muted-foreground space-y-2">
            <p>
              A categoria <strong className="text-foreground">"{category.name}"</strong> possui{' '}
              <strong className="text-foreground">{linkedHabitsCount} hábito(s)</strong> vinculado(s).
            </p>
            <p>
              Você precisa excluir ou reatribuir os hábitos existentes antes de remover esta categoria.
            </p>
          </div>
          <DialogFooter>
            <Button variant="default" onClick={() => setWarningDialogOpen(false)}>
              Entendido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
