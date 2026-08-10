import React, { useEffect, useState } from 'react';
import type { PomodoroSettings } from '@/types';
import { useHabits } from '@/context/HabitContext';
import { pomodoroService } from '@/services/pomodoroService';
import { kanbanService } from '@/services/kanbanService';
import { notificationService } from '@/services/notificationService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Save, Bell } from 'lucide-react';

interface PomodoroSettingsFormProps {
  onSaved?: () => void;
}

export const PomodoroSettingsForm: React.FC<PomodoroSettingsFormProps> = ({ onSaved }) => {
  const { pomodoroSettings, updatePomodoroSettings, habits, kanbanColumns, kanbanTasks } = useHabits();

  const [focusMinutes, setFocusMinutes] = useState(pomodoroSettings.focusMinutes);
  const [shortBreakMinutes, setShortBreakMinutes] = useState(pomodoroSettings.shortBreakMinutes);
  const [longBreakMinutes, setLongBreakMinutes] = useState(pomodoroSettings.longBreakMinutes);
  const [longBreakInterval, setLongBreakInterval] = useState(pomodoroSettings.longBreakInterval);
  const [autoStartBreaks, setAutoStartBreaks] = useState(pomodoroSettings.autoStartBreaks);
  const [autoStartFocus, setAutoStartFocus] = useState(pomodoroSettings.autoStartFocus);
  const [notificationsEnabled, setNotificationsEnabled] = useState(pomodoroSettings.notificationsEnabled);
  const [soundEnabled, setSoundEnabled] = useState(pomodoroSettings.soundEnabled);
  const [linkedHabitId, setLinkedHabitId] = useState<string>(pomodoroSettings.linkedHabitId || '');
  const [linkedTaskId, setLinkedTaskId] = useState<string>(pomodoroSettings.linkedTaskId || '');

  const [errors, setErrors] = useState<Partial<Record<'focusMinutes' | 'shortBreakMinutes' | 'longBreakMinutes' | 'longBreakInterval', string>>>({});
  const [notificationWarning, setNotificationWarning] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setFocusMinutes(pomodoroSettings.focusMinutes);
    setShortBreakMinutes(pomodoroSettings.shortBreakMinutes);
    setLongBreakMinutes(pomodoroSettings.longBreakMinutes);
    setLongBreakInterval(pomodoroSettings.longBreakInterval);
    setAutoStartBreaks(pomodoroSettings.autoStartBreaks);
    setAutoStartFocus(pomodoroSettings.autoStartFocus);
    setNotificationsEnabled(pomodoroSettings.notificationsEnabled);
    setSoundEnabled(pomodoroSettings.soundEnabled);
    setLinkedHabitId(pomodoroSettings.linkedHabitId || '');
    setLinkedTaskId(pomodoroSettings.linkedTaskId || '');
  }, [pomodoroSettings]);

  const handleToggleNotifications = async (enabled: boolean) => {
    if (enabled && notificationService.isSupported()) {
      const permission = await notificationService.requestPermission();
      if (permission !== 'granted') {
        setNotificationsEnabled(false);
        setNotificationWarning('As notificações foram bloqueadas pelo navegador. Autorize nas configurações do navegador.');
        return;
      }
      setNotificationWarning('');
    }
    setNotificationsEnabled(enabled);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const candidate: PomodoroSettings = {
      focusMinutes: Number(focusMinutes),
      shortBreakMinutes: Number(shortBreakMinutes),
      longBreakMinutes: Number(longBreakMinutes),
      longBreakInterval: Number(longBreakInterval),
      autoStartBreaks,
      autoStartFocus,
      notificationsEnabled,
      soundEnabled,
      linkedHabitId: linkedHabitId || null,
      linkedTaskId: linkedTaskId || null,
    };

    const validation = pomodoroService.validateSettings(candidate);
    if (!validation.valid) {
      setErrors(validation.errors);
      setSaved(false);
      return;
    }

    setErrors({});
    updatePomodoroSettings(candidate);
    setSaved(true);
    onSaved?.();
  };

  const selectClass =
    'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

  return (
    <Card className="h-full">
      <CardHeader className="p-5 pb-2">
        <CardTitle className="text-base font-bold flex items-center gap-2">
          <Bell className="w-5 h-5 text-primary" />
          <span>Configurações</span>
        </CardTitle>
        <CardDescription>Personalize as durações, vínculo de hábito e alertas.</CardDescription>
      </CardHeader>

      <CardContent className="p-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pomo-focus">Foco (min) *</Label>
              <Input
                id="pomo-focus"
                type="number"
                min={1}
                value={focusMinutes}
                onChange={(e) => setFocusMinutes(Number(e.target.value))}
              />
              {errors.focusMinutes && <p className="text-xs font-medium text-destructive">{errors.focusMinutes}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pomo-short">Pausa curta (min) *</Label>
              <Input
                id="pomo-short"
                type="number"
                min={1}
                value={shortBreakMinutes}
                onChange={(e) => setShortBreakMinutes(Number(e.target.value))}
              />
              {errors.shortBreakMinutes && <p className="text-xs font-medium text-destructive">{errors.shortBreakMinutes}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pomo-long">Pausa longa (min) *</Label>
              <Input
                id="pomo-long"
                type="number"
                min={1}
                value={longBreakMinutes}
                onChange={(e) => setLongBreakMinutes(Number(e.target.value))}
              />
              {errors.longBreakMinutes && <p className="text-xs font-medium text-destructive">{errors.longBreakMinutes}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pomo-interval">Pausa longa a cada *</Label>
              <Input
                id="pomo-interval"
                type="number"
                min={1}
                step={1}
                value={longBreakInterval}
                onChange={(e) => setLongBreakInterval(Number(e.target.value))}
              />
              {errors.longBreakInterval && <p className="text-xs font-medium text-destructive">{errors.longBreakInterval}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pomo-habit">Hábito vinculado (opcional)</Label>
            <select id="pomo-habit" className={selectClass} value={linkedHabitId} onChange={(e) => setLinkedHabitId(e.target.value)}>
              <option value="">Nenhum</option>
              {habits.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">Ciclos de foco concluídos serão registrados para este hábito.</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pomo-task">Tarefa do quadro vinculada (opcional)</Label>
            <select id="pomo-task" className={selectClass} value={linkedTaskId} onChange={(e) => setLinkedTaskId(e.target.value)}>
              <option value="">Nenhum</option>
              {kanbanService.getColumnsSortedForSelect(kanbanColumns, kanbanTasks).map((group) => (
                <optgroup key={group.columnId} label={group.columnName}>
                  {group.tasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">Ao concluir um foco, você poderá avançar esta tarefa para outra etapa do quadro.</p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="font-semibold text-sm">Auto-iniciar pausas</Label>
                <p className="text-xs text-muted-foreground">Inicia a pausa automaticamente após o foco.</p>
              </div>
              <Switch checked={autoStartBreaks} onCheckedChange={setAutoStartBreaks} />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="font-semibold text-sm">Auto-iniciar foco</Label>
                <p className="text-xs text-muted-foreground">Inicia o próximo foco automaticamente após a pausa.</p>
              </div>
              <Switch checked={autoStartFocus} onCheckedChange={setAutoStartFocus} />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="font-semibold text-sm">Notificações</Label>
                <p className="text-xs text-muted-foreground">Avisa quando um tempo terminar.</p>
              </div>
              <Switch checked={notificationsEnabled} onCheckedChange={handleToggleNotifications} />
            </div>
            {notificationWarning && <p className="text-xs font-medium text-destructive">{notificationWarning}</p>}

            <div className="flex items-center justify-between">
              <div>
                <Label className="font-semibold text-sm">Som</Label>
                <p className="text-xs text-muted-foreground">Toca um som quando um tempo terminar.</p>
              </div>
              <Switch checked={soundEnabled} onCheckedChange={setSoundEnabled} />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            {saved && !errors.focusMinutes && !errors.shortBreakMinutes && !errors.longBreakMinutes && !errors.longBreakInterval && (
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Configurações salvas.</span>
            )}
            <Button type="submit" className="ml-auto">
              <Save className="w-4 h-4 mr-2" />
              Salvar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
