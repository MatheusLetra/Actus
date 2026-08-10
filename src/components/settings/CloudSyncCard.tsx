import React, { useState } from 'react';
import { useFirebase } from '@/context/FirebaseContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Cloud, LogIn, LogOut, RefreshCw, LoaderCircle, AlertCircle, User, ShieldCheck } from 'lucide-react';
import { cn } from '@/utils/cn';

export const CloudSyncCard: React.FC = () => {
  const { status, user, lastSyncAt, error, isConfigured, signInWithGoogle, signOut, syncNow } = useFirebase();
  const [signOutDialogOpen, setSignOutDialogOpen] = useState(false);

  const isBusy = status === 'connecting' || status === 'signingOut' || status === 'syncing';

  const formatLastSync = (ts: number | null): string => {
    if (!ts) return 'Nunca sincronizado';
    return new Date(ts).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-bold flex items-center gap-2">
          <Cloud className="w-5 h-5 text-primary" />
          <span>Sincronização com a Nuvem</span>
        </CardTitle>
        <CardDescription>
          Entre com sua conta Google para salvar e sincronizar seus dados entre dispositivos.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {!isConfigured && (
          <div className="p-3 rounded-lg text-sm font-medium border bg-muted/40 text-muted-foreground">
            Sincronização não configurada. Adicione as credenciais do Firebase no arquivo <code className="text-xs">.env</code> para ativar essa opção.
          </div>
        )}

        {isConfigured && user && (
          <>
            <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/20">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName ?? 'Conta Google'}
                  className="w-10 h-10 rounded-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-primary/15 text-primary flex items-center justify-center">
                  <User className="w-5 h-5" />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{user.displayName ?? 'Conta Google'}</p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                onClick={() => void syncNow()}
                variant="outline"
                className="flex-1"
                disabled={isBusy}
              >
                <RefreshCw className={cn('w-4 h-4 mr-2', status === 'syncing' && 'animate-spin')} />
                {status === 'syncing' ? 'Sincronizando...' : 'Sincronizar agora'}
              </Button>
              <Button
                onClick={() => setSignOutDialogOpen(true)}
                variant="ghost"
                className="flex-1"
                disabled={isBusy}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sair da conta
              </Button>
            </div>

            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
              Seus dados continuam salvos localmente e são sincronizados automaticamente.
              Última sincronização: {formatLastSync(lastSyncAt)}.
            </p>
          </>
        )}

        {isConfigured && !user && (
          <>
            <Button onClick={() => void signInWithGoogle()} disabled={isBusy} className="w-full" variant="outline">
              {isBusy && status === 'connecting' ? (
                <LoaderCircle className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <span
                  className="w-5 h-5 mr-2 rounded-full bg-white flex items-center justify-center text-sm font-bold"
                  style={{
                    background: 'conic-gradient(#ea4335 0 25%, #fbbc05 0 50%, #34a853 0 75%, #4285f4 0)',
                  }}
                >
                  <span className="w-4 h-4 rounded-full bg-card flex items-center justify-center text-[11px] text-foreground">
                    G
                  </span>
                </span>
              )}
              {status === 'connecting' ? 'Conectando...' : <><LogIn className="w-4 h-4 mr-2" /> Entrar com Google</>}
            </Button>
            <p className="text-xs text-muted-foreground">
              Ao entrar, seus dados locais são preservados e mesclados com os dados da sua conta no Firebase.
            </p>
          </>
        )}

        {error && (
          <div className="p-3 rounded-lg text-sm font-medium border bg-destructive/10 text-destructive border-destructive/30 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            {error}
          </div>
        )}
      </CardContent>

      <Dialog open={signOutDialogOpen} onOpenChange={setSignOutDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Sair da conta?</DialogTitle>
            <DialogDescription>
              Você continuará com os dados no dispositivo. A sincronização em nuvem será desativada até o próximo login.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" onClick={() => setSignOutDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="default"
              onClick={() => {
                setSignOutDialogOpen(false);
                void signOut();
              }}
            >
              Sair
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};