import React, { useState } from 'react';
import type { KanbanColumn } from '@/types';
import { kanbanService } from '@/services/kanbanService';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MoveRight } from 'lucide-react';

interface KanbanAdvanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskTitle: string;
  currentColumnId: string;
  columns: KanbanColumn[];
  onConfirm: (columnId: string) => void;
}

export const KanbanAdvanceDialog: React.FC<KanbanAdvanceDialogProps> = ({
  open,
  onOpenChange,
  taskTitle,
  currentColumnId,
  columns,
  onConfirm,
}) => {
  const [step, setStep] = useState<'confirm' | 'select'>('confirm');
  const destinationColumns = kanbanService.sortColumns(columns).filter((c) => c.id !== currentColumnId);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setStep('confirm');
    }
    onOpenChange(next);
  };

  const handleSelect = (columnId: string) => {
    onConfirm(columnId);
    setStep('confirm');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-foreground">
            {step === 'confirm' ? 'Avançar tarefa' : 'Escolher etapa de destino'}
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-muted-foreground">
            {step === 'confirm'
              ? `O foco foi concluído. Deseja avançar a tarefa "${taskTitle}" para uma nova etapa do quadro?`
              : 'Selecione a etapa para onde a tarefa deve ser movida.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'select' && (
          <div className="space-y-2 py-1">
            {destinationColumns.length > 0 ? (
              destinationColumns.map((column) => (
                <button
                  key={column.id}
                  type="button"
                  onClick={() => handleSelect(column.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border bg-background text-left text-sm font-medium text-foreground hover:bg-accent transition-colors cursor-pointer"
                >
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: column.color }} />
                  <span className="flex-1">{column.name}</span>
                  <MoveRight className="w-4 h-4 text-muted-foreground" />
                </button>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                Não há outras etapas disponíveis para mover a tarefa.
              </p>
            )}
          </div>
        )}

        <DialogFooter className="mt-4 gap-2">
          {step === 'confirm' ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Não
              </Button>
              <Button onClick={() => setStep('select')}>Sim, avançar</Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => setStep('confirm')}>
              Voltar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
