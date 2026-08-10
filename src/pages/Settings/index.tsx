import React, { useRef, useState } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { useHabits } from '@/context/HabitContext';
import { useFirebase } from '@/context/FirebaseContext';
import type { Theme } from '@/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sun, Moon, Monitor, Download, Upload, RotateCcw, ShieldCheck, HardDrive, Cloud, RefreshCw } from 'lucide-react';
import { DeleteConfirmDialog } from '@/components/common/DeleteConfirmDialog';
import { CloudSyncCard } from '@/components/settings/CloudSyncCard';
import { cn } from '@/utils/cn';

export const SettingsPage: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const { exportData, importData, resetToDemoData, habits, categories, completions } = useHabits();
  const { user, lastSyncAt } = useFirebase();

  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const jsonStr = exportData();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `actus-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const success = importData(content);
      if (success) {
        setImportStatus({ type: 'success', message: 'Dados importados com sucesso!' });
      } else {
        setImportStatus({ type: 'error', message: 'Falha ao importar. Arquivo JSON inválido.' });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-6 max-w-4xl animate-in fade-in duration-300">
      {/* Section 0: Google Cloud Sync */}
      <CloudSyncCard />

      {/* Section 1: Appearance & Theme */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Sun className="w-5 h-5 text-primary" />
            <span>Tema da Aplicação</span>
          </CardTitle>
          <CardDescription>Escolha como o Actus deve ser exibido na sua tela.</CardDescription>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            {[
              { id: 'light', label: 'Claro', icon: Sun },
              { id: 'dark', label: 'Escuro', icon: Moon },
              { id: 'system', label: 'Sistema', icon: Monitor },
            ].map((item) => {
              const Icon = item.icon;
              const isSelected = theme === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTheme(item.id as Theme)}
                  className={cn(
                    'flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all cursor-pointer space-y-2',
                    isSelected
                      ? 'border-primary bg-primary/10 text-primary shadow-xs font-bold'
                      : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground'
                  )}
                >
                  <Icon className="w-6 h-6" />
                  <span className="text-sm">{item.label}</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Backup & Restore */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-primary" />
            <span>Gerenciamento de Dados</span>
          </CardTitle>
          <CardDescription>
            Exporte uma cópia de segurança dos seus dados ou restaure um backup prévio.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <Button onClick={handleExport} variant="outline" className="flex-1">
              <Download className="w-4 h-4 mr-2" />
              Exportar Backup (JSON)
            </Button>

            <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="flex-1">
              <Upload className="w-4 h-4 mr-2" />
              Importar Backup
            </Button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImportFile}
              accept=".json"
              className="hidden"
            />
          </div>

          {importStatus && (
            <div
              className={cn(
                'p-3 rounded-lg text-sm font-medium border',
                importStatus.type === 'success'
                  ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                  : 'bg-destructive/10 text-destructive border-destructive/30'
              )}
            >
              {importStatus.message}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 3: Reset Demo Data */}
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-base font-bold text-destructive flex items-center gap-2">
            <RotateCcw className="w-5 h-5" />
            <span>Redefinir Dados de Demonstração</span>
          </CardTitle>
          <CardDescription>
            Restaura os hábitos, categorias e histórico padrão de demonstração da primeira execução.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Button variant="destructive" onClick={() => setResetDialogOpen(true)}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Restaurar Dados Iniciais
          </Button>
        </CardContent>
      </Card>

      {/* Section 4: System Information */}
      <Card className="bg-muted/20">
        <CardContent className="p-4 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            {user ? (
              <>
                <Cloud className="w-4 h-4 text-primary" />
                <span>Local + Nuvem (Google){lastSyncAt ? ' · sincronizado' : ''}</span>
                <RefreshCw className="w-3.5 h-3.5" />
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>Persistência 100% Local (Navegador)</span>
              </>
            )}
          </div>

          <div>
            <span>
              {categories.length} cat. | {habits.length} háb. | {completions.length} reg.
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Reset Confirmation Dialog */}
      <DeleteConfirmDialog
        open={resetDialogOpen}
        onOpenChange={setResetDialogOpen}
        title="Redefinir Todos os Dados"
        description="Esta ação substitui todos os seus dados atuais pelos hábitos e categorias padrão de demonstração. Deseja continuar?"
        onConfirm={resetToDemoData}
      />
    </div>
  );
};
