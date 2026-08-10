# AI Handoff — Estado do Trabalho

Documento de handoff para retomar o trabalho no repositório a partir de onde parou. O histórico completo das etapas está em `docs/PLANO-IMPLEMENTACAO-POMODORO.md` e `docs/PLANO-IMPLEMENTACAO-QUADRO-KANBAN.md`.

## Estado atual

O projeto base está completo e as features **Pomodoro** e **Quadro Kanban** foram implementadas, com **todas as etapas concluídas e validadas**:

- Pomodoro (etapas 1–10 + evoluções da segunda rodada): `[x]` — ver `docs/PLANO-IMPLEMENTACAO-POMODORO.md`.
- Quadro Kanban (etapas 1–9): `[x]` — ver `docs/PLANO-IMPLEMENTACAO-QUADRO-KANBAN.md`.
- Estado de validação atual: `lint` (tsc --noEmit) sem erros · `test:run` **25/25 testes** (4 arquivos) · `build` OK (apenas aviso pré-existente de tamanho de chunk).

## O que foi implementado (resumo — rodada mais recente: Quadro Kanban)

- **Nova ferramenta "Quadro Kanban"** no menu Ferramentas Úteis (rota `/tools/kanban`), ao lado do Pomodoro.
- **Quadro único** com colunas totalmente personalizáveis (nome + cor via `ColorPicker`), tarefas ordenáveis por **drag and drop** (dentro e entre colunas) usando `@dnd-kit/core` + `@dnd-kit/sortable`.
- **Modais** de cadastro/edição: coluna (`KanbanColumnFormDialog`), tarefa (`KanbanTaskFormDialog` — título, descrição, etapa, hábito vinculado opcional) e quadro (`KanbanBoardSettingsDialog`).
- **Vínculo opcional de hábito por tarefa**: `KanbanTask.habitId`; badge exibe o hábito no card.
- **Integração Pomodoro × Kanban**: novo vínculo "Tarefa do quadro" no `PomodoroSettingsForm` (mantém o hábito existente); `PomodoroSession.taskId` registra o vínculo; ao concluir um foco, `KanbanAdvanceDialog` pergunta se deseja avançar a tarefa e lista as colunas destino (exceto a atual).
- **Persistência**: 3 chaves novas (`actus:kanbanBoard`, `actus:kanbanColumns`, `actus:kanbanTasks`), repositories via `storageService`.
- **Backup/restore**: `exportData` agora inclui kanban (`version: 3`); `importData` restaura quando presente (retrocompatível v1/v2).
- **Exclusões**: coluna move tarefas para a primeira coluna restante; tarefa excluída limpa `linkedTaskId` das configurações do pomodoro.

## Correções de bugs (3ª rodada)

- **Botão "Nova Coluna"**: agora sempre visível no header da página Kanban (antes só existia no `EmptyState`). `src/pages/Kanban/index.tsx`.
- **Select de tarefa no Pomodoro**: opções são as tarefas agrupadas por coluna (o `<optgroup>` mostra a coluna, os `<option>` as tarefas). `src/components/pomodoro/PomodoroSettingsForm.tsx`.
- **Tarefas duplicadas no drag and drop**: corrigido `kanbanService.moveTask` para o caso origem == destino (reordenação na mesma coluna não duplica) e o `DragOverlay` agora usa o card com `overlay` (sem `useSortable`), evitando droppable duplicado com o mesmo id. Extraído `KanbanTaskCardContent` em `src/components/kanban/KanbanTaskCard.tsx`. Teste novo em `kanbanService.test.ts`.

## Correções de bugs (4ª rodada — mobile)

- **Badges do log de ciclos sobrepondo o texto "Foco"**: cada item do `PomodoroSessionLog` agora é `flex-col` no mobile (texto e badges em linhas separadas) e `sm:flex-row` no desktop; badges em `flex-wrap` com `max-w-28 sm:max-w-40`.
- **Kanban no mobile**: colunas passam a empilhar verticalmente no mobile (`flex-col`, `w-full`, scroll vertical natural) e lado a lado no desktop (`lg:flex-row`, `lg:w-72` com scroll horizontal) — sem scroll lateral no celular. `KanbanBoard.tsx` e `KanbanColumn.tsx`.
- **Drag and drop no mobile não funcionava**: trocado `PointerSensor` (conflita com scroll em touch) por `MouseSensor` + `TouchSensor` com `delay`/`tolerance` em `KanbanBoard.tsx`.
- **Botões editar/excluir invisíveis no mobile**: não dependem mais de hover — visíveis em telas < `sm` (`opacity-100 sm:opacity-0 sm:group-hover:opacity-100`). `KanbanTaskCard.tsx`.
- **Header da página Kanban estourando no mobile**: container de botões agora é `flex-wrap`. `src/pages/Kanban/index.tsx`.

## Arquivos-chave criados/modificados (rodada Kanban)

**Criados:**
- `src/services/kanbanService.ts` · `src/repositories/kanbanRepository.ts`
- `src/components/kanban/` → `KanbanBoard.tsx`, `KanbanColumn.tsx`, `KanbanTaskCard.tsx`, `KanbanColumnFormDialog.tsx`, `KanbanTaskFormDialog.tsx`, `KanbanBoardSettingsDialog.tsx`, `KanbanAdvanceDialog.tsx`
- `src/pages/Kanban/index.tsx`
- `src/tests/kanbanService.test.ts` (9 testes)

**Modificados:**
- `src/types/index.ts` (`KanbanBoard`, `KanbanColumn`, `KanbanTask`; `linkedTaskId` em `PomodoroSettings`; `taskId` em `PomodoroSession`)
- `src/constants/index.ts` (3 chaves `STORAGE_KEYS` + `KANBAN_DEFAULT_COLUMNS`)
- `src/services/pomodoroService.ts` (`DEFAULT_SETTINGS.linkedTaskId: null`)
- `src/context/HabitContext.tsx` (estado/ações kanban, backup v3)
- `src/components/pomodoro/PomodoroSettingsForm.tsx` · `usePomodoroTimer.ts` · `PomodoroTimer.tsx`
- `src/pages/Tools/index.tsx` · `src/routes/index.tsx` · `src/components/layout/AppLayout.tsx` (TITLE_MAP)
- `package.json` (deps: `@dnd-kit/core`, `@dnd-kit/sortable` — aprovado)

## Decisões de implementação (lembrar)

- **Kanban**:
  - `kanbanService.moveTask` remove a tarefa, insere na coluna alvo (índice opcional, padrão fim) e **reindexa** origem/destino (0,1,2…) para evitar drift.
  - `kanbanRepository.initBoardIfMissing` cria o board default na primeira execução; colunas padrão NÃO são criadas automaticamente.
  - Drag and drop: `closestCorners` + `MouseSensor` (distância 5, desktop) + `TouchSensor` (delay 200ms/tolerância 6, mobile) + `DragOverlay`; colunas `useDroppable`, tarefas `useSortable`.
  - `deleteKanbanColumn` move tarefas órfãs para a primeira coluna restante.
  - `deleteKanbanTask` limpa `pomodoroSettings.linkedTaskId` se apontar para a tarefa.
- **Pomodoro** (mantidas): uma única sessão ativa; restauração de sessão pausada via `restoredRef`; `skip` não registra; `reset` cancela; foco concluído com hábito marca a conclusão do hábito (idempotente).

## Evoluções pendentes (não implementadas)

- Expor métricas de pomodoro no Dashboard.
- Permitir selecionar o hábito vinculado **por sessão** (hoje é vínculo global no settings).
- Reagendar/editar ciclos registrados retroativamente.
- Múltiplos quadros Kanban (o modelo de dados já permite; UI atual é de quadro único).
- Estatísticas de tarefas por coluna/quadro (o `kanbanService.getKanbanStats` já fornece os dados).

## Como retomar

1. Ler `docs/AGENTS.md` e `docs/architecture.md` para contexto e convenções.
2. Confirmar o estado de `git status` e os arquivos modificados.
3. Escolher uma evolução pendente da lista acima.
4. Seguir o fluxo do AGENTS.md: types → service puro → repository → contexto → UI/página/rota → testes.
5. Validar: `npm run lint` → `npm run test:run` → `npm run build`.

## Validação atual (rodada mais recente)

- `npm run lint` — sem erros de tipo.
- `npm run test:run` — 4 arquivos, **25 testes** passando.
- `npm run build` — gerado com sucesso (chunk > 500 kB: aviso de tamanho, não é erro).
