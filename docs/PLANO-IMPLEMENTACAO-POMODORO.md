# Plano de Implementação — Ferramenta Pomodoro

Documento de rastreamento do trabalho. Atualizar ao concluir cada etapa.
Legenda: `[x]` feito | `[ ]` pendente | `[~]` em andamento.

## Objetivo

Adicionar um menu **Ferramentas Úteis** (na Sidebar) e a primeira ferramenta: **Pomodoro** totalmente configurável, com notificação ao final do tempo, vínculo opcional a hábitos cadastrados, registro automático dos ciclos, pausa/retomada persistida e gráficos de métricas.

## Decisões (confirmadas com o usuário)

- Menu "Ferramentas" como **item da Sidebar** → rota `/tools` (lista de ferramentas) e `/tools/pomodoro`.
- Registro do ciclo de foco **automático** ao concluir.
- Notificação do navegador (Notification API) **+ som** (Web Audio), configurável.
- Sessão pausada **persistida no localStorage** (`remainingSeconds`) para retomar/concluir depois.

## Etapas

### 1. Types + constants
- [x] Definir em `src/types/index.ts`: `PomodoroCycleType`, `PomodoroSessionStatus`, `PomodoroSettings`, `PomodoroSession`, `PomodoroByHabitStat`, `PomodoroDailyStat`, `PomodoroStats`
- [x] Adicionar em `src/constants/index.ts` (`STORAGE_KEYS`): `pomodoroSettings`, `pomodoroSessions`

### 2. Lógica pura — `pomodoroService` + testes
- [x] Criar `src/services/pomodoroService.ts`: defaults/validação de settings, duração por tipo de ciclo, sequência de fases (pausa longa a cada N focos), `getPomodoroStats`
- [x] Criar `src/tests/pomodoroService.test.ts`

### 3. Persistência — `pomodoroRepository`
- [x] Criar `src/repositories/pomodoroRepository.ts` (settings + sessions via `storageService`)

### 4. Helpers de browser
- [x] Criar `src/services/notificationService.ts` (permissão + `new Notification`)
- [x] Criar `src/services/audioService.ts` (chime via Web Audio)

### 5. Estado — `HabitContext`
- [x] Adicionar `pomodoroSettings`, `pomodoroSessions`, `pomodoroStats` e ações (create/update/remove session, update settings, clear)

### 6. Hook — `usePomodoroTimer`
- [x] Criar `src/components/pomodoro/usePomodoroTimer.ts`: contagem regressiva, iniciar/pausar/retomar/concluir/pular, auto-avanço de fases, notificação/som ao concluir, restauração de sessão pausada

### 7. Componentes
- [x] `src/components/pomodoro/PomodoroTimer.tsx`
- [x] `src/components/pomodoro/PomodoroSettingsForm.tsx`
- [x] `src/components/pomodoro/PomodoroSessionLog.tsx`

### 8. Gráficos
- [x] `src/components/charts/PomodoroDailyChart.tsx`
- [x] `src/components/charts/PomodoroHabitChart.tsx`
- [x] `src/components/charts/PomodoroCycleDistribution.tsx`

### 9. Páginas + navegação
- [x] Criar `src/pages/Tools/index.tsx` (lista de ferramentas)
- [x] Criar `src/pages/Pomodoro/index.tsx`
- [x] Registrar rotas `/tools` e `/tools/pomodoro` em `src/routes/index.tsx` (arquivo protegido — autorizado pelo usuário)
- [x] Adicionar item "Ferramentas" na `Sidebar`
- [x] Atualizar `TITLE_MAP` no `AppLayout`

### 10. Validação
- [x] `npm run lint` (tsc --noEmit) — sem erros
- [x] `npm run test:run` (Vitest) — 16 testes passando (3 arquivos)
- [x] `npm run build` — build de produção gerado (apenas aviso pré-existente de tamanho de chunk)
- [x] Smoke test: dev server respondendo HTTP 200 e módulo da página Pomodoro compilando

## Anotações de execução

- `pomodoroRepository.add` remove qualquer sessão `running`/`paused` anterior, garantindo **uma única sessão ativa** por vez.
- Sessão pausada é persistida com `remainingSeconds`; ao recarregar, o hook `usePomodoroTimer` restaura como **pausada** (não auto-inicia) para o usuário retomar manualmente.
- Restauração no mount depende do `pomodoroSessions` do contexto (carregado assincronamente pelo Provider); guarda `restoredRef` evita conflito com sessões criadas pelo próprio hook.
- Notificações usam `Notification` API; se o navegador bloquear a permissão, o toggle reverte e exibe aviso no form.
- Decisão: foco concluído = registro automático (`status: 'completed'`); pausas também ficam no log (para a distribuição), mas só focos entram nas métricas de hábito/tempo.
- `skip` avança de fase sem registrar; `reset` cancela a sessão ativa e volta ao foco.
- Segunda rodada: concluir um foco com hábito vinculado agora também marca o hábito como concluído no dia (respeitando agendamento/atividade), os dados de pomodoro entram no backup/restore (`version: 2`), e o som usa `public/pomodoro-chime.wav` com fallback via Web Audio.

## Evoluções implementadas (segunda rodada)

- [x] **HabitCompletion automático**: ao concluir um foco com hábito vinculado, o hábito é marcado como concluído na data (via nova ação `completeHabitCompletion` no contexto + método idempotente `completionRepository.complete`). Respeita `habit.active` e `streakService.isHabitScheduledOnDate` (hábitos custom/semanais só completam nos dias agendados).
- [x] **Backup/restore com pomodoro**: `exportData` agora inclui `pomodoroSettings` e `pomodoroSessions` (`version: 2`); `importData` restaura os dados de pomodoro quando presentes (backups antigos sem esses campos continuam funcionando).
- [x] **Áudio customizado**: gerado `public/pomodoro-chime.wav` (chime de 2 notas, 1s, WAV 16-bit mono). `audioService.playChime` toca o arquivo e, se falhar (autoplay bloqueado/arquivo ausente), usa o chime via Web Audio como fallback (`playToneChime`).

## Possíveis evoluções (pendentes)

- Expor métricas de pomodoro no Dashboard.
- Permitir selecionar o hábito vinculado por sessão (hoje é um vínculo global no settings).
- Reagendar/editar ciclos registrados retroativamente.

