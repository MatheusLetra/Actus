# Arquitetura — Actus

Documento de arquitetura da aplicação **Actus (Controle de Hábitos Pessoais)**. Reflete o estado atual do código em `src/`.

## Visão Geral

Aplicação web SPA **offline-first**, persistindo tudo no `localStorage` do navegador. Permite cadastrar categorias e hábitos, marcar conclusões diárias, calcular streaks, visualizar estatísticas/gráficos e usar ferramentas de produtividade (**Pomodoro** e **Quadro Kanban**). Interface responsiva Mobile-First em português (PT-BR).

## Stack / Tecnologias

| Categoria | Tecnologia |
|---|---|
| Core | React 19, Vite 8, TypeScript 6 (strict, `noEmit`) |
| Estilização | Tailwind CSS v4 (plugin `@tailwindcss/vite`, tokens via CSS variables), `cn()` (clsx + tailwind-merge), CVA |
| UI primitives | Shadcn/UI sobre Radix UI (Dialog, Switch, Progress, Sheet, Tooltip, Tabs, Select, Popover) |
| Roteamento | React Router DOM 7 (`createBrowserRouter`) |
| Gráficos | Recharts 3 |
| Ícones | lucide-react |
| Drag and drop | `@dnd-kit/core` + `@dnd-kit/sortable` (Quadro Kanban) |
| Notificação / Áudio | Web Notifications API + Web Audio (arquivo `public/pomodoro-chime.wav`) |
| Testes | Vitest 4 (unitários, ambiente node) |

## Camadas e Fluxo de Dependência

`UI → Pages → Context → Repositories → storageService`, com lógica de negócio pura em **Services**.

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

### Regras de camada

- **Services puros**: `dateService`, `streakService`, `statisticsService`, `seedService`, `pomodoroService` não dependem de React nem de componentes.
- **Helpers de browser à parte**: `notificationService` (Notification API) e `audioService` (som) acessam APIs do navegador — **não** são services puros e não contêm lógica de negócio.
- **Repositories isolam o `localStorage`**: páginas e componentes nunca chamam `localStorage` diretamente; todo acesso passa por `storageService` + repositories.
- **Contexto concentra estado e ações**: componentes chamam funções do contexto (`useHabits()`), que gravam no storage e atualizam o estado.

## Estrutura do Projeto (`src/`)

```
src/
├── main.tsx / App.tsx / index.css
├── types/            Interfaces estritas (Category, Habit, HabitCompletion, stats, pomodoro, kanban)
├── constants/        STORAGE_KEYS, AVAILABLE_ICONS, COLOR_OPTIONS, DAYS_OF_WEEK, labels/cores pomodoro, KANBAN_DEFAULT_COLUMNS
├── utils/            cn() (clsx + tailwind-merge)
├── services/         dateService, streakService, statisticsService, seedService, pomodoroService, kanbanService
├── services/         notificationService, audioService (helpers de browser — não puros)
├── services/         syncMergeService (merge puro de snapshots p/ sincronização)
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
│   ├── kanban/       KanbanBoard, KanbanColumn, KanbanTaskCard, KanbanColumnFormDialog,
│   │                 KanbanTaskFormDialog, KanbanBoardSettingsDialog, KanbanAdvanceDialog
│   └── charts/       Last7DaysChart, Last30DaysChart, CategoryDistributionChart, HabitPerformanceChart,
│                     PomodoroDailyChart, PomodoroHabitChart, PomodoroCycleDistribution
├── pages/            Dashboard, Habits, Categories, Tools, Pomodoro, Kanban, History, Settings
├── routes/           Configuração do React Router
└── tests/            dateService.test.ts, streakService.test.ts, pomodoroService.test.ts, kanbanService.test.ts, syncMergeService.test.ts
```

## Rotas

| Rota | Página | Função |
|---|---|---|
| `/` | Dashboard | Métricas gerais + hábitos do dia + gráficos rápidos |
| `/habits` | Habits | CRUD de hábitos com busca e filtros |
| `/categories` | Categories | CRUD de categorias (bloqueia exclusão com hábitos vinculados) |
| `/tools` | Tools | Menu de Ferramentas Úteis |
| `/tools/pomodoro` | Pomodoro | Timer, configurações, histórico e gráficos de ciclos |
| `/tools/kanban` | Kanban | Quadro com colunas/tarefas personalizáveis + drag and drop |
| `/history` | History | Log diário com filtros por período |
| `/settings` | Settings | Tema, backup/restore JSON, reset de dados |

## Gerenciamento de Estado

- **ThemeContext**: tema `light` / `dark` / `system`; aplica classe no `<html>` e persiste em `actus:theme`.
- **HabitContext**: estado central com `categories`, `habits`, `completions`, `pomodoroSettings`, `pomodoroSessions`, `kanbanBoard`, `kanbanColumns`, `kanbanTasks`, `tombstones` e todas as ações de domínio. Stats derivados via `useMemo`:
  - `dashboardStats` (depende de `habits`, `categories`, `completions`)
  - `categoryStats` (depende de `categories`, `habits`, `completions`)
  - `pomodoroStats` (depende de `pomodoroSessions`, `habits`)
  - Kanban: `kanbanService.getKanbanStats` calcula contagem por coluna (usado na página)
- Persistência imediata: cada ação grava no storage (via repository) e atualiza o estado em seguida.

## Persistência (`localStorage`)

Chaves centralizadas em `src/constants/index.ts`:

| Chave | Conteúdo |
|---|---|
| `actus:habits` | Hábitos cadastrados |
| `actus:categories` | Categorias |
| `actus:completions` | Conclusões por data (`YYYY-MM-DD`) |
| `actus:theme` | Tema (`light` \| `dark` \| `system`) |
| `actus:initialized` | Flag de seed inicial |
| `actus:pomodoroSettings` | Configurações do pomodoro |
| `actus:pomodoroSessions` | Ciclos de pomodoro (foco/pausas + sessão ativa) |
| `actus:kanbanBoard` | Quadro kanban (nome/cor) |
| `actus:kanbanColumns` | Colunas do quadro kanban |
| `actus:kanbanTasks` | Tarefas do quadro kanban |
| `actus:tombstones` | Marcas de exclusão da sincronização (`{ kind, id, deletedAt }`) |

Dados corrompidos são interceptados por `storageService` (try/catch) com fallback seguro.

## Principais Módulos

- **dateService**: operações timezone-safe sobre strings `YYYY-MM-DD` (usa meio-dia na parse para evitar shift de fuso).
- **streakService**: `isHabitScheduledOnDate`, `calculateCurrentStreak`, `calculateLongestStreak`, taxas semanais/mensais, `getHabitStreakInfo`.
- **statisticsService**: `getDashboardStats`, `getDailyCompletionsSeries`, `getCategoryStats`, `getHabitPerformanceSeries`.
- **seedService**: `seedDemoData` — popula categorias/hábitos/histórico (~30 dias) na primeira execução.
- **pomodoroService**: defaults/validação de settings, duração por tipo de ciclo, sequência de fases (pausa longa a cada N focos), `getPomodoroStats`.
- **kanbanService**: `getDefaultBoard`, `getDefaultColumns`, validação de board/column/task, ordenação/reindexação por `order`, `moveTask` (troca de coluna + reindexação de origem/destino), `getKanbanStats`, `getColumnsSortedForSelect`.
- **completionRepository**: `toggle` (marca/desmarca) e `complete` (idempotente) — usados pela UI e pelo pomodoro. Marcas de exclusão são gravadas pelo **tombstoneRepository** (deleções, desmarcações e reset de dados).

## Pomodoro (detalhes de implementação)

- Timer gerenciado pelo hook `usePomodoroTimer` (`src/components/pomodoro/usePomodoroTimer.ts`), com deadline absoluto (`endAt`) e `setInterval` apenas para atualizar a UI; ciclo foco → pausa curta/pausa longa (a cada `longBreakInterval` focos) → foco.
- **Uma única sessão ativa** por vez: `pomodoroRepository.add` remove sessões `running`/`paused` anteriores.
- Sessão `running` persiste `endAt`; pausa reconcilia pelo relógio real, congela `remainingSeconds` e remove o deadline; resume cria um novo deadline. Ao recarregar, uma sessão moderna ainda em andamento é reconciliada e restaurada como **pausada** (retomada manual), enquanto sessões pausadas mantêm o restante congelado.
- A reconciliação ocorre nos ticks e imediatamente ao retornar a uma aba visível. A conclusão é idempotente por sessão, protegendo registro, hábito, Kanban, notificação e áudio contra callbacks duplicados.
- Foco concluído = registro automático (`status: 'completed'`); se houver hábito vinculado, marca a conclusão do hábito na data (respeitando `active` e `isHabitScheduledOnDate`).
- `PomodoroSessionLog` exibe badges com o nome do hábito (variante `secondary`) e/ou da tarefa do quadro (variante `outline`) vinculados ao ciclo; no mobile o item empilha (texto + badges em linhas separadas) para evitar sobreposição.
- Vínculo de tarefa do Kanban (`linkedTaskId`): ao iniciar um foco, `taskId` é gravado na sessão; ao concluir, o `KanbanAdvanceDialog` pergunta se deseja avançar a tarefa e lista as colunas destino (exceto a atual). O vínculo de hábito não é alterado.
- Notificação via Notification API e som via `public/pomodoro-chime.wav` (fallback Web Audio), ambos configuráveis e best effort: não há garantia quando o navegador suspende completamente a página ou bloqueia autoplay.

## Kanban (detalhes de implementação)

- Ferramenta **Quadro Kanban** (`src/pages/Kanban/index.tsx`, rota `/tools/kanban`): quadro único com colunas e tarefas persistidas no `localStorage`.
- **Drag and drop** com `@dnd-kit/core` + `@dnd-kit/sortable`: `DndContext` com `closestCorners`, `MouseSensor` (distância 5, desktop) + `TouchSensor` (delay 200ms/tolerância 6, mobile) e `DragOverlay` (usa variante `overlay` do card, sem `useSortable`, para não duplicar droppables). Colunas são droppables (`useDroppable`), tarefas são sortables (`useSortable`).
- **Responsivo**: no mobile as colunas empilham verticalmente (`flex-col`, scroll vertical natural, `w-full`); no desktop (`lg+`) ficam lado a lado com scroll horizontal (`lg:flex-row`, `lg:w-72`). No mobile, os botões editar/excluir do card ficam sempre visíveis (não dependem de hover).
- Ordenação por campo `order`: `kanbanService.moveTask` remove a tarefa, insere na coluna alvo (índice opcional, padrão fim) e **reindexa** origem/destino para evitar drift de números; quando origem == destino (reordenação na mesma coluna), trata como caso único (não duplica).
- Colunas/tarefas têm modais de cadastro/edição (`KanbanColumnFormDialog`, `KanbanTaskFormDialog`) com validação em PT-BR e `ColorPicker` para cor.
- Tarefa pode vincular um hábito opcionalmente (`KanbanTask.habitId`); badge com ícone/cor do hábito no card.
- `deleteKanbanColumn` move as tarefas órfãs para a primeira coluna restante (ou exclui se não houver colunas); `deleteKanbanTask` limpa `linkedTaskId` das configurações do pomodoro.
- Backup/restore: `exportData` gera `version: 3` com kanban; `importData` restaura quando presente e válido (retrocompatível v1/v2).

## Sincronização com Google / Firebase

- **Autenticação**: Firebase Auth com `GoogleAuthProvider` (`src/services/firebase/authService.ts`); estado via `onAuthStateChanged`; sessão persistida no navegador. Credenciais em `.env` (`VITE_FIREBASE_*`), lidas em `src/services/firebase/config.ts` (sem `initializeApp` se ausentes, e o card é ocultado).
- **Persistência remota**: Cloud Firestore com núcleo por usuário (`users/{uid}`: categories, habits, settings, kanban) e **subcoleções mensais** para as listas que crescem (`completions/YYYY-MM`, `pomodoro/YYYY-MM`) — evita o limite de 1 MB/documento. `syncService.readSnapshot` recombina os meses; `writeSnapshot` reparticiona e remove meses órfãos.
- **`FirebaseProvider`** (dentro de `HabitProvider` em `src/App.tsx`): ao logar faz merge local+nuvem e aplica nos dois lados; escuta `onSnapshot` (nuvem → local) e faz push com debounce (local → nuvem). A guarda anti-eco identifica o conteúdo do último write, e a aplicação compara dados de domínio sem considerar o `updatedAt` global do snapshot.
- **`syncMergeService`** (puro): `mergeSnapshots` — união por `id` com last-writer-wins por item. `Habit.updatedAt` resolve LWW integral por hábito; hábitos legados sem o campo usam o timestamp global somente entre cópias legadas. Completions usam `updatedAt`/tombstones; kanban é reordenado/reindexado após o merge. O payload Firebase remove propriedades `undefined` sem alterar o estado original.
- **Regras Firestore** no console: `match /users/{userId}` + subcoleções com `allow read, write: if request.auth.uid == userId`.
- **UI**: `CloudSyncCard` em Configurações (login, "Sincronizar agora", "Sair"); rodapé da página indica status de sync.

### Dívida técnica de sincronização

`Category`, `KanbanColumn` e `PomodoroSettings` ainda dependem do timestamp global para conflitos porque não possuem versionamento próprio equivalente a `Habit.updatedAt`. Eles permanecem fora do escopo da correção de hábitos.

## Padrões de Código

- Separation of Concerns em camadas; services como object literals (sem classes).
- Componentes `React.FC<Props>`; props tipadas (`NomeProps`); primitivas com `forwardRef` + `displayName`.
- `cn()` para merge de classes; CVA para variantes (`Button`, `Badge`, `Sheet`).
- Formulários controlados com validação manual e mensagens em PT-BR.
- Imports no app via alias `@/` → `src/`; testes usam imports relativos.
- IDs gerados com prefixo + `Date.now()` (`cat_`, `habit_`, `pomo_`, `board_`, `col_`, `task_`); completions `c_<habitId>_<data>`.
- Sem comentários no código, a menos que solicitado.

## Testes

- Vitest, arquivos em `src/tests/*.test.ts` (ambiente node, sem jsdom).
- Cobertura atual: `dateService.test.ts`, `streakService.test.ts`, `pomodoroService.test.ts`, `kanbanService.test.ts`, `syncMergeService.test.ts`, `habitRepository.test.ts` — **73 testes**.
- Execução: `npm run test:run` (uma vez) ou `npm run test` (watch).

## Executar e Validar

```bash
npm install        # Node 18+
npm run dev        # http://localhost:5173
npm run build      # tsc -b + vite build
npm run preview    # pré-visualiza o build
npm run lint       # tsc --noEmit (validação de tipos; NÃO é oxlint)
npm run test:run   # testes unitários
```

Validação recomendada antes de concluir alterações: `lint` → `test:run` → `build`.
