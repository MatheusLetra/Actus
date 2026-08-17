# AGENTS.md — Instruções para Trabalhar no Actus

Instruções para agentes que trabalham neste repositório. Baseadas na análise do código existente (sem suposições).

## Visão Geral

Aplicação web **Controle de Hábitos Pessoais** — cadastro, acompanhamento e análise de hábitos diários com streaks, estatísticas e gráficos. **100% no navegador (offline-first)**, persistência total via `localStorage`. Inclui **Ferramentas Úteis** (menu na Sidebar), com as ferramentas **Pomodoro** (timer configurável, registro de ciclos, notificações/som e gráficos de métricas) e **Quadro Kanban** (colunas/tarefas personalizáveis com drag and drop). Opcionalmente, há **login com Google** que sincroniza os dados com o **Firebase/Cloud Firestore** (credenciais em `.env`) — ver `docs/PLANEJAMENTO-SINCRONIZACAO-GOOGLE.md`.

## Stack / Tecnologias

- **React 19** + **Vite 8** + **TypeScript 6** (strict mode, `noEmit`)
- **Tailwind CSS v4** (plugin `@tailwindcss/vite`; design tokens via CSS variables em `src/index.css`)
- **Shadcn/UI primitives** sobre **Radix UI** (Dialog, Switch, Progress, Sheet, etc.)
- **React Router DOM 7** (`createBrowserRouter`)
- **Recharts 3** (gráficos), **lucide-react** (ícones)
- **@dnd-kit/core + @dnd-kit/sortable** (drag and drop do Quadro Kanban)
- **Vitest 4** (testes unitários), **oxlint** (configuração lint)

## Arquitetura (camadas)

Fluxo de dependência: **UI → Pages → Context → Repositories → storageService**, com lógica de negócio pura isolada em **Services**.

```
main.tsx ──> App.tsx
              ├─ ThemeProvider (aplica classe .dark/.light no <html>)
              └─ HabitProvider (estado central + stats derivados)
                   └─ AppRouter (createBrowserRouter)
                        └─ AppLayout (Sidebar + Header + <Outlet/>)
                             ├─ Dashboard │  Hábitos de hoje + cards de métricas
                             ├─ Habits     │  CRUD + filtros
                             ├─ Categories │  CRUD com proteção de vínculo
                             ├─ Tools      │  Lista de ferramentas úteis
                             │    ├─ Pomodoro │ Timer configurável + registro de ciclos + gráficos
                             │    └─ Kanban   │ Quadro com colunas/tarefas + drag and drop
                             ├─ History    │  Log diário + filtros por período
                             └─ Settings   │  Tema + backup/restore + reset
        └─ repositories (localStorage) ── services (date/streak/statistics/seed/pomodoro/kanban)
```

Regras de arquitetura:
- **Services são puros**: `dateService`, `streakService`, `statisticsService`, `seedService`, `pomodoroService`, `kanbanService` não dependem de React nem de componentes.
- **Helpers de browser separados**: `notificationService` (Notification API) e `audioService` (toca `public/pomodoro-chime.wav`, com fallback via Web Audio) são utilitários que acessam APIs do navegador — **não** são serviços puros e não devem conter lógica de negócio.
- **Repositories isolam a UI do `localStorage`**: páginas e componentes **nunca** chamam `localStorage` diretamente — passam por `storageService` + repositories.
- **Contexto concentra o estado e as ações**: componentes chamam funções do contexto (`useHabits()`), que gravam no storage e atualizam o estado.
- Stats derivados (`dashboardStats`, `categoryStats`, `pomodoroStats`) são calculados no `HabitProvider` com `useMemo`, dependentes de `habits`, `categories`, `completions`, `pomodoroSessions`.

## Estrutura do Projeto

```
src/
├── main.tsx / App.tsx / index.css
├── types/            Interfaces estritas (Category, Habit, HabitCompletion, stats, pomodoro, kanban)
├── constants/        STORAGE_KEYS, AVAILABLE_ICONS, COLOR_OPTIONS, DAYS_OF_WEEK, labels/cores pomodoro, KANBAN_DEFAULT_COLUMNS
├── utils/            cn() (clsx + tailwind-merge)
├── services/         dateService, streakService, statisticsService, seedService, pomodoroService, kanbanService
├── services/         notificationService, audioService (helpers de browser — não puros)
├── services/         syncMergeService.ts (merge puro de snapshots p/ sincronização)
├── services/firebase config.ts, authService.ts, syncService.ts (helpers de browser — não puros)
├── repositories/     storageService, habitRepository, categoryRepository, completionRepository, pomodoroRepository, kanbanRepository, tombstoneRepository
├── context/          ThemeContext, HabitContext, FirebaseContext
├── components/
│   ├── ui/           Primitivas Shadcn (button, card, dialog, sheet, badge, progress, switch, input, label)
│   ├── common/       IconRenderer, IconPicker, ColorPicker, DeleteConfirmDialog, EmptyState
│   ├── layout/       AppLayout, Sidebar, Header
│   ├── settings/     CloudSyncCard (login/sync Google)
│   ├── dashboard/    TodayHabitItem
│   ├── habits/       HabitCard, HabitFormDialog, CalendarHeatmap
│   ├── categories/   CategoryCard, CategoryFormDialog
│   ├── pomodoro/     PomodoroTimer, PomodoroSettingsForm, PomodoroSessionLog, usePomodoroTimer
│   ├── kanban/       KanbanBoard, KanbanColumn, KanbanTaskCard (+ KanbanTaskCardContent p/ overlay), KanbanColumnFormDialog,
│   │                 KanbanTaskFormDialog, KanbanBoardSettingsDialog, KanbanAdvanceDialog
│   └── charts/       Last7DaysChart, Last30DaysChart, CategoryDistributionChart, HabitPerformanceChart, PomodoroDailyChart, PomodoroHabitChart, PomodoroCycleDistribution
├── pages/            Dashboard, Habits, Categories, Tools, Pomodoro, Kanban, History, Settings
├── routes/           Configuração do React Router
└── tests/            dateService.test.ts, streakService.test.ts, pomodoroService.test.ts, kanbanService.test.ts, syncMergeService.test.ts
```

Arquivos de configuração raiz: `package.json`, `vite.config.ts`, `tsconfig*.json`, `.oxlintrc.json`, `index.html`, `.gitignore`, `docs/PLANO-IMPLEMENTACAO-POMODORO.md`, `docs/PLANO-IMPLEMENTACAO-QUADRO-KANBAN.md` e `docs/PLANEJAMENTO-SINCRONIZACAO-GOOGLE.md` (rastreamento de Pomodoro, Kanban e Sincronização). Ativo de áudio em `public/pomodoro-chime.wav`. Credenciais de Firebase em `.env` (não versionado) e `.env.example` (placeholders).

## Padrões de Código

- **Separation of Concerns**: código de UI, lógica de negócio e persistência em camadas distintas.
- **Serviços como object literals**: `export const dateService = { method() {...} }` — sem classes. Repositories seguem o mesmo padrão.
- **`React.FC<Props>`** para componentes; props tipadas com interface `NomeProps`.
- **`cn()`** para merge de classes Tailwind; **CVA** (`class-variance-authority`) para variantes (`Button`, `Badge`, `Sheet`).
- **Primitivas Shadcn** usam `React.forwardRef` + `displayName`.
- **Formulários controlados**: estado local com `useState`, validação manual por campo (erros em `errors: {...}`), exibição de mensagens em PT-BR.
- **Memoização** com `useMemo` para dados derivados em contexto e páginas.
- **Imports relativos em testes** (`../services/...`); no app, alias `@/` → `src/`.
- **Mobile-First**: grids responsivos; Sidebar desktop (`lg:block`) + Sheet de navegação no mobile.
- **Sem comentários** no código, a menos que solicitado. Código deve ser autoexplicativo.

## Convenções de Nomenclatura

| Item | Convenção | Exemplo |
|---|---|---|
| Arquivos | `kebab-case` | `habitRepository.ts`, `HabitFormDialog.tsx` |
| Componentes | `PascalCase` | `TodayHabitItem`, `EmptyState` |
| Serviços/repositories | `camelCase` (objeto) | `streakService`, `categoryRepository` |
| Types | `PascalCase` com sufixo descritivo | `HabitStreakInfo`, `DashboardStats`, `DateFilterOption` |
| Hooks de contexto | `useX` | `useHabits()`, `useTheme()` |
| Chaves de storage | prefixo `actus:` | `actus:habits`, `actus:theme` |
| IDs gerados | prefixo `cat_`/`habit_`/`pomo_`/`board_`/`col_`/`task_` + `Date.now()` | `pomo_1754654400000` |
| Completions | `c_<habitId>_<data>` | `c_agua_2026-08-07` |

## Comandos

```bash
npm install        # instalar dependências (Node 18+)
npm run dev        # servidor de desenvolvimento Vite (http://localhost:5173)
npm run build      # tsc -b + vite build (build de produção)
npm run preview    # pré-visualizar o build de produção
npm run lint       # verificação de tipos: tsc --noEmit (não é o oxlint!)
npm run test       # Vitest em modo watch
npm run test:run   # roda a suíte uma única vez
```

Observação: o script `lint` executa `tsc --noEmit` (validação de tipos), **não** o oxlint. Não existe script que execute oxlint.

## Testes

- Framework: **Vitest**; arquivos em `src/tests/*.test.ts`.
- Cobertura atual: `dateService.test.ts`, `streakService.test.ts`, `pomodoroService.test.ts`, `kanbanService.test.ts`, `syncMergeService.test.ts` e `habitRepository.test.ts` (73 testes — datas, streaks, pomodoro, kanban, versionamento de hábitos, comparação de snapshots e merge de sincronização).
- Testes existentes importam serviços diretamente (sem setup especial, sem jsdom).
- Para adicionar testes de novos serviços, criar `src/tests/<nome>.test.ts` seguindo o mesmo estilo (`describe`/`it`/`expect`).
- **Validar sempre**: `npm run test:run` antes de finalizar alterações.

## Tratamento de Erros

- Toda leitura/escrita no `localStorage` deve passar por `storageService`, que faz try/catch e retorna fallback seguro.
- `deleteCategory` retorna `{ success, message }` e **bloqueia** exclusão quando há hábitos vinculados à categoria.
- `importData` valida a estrutura do JSON (arrays `categories`, `habits`, `completions`; pomodoro e kanban opcionais) e retorna `boolean`.
- `pomodoroService.validateSettings` valida durações/intervados e retorna `{ valid, errors }` em PT-BR.
- `kanbanService.validateBoard` / `validateColumn` / `validateTask` validam nomes obrigatórios e retornam `{ valid, errors }` em PT-BR.
- `deleteKanbanColumn` move as tarefas da coluna para a primeira coluna restante; `deleteKanbanTask` limpa `linkedTaskId` do pomodoro.
- Notificações usam `Notification` API; se o navegador bloquear a permissão, o form reverte o toggle e exibe aviso.
- `audioService.playChime` tenta `public/pomodoro-chime.wav` e cai para chime via Web Audio se falhar.
- Firebase: credenciais via `.env` (`VITE_FIREBASE_*`); sem credenciais, `initializeApp` não roda (`services/firebase/config.ts`) e o card de sincronização fica oculto. Erros de sync usam `getErrorMessage` (PT-BR); popup fechado/cancelado é silencioso.
- Sync (chaves `actus:syncUser`, `actus:lastSyncAt`, `actus:tombstones`): Firestore com núcleo `users/{uid}` + subcoleções mensais; `syncMergeService.mergeSnapshots` união + last-writer-wins + tombstones de exclusão (desmarcar/apagar remove nos demais dispositivos; re-marcar revira o item). `Habit.updatedAt` resolve LWW por hábito; hábitos legados sem o campo usam fallback global apenas entre cópias legadas. A guarda anti-eco identifica o conteúdo do último write, compara dados de domínio sem o `updatedAt` global e o payload Firestore remove `undefined` recursivamente.
- Formulários validam campos obrigatórios e exibem mensagens de erro em PT-BR.
- `IconRenderer` possui fallback de ícone (padrão `Target`); gráficos e `EmptyState` tratam listas vazias.

## Como Criar Novas Funcionalidades

1. **Types primeiro**: definir/extender interfaces em `src/types/index.ts` e constantes em `src/constants/index.ts`.
2. **Lógica pura**: implementar regras de negócio como métodos de um service em `src/services/` (sem React). Datas sempre via `dateService` (strings `YYYY-MM-DD`, timezone-safe).
3. **Helpers de browser à parte**: APIs do navegador (Notification, Audio, timers de UI) ficam em serviços utilitários (`notificationService`, `audioService`) ou hooks (`usePomodoroTimer`) — nunca dentro de services puros.
4. **Persistência**: adicionar métodos ao repository correspondente em `src/repositories/` (nunca tocar `localStorage` fora de `storageService`).
5. **Estado**: expor estado e ações no `HabitContext` (ou novo contexto, seguindo o padrão `Provider` + `useX` com guarda de erro).
6. **UI**: criar componentes em `src/components/<dominio>/` (PascalCase, `React.FC`, `cn()`, primitivas de `ui/` para dialogs/botões/etc.).
7. **Página/rota**: montar a página em `src/pages/<Nome>/index.tsx` e registrar a rota em `src/routes/index.tsx`.
8. **Testes**: cobrir serviços novos/alterados em `src/tests/`.

## Como Validar Alterações

Sempre executar, nesta ordem, antes de concluir:

```bash
npm run lint       # tsc --noEmit — sem erros de tipo
npm run test:run   # todos os testes passando
npm run build      # build de produção gera sem erros
```

## Arquivos que NÃO Devem ser Modificados sem Autorização

- `src/types/index.ts` — contratos de dados centrais (mudanças quebram todo o app)
- `src/constants/index.ts` — chaves de storage, listas de ícones/cores/dias
- `vite.config.ts`, `tsconfig*.json`, `package.json` — configurações e dependências do build
- `index.html` — estrutura raiz da aplicação
- `src/routes/index.tsx` — alterar apenas ao adicionar/remover páginas, com autorização explícita

Alterações em `package.json` (novas dependências) exigem aprovação explícita do usuário.
