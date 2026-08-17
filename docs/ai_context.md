# AI Context — Actus

Contexto rápido para agentes de IA trabalharem neste repositório. Complementa o `AGENTS.md` (nesta mesma pasta) com um resumo direto do projeto.

## O que é

Aplicação web SPA **Controle de Hábitos Pessoais**, 100% offline no navegador, persistindo em `localStorage`. Inclui hábitos/categorias/conclusões com streaks e gráficos, além de **Ferramentas Úteis** com **Pomodoro** e **Quadro Kanban**.

## Stack

- React 19 + Vite 8 + TypeScript 6 (strict, `noEmit`)
- Tailwind CSS v4 (tokens via CSS variables), Shadcn/UI + Radix UI, `cn()`, CVA
- React Router DOM 7, Recharts 3, lucide-react
- **@dnd-kit/core + @dnd-kit/sortable** (drag and drop do Kanban)
- Vitest 4 (testes), oxlint (config de lint — sem script dedicado)

## Estrutura (essencial)

```
src/
├── types/        # Interfaces (Category, Habit, HabitCompletion, stats, pomodoro, kanban)
├── constants/    # STORAGE_KEYS (actus:*), ícones, cores, dias da semana, labels pomodoro, colunas padrão kanban
├── services/     # Puros: date, streak, statistics, seed, pomodoro, kanban, syncMerge
│                 # Browser helpers: notificationService, audioService, firebase/ (NÃO puros)
├── repositories/ # storageService + habit/category/completion/pomodoro/kanban/tombstone
├── context/      # ThemeContext, HabitContext, FirebaseContext
├── components/   # ui/, common/, layout/, dashboard/, habits/, categories/, pomodoro/, kanban/, charts/
├── pages/        # Dashboard, Habits, Categories, Tools, Pomodoro, Kanban, History, Settings
├── routes/       # createBrowserRouter
└── tests/        # dateService, streakService, pomodoroService, kanbanService, syncMergeService
```

## Arquitetura (resumo)

`UI → Pages → Context → Repositories → storageService`, com regras de negócio puras em services.

- **HabitProvider** concentra estado e ações; stats derivados via `useMemo` (`dashboardStats`, `categoryStats`, `pomodoroStats`).
- **Toda** leitura/escrita no `localStorage` passa por `storageService` (try/catch com fallback). Nunca chamar `localStorage` em páginas/componentes.
- Services puros não tocam React nem APIs de browser.

## Rotas

`/` (Dashboard) · `/habits` · `/categories` · `/tools` · `/tools/pomodoro` · `/tools/kanban` · `/history` · `/settings`

## Convenções

| Item | Convenção |
|---|---|
| Arquivos | `kebab-case` |
| Componentes | `PascalCase`, `React.FC<Props>` |
| Services/repos | `camelCase` como object literal (`export const dateService = { ... }`) |
| Chaves storage | prefixo `actus:` |
| IDs gerados | `cat_`/`habit_`/`pomo_`/`board_`/`col_`/`task_` + `Date.now()`; completions `c_<habitId>_<data>` |
| Mensagens UI | PT-BR |

Sem comentários no código, a menos que solicitado.

## Regras importantes

- Não tocar `localStorage` fora de `storageService`.
- Lógica de negócio nova → métodos em services puros (`src/services/`).
- APIs de browser (Notification, Audio, timers de UI) → helpers/hooks separados (`notificationService`, `audioService`, `usePomodoroTimer`).
- Datas sempre via `dateService` (strings `YYYY-MM-DD`, timezone-safe).
- `pomodoroRepository.add` mantém **uma única sessão ativa**.
- Concluir foco com hábito vinculado também marca a conclusão do hábito (respeitando agendamento).
- Kanban: `moveTask` reindexa colunas origem/destino; `deleteKanbanColumn` move tarefas para a primeira coluna restante; `deleteKanbanTask` limpa `linkedTaskId` do pomodoro.
- Backup atual é `version: 3` (categories, habits, completions, pomodoro + kanban + tombstones); import retrocompatível v1/v2.
- Sync: `actus:tombstones` guarda marcas de exclusão; desmarcar/apagar propaga para os demais dispositivos (merge filtra itens cobertos por tombstone, com revira em re-marcações).

## Comandos

```bash
npm run dev        # dev server (http://localhost:5173)
npm run build      # tsc -b && vite build
npm run preview    # pré-visualiza build
npm run lint       # tsc --noEmit (tipos) — NÃO é o oxlint
npm run test       # vitest (watch)
npm run test:run   # vitest uma vez (73 testes)
```

## Validação de alterações

Sempre, nesta ordem: `npm run lint` → `npm run test:run` → `npm run build`.

## Tratamento de erros (padrões existentes)

- `storageService`: try/catch + fallback seguro.
- `deleteCategory`: bloqueia exclusão com hábitos vinculados (retorna `{ success, message }`).
- `importData`: valida estrutura do JSON; pomodoro e kanban são opcionais (backups v1/v2 continuam válidos).
- `pomodoroService.validateSettings`: valida durações e retorna `{ valid, errors }` em PT-BR.
- `kanbanService.validateBoard/Column/Task`: valida nomes e retorna `{ valid, errors }` em PT-BR.
- Notificação: se permissão bloqueada, o toggle reverte e exibe aviso.
- Áudio: toca `public/pomodoro-chime.wav`, com fallback via Web Audio.
