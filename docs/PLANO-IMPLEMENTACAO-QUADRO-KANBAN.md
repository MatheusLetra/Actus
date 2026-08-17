# Plano de Implementação — Quadro Kanban

Documento de rastreamento do trabalho. Atualizar ao concluir cada etapa.
Legenda: `[x]` feito | `[ ]` pendente | `[~]` em andamento.

## Objetivo

Adicionar ao menu **Ferramentas Úteis** (ao lado do Pomodoro) a ferramenta **Quadro Kanban**: um quadro com colunas totalmente personalizáveis (nome, cor, ordem), tarefas ordenáveis por **drag and drop** dentro e entre colunas, modal de cadastro/edição de colunas e de tarefas, vínculo **opcional** de um hábito a cada tarefa, persistência no `localStorage` e inclusão no backup JSON. Integração com o Pomodoro: além do hábito já vinculado, permitir vincular uma tarefa do quadro ao ciclo de foco; ao concluir o foco, perguntar se deseja avançar a tarefa para outra etapa (coluna) do quadro.

## Decisões (confirmadas com o usuário)

- **Quadro único**: a ferramenta exibe **um** quadro (o pedido é "um quadro do estilo kanban" com colunas personalizáveis). O modelo de dados já permite múltiplos quadros no futuro sem quebrar o formato.
- **Colunas e tarefas em listas ordenadas**: `KanbanColumn` e `KanbanTask` mantêm campo `order`; a ordem é reindexada após drag and drop (evita drift de números).
- **Vínculo de hábito opcional por tarefa**: `KanbanTask.habitId?: string | null` (não obrigatório).
- **Vínculo de tarefa no Pomodoro**: `PomodoroSettings.linkedTaskId?: string | null` (novo, ao lado de `linkedHabitId` que não é alterado) e `PomodoroSession.taskId?: string | null` (registro do vínculo do ciclo).
- **Avanço pós-foco**: ao concluir um foco com `taskId`, exibir diálogo "Deseja avançar a tarefa para uma nova etapa?"; se sim, listar os nomes das colunas (exceto a atual) para o usuário escolher a etapa de destino.
- **Drag and drop**: usar `@dnd-kit/core` + `@dnd-kit/sortable` (leve, acessível, suporte a touch em mobile-first). ⚠️ **Novas dependências exigem aprovação do usuário** (`package.json` é arquivo protegido).
- **Backup**: `exportData` sobe para `version: 3` incluindo `kanbanBoard`, `kanbanColumns`, `kanbanTasks`; `importData` restaura apenas quando presentes (retrocompatível com v1/v2).
- **Exclusão de coluna**: tarefas da coluna excluída são movidas para a primeira coluna restante; se não houver colunas restantes, as tarefas são excluídas (confirmação via `DeleteConfirmDialog`).
- **Exclusão de tarefa**: limpa `linkedTaskId` nas configurações do pomodoro caso aponte para ela.
- **Projects no Kanban**: gerenciador no header, vínculo opcional `projectId` no formulário de tarefa e badge textual com indicador de cor no card; filtros, tags e múltiplos projetos permanecem fora do MVP.

## Entidades (em `src/types/index.ts`)

```ts
export interface KanbanBoard {
  id: string;        // 'board_<Date.now()>'
  name: string;
  color: string;     // hex (COLOR_OPTIONS)
  createdAt: string;
  updatedAt: string;
}

export interface KanbanColumn {
  id: string;        // 'col_<Date.now()>'
  name: string;
  color: string;     // hex (COLOR_OPTIONS)
  order: number;     // posição no quadro
  createdAt: string;
}

export interface KanbanTask {
  id: string;        // 'task_<Date.now()>'
  columnId: string;
  title: string;
  description?: string;
  habitId?: string | null;   // vínculo opcional com hábito
  order: number;             // posição dentro da coluna
  createdAt: string;
  updatedAt: string;
}
```

### Alterações em entidades existentes

```ts
// PomodoroSettings — adicionar campo (não remover linkedHabitId)
linkedTaskId?: string | null;

// PomodoroSession — adicionar campo
taskId?: string | null;
```

## Etapas

### 1. Types + constants
- [x] Adicionar em `src/types/index.ts`: `KanbanBoard`, `KanbanColumn`, `KanbanTask`
- [x] Adicionar em `src/types/index.ts` em `PomodoroSettings`: campo `linkedTaskId?: string | null`
- [x] Adicionar em `src/types/index.ts` em `PomodoroSession`: campo `taskId?: string | null`
- [x] Adicionar em `src/constants/index.ts` (`STORAGE_KEYS`): `kanbanBoard: 'actus:kanbanBoard'`, `kanbanColumns: 'actus:kanbanColumns'`, `kanbanTasks: 'actus:kanbanTasks'`
- [x] Adicionar em `src/constants/index.ts`: `KANBAN_DEFAULT_COLUMNS` (nomes/cores padrão: "A Fazer", "Em Andamento", "Concluído")

### 2. Dependência drag and drop
- [x] Instalar `@dnd-kit/core` (v6.3.1) e `@dnd-kit/sortable` (v10.0.0) — aprovado pelo usuário

### 3. Lógica pura — `kanbanService` + testes
- [x] Criar `src/services/kanbanService.ts`: `getDefaultBoard`, `getDefaultColumns`, validação de board/column/task, ordenação por `order`, reindexação (`reindexColumns`, `reindexTasks`, `reindexTasksInColumn`), `moveTask` (troca de coluna + novo índice), `getKanbanStats`, `getColumnsSortedForSelect` (agrupamento p/ selects)
- [x] Criar `src/tests/kanbanService.test.ts` (8 testes)

### 4. Persistência — `kanbanRepository`
- [x] Criar `src/repositories/kanbanRepository.ts` (board/columns/tasks via `storageService`):
  - `getBoard` / `saveBoard` / `initBoardIfMissing`
  - `getColumns` / `saveColumns` / `saveAllColumns` / `addColumn` / `updateColumn` / `deleteColumn`
  - `getTasks` / `saveTasks` / `saveAllTasks` / `addTask` / `updateTask` / `deleteTask`

### 5. Estado — `HabitContext`
- [x] Adicionar estado: `kanbanBoard`, `kanbanColumns`, `kanbanTasks` (carregados no mount; board inicializado com defaults se ausente)
- [x] Adicionar ações: `updateKanbanBoard`, `addKanbanColumn`, `updateKanbanColumn`, `deleteKanbanColumn`, `addKanbanTask`, `updateKanbanTask`, `deleteKanbanTask`, `moveKanbanTask`
- [x] `deleteKanbanTask`: limpar `linkedTaskId` do `pomodoroSettings` quando apontar para a tarefa
- [x] `exportData`: `version: 3` + `kanbanBoard`, `kanbanColumns`, `kanbanTasks`
- [x] `importData`: restaurar kanban quando os campos existirem e forem válidos (mantendo retrocompatibilidade v1/v2)

### 6. Integração Pomodoro × Kanban
- [x] `src/services/pomodoroService.ts`: adicionar `linkedTaskId: null` ao `DEFAULT_SETTINGS`
- [x] `src/components/pomodoro/PomodoroSettingsForm.tsx`: novo select "Tarefa do quadro vinculada (opcional)" agrupado por coluna; manter o select de hábito existente; incluir `linkedTaskId` no objeto salvo
- [x] `src/components/pomodoro/usePomodoroTimer.ts`:
  - `beginCycle`: gravar `taskId: type === 'focus' ? (settings.linkedTaskId ?? null) : null`
  - `completeCycle`: se `activeSession.taskId` existir, buscar a tarefa; definir `pendingAdvanceTask: { taskId, taskTitle, currentColumnId } | null`; expor `confirmAdvanceTask(columnId)` e `dismissAdvanceTask()`
- [x] `src/components/pomodoro/PomodoroTimer.tsx`: renderizar `KanbanAdvanceDialog` quando `pendingAdvanceTask` estiver definido

### 7. Componentes — Kanban
- [x] `src/components/kanban/KanbanTaskCard.tsx` — card da tarefa (título, descrição, badge do hábito vinculado, editar/excluir); elemento arrastável (`useSortable`)
- [x] `src/components/kanban/KanbanColumn.tsx` — coluna (header com nome/cor, editar/excluir, contador; lista de tarefas; botão "+ Tarefa"; área de drop via `useDroppable`)
- [x] `src/components/kanban/KanbanBoard.tsx` — layout do quadro (colunas em scroll horizontal, Mobile-First) com `DndContext`/`SortableContext` e handlers de drag end
- [x] `src/components/kanban/KanbanColumnFormDialog.tsx` — modal criar/editar coluna (nome + `ColorPicker`)
- [x] `src/components/kanban/KanbanTaskFormDialog.tsx` — modal criar/editar tarefa (título, descrição, etapa/coluna, hábito vinculado opcional via select de `habits`)
- [x] `src/components/kanban/KanbanProjectManagerDialog.tsx` — gerenciador mobile-first de criação, edição, cor e exclusão de Projects
- [x] `src/components/kanban/KanbanBoardSettingsDialog.tsx` — modal editar nome/cor do quadro
- [x] `src/components/kanban/KanbanAdvanceDialog.tsx` — diálogo pós-foco: "Deseja avançar a tarefa '[título]' para uma nova etapa?" → se sim, listar colunas destino (exceto a atual) → confirmar

### 8. Página + rota + navegação
- [x] Criar `src/pages/Kanban/index.tsx` — página do quadro (header com nome/cor do quadro, "Nova Tarefa", "Configurar"; grid de colunas; modais; confirmações de exclusão)
- [x] Atualizar `src/pages/Tools/index.tsx` — adicionar entrada do Quadro Kanban (ícone `KanbanSquare`, descrição, status "disponível")
- [x] Atualizar `src/routes/index.tsx` — rota `/tools/kanban` (autorizado pelo usuário)
- [x] Atualizar `src/components/layout/AppLayout.tsx` — `TITLE_MAP['/tools/kanban'] = 'Quadro Kanban'`

### 9. Validação
- [x] `npm run lint` (tsc --noEmit) — sem erros de tipo
- [x] `npm run test:run` (Vitest) — **25/25 testes** (16 anteriores + 9 kanban)
- [x] `npm run build` — build de produção gerado (apenas aviso pré-existente de tamanho de chunk)
- [x] Smoke test: dev server respondendo HTTP 200 na rota `/tools/kanban`, sem erros de compilação

## Fluxo de integração Pomodoro × Kanban (detalhamento)

1. No form de configurações do Pomodoro, usuário seleciona (opcionalmente) uma tarefa do quadro (além do hábito já existente).
2. Ao iniciar um foco, `beginCycle` grava `taskId` na sessão.
3. Ao concluir o foco (`completeCycle`):
   a. Sessão vira `status: 'completed'` (registro mantido, como hoje).
   b. Se `activeSession.taskId` existe, o hook define `pendingAdvanceTask` com o título da tarefa e a coluna atual.
   c. `PomodoroTimer` renderiza `KanbanAdvanceDialog`.
   d. Diálogo: "Deseja avançar a tarefa '[título]' para uma nova etapa?" → botões "Não" / "Sim, avançar".
   e. "Não" → fecha diálogo, sem alterar nada.
   f. "Sim, avançar" → exibe os nomes das colunas do quadro (exceto a coluna atual); usuário escolhe a etapa de destino.
   g. `confirmAdvanceTask(columnId)` chama `moveKanbanTask(taskId, columnId)` no contexto e fecha o diálogo.
4. A conclusão de hábito vinculado continua funcionando exatamente como hoje (não é removida).

## Arquivos a modificar (existentes)

| Arquivo | Alteração |
|---|---|
| `src/types/index.ts` | + `KanbanBoard`, `KanbanColumn`, `KanbanTask`; + `linkedTaskId` em `PomodoroSettings`; + `taskId` em `PomodoroSession` |
| `src/constants/index.ts` | + 3 chaves em `STORAGE_KEYS`; + `KANBAN_DEFAULT_COLUMNS` |
| `src/services/pomodoroService.ts` | `DEFAULT_SETTINGS.linkedTaskId: null` |
| `src/context/HabitContext.tsx` | Estado + ações kanban; `deleteKanbanTask` limpa `linkedTaskId`; backup v3 |
| `src/components/pomodoro/PomodoroSettingsForm.tsx` | Select de tarefa vinculada (mantém hábito) |
| `src/components/pomodoro/usePomodoroTimer.ts` | `taskId` no `beginCycle`; `pendingAdvanceTask` + confirm/dismiss |
| `src/components/pomodoro/PomodoroTimer.tsx` | Renderizar `KanbanAdvanceDialog` |
| `src/pages/Tools/index.tsx` | Nova entrada "Quadro Kanban" |
| `src/routes/index.tsx` | Rota `/tools/kanban` (protegido) |
| `src/components/layout/AppLayout.tsx` | `TITLE_MAP['/tools/kanban']` |

## Arquivos novos

| Arquivo | Finalidade |
|---|---|
| `src/services/kanbanService.ts` | Lógica pura (defaults, validação, ordenação, move, stats) |
| `src/repositories/kanbanRepository.ts` | Persistência board/columns/tasks |
| `src/components/kanban/KanbanBoard.tsx` | Quadro com drag and drop |
| `src/components/kanban/KanbanColumn.tsx` | Coluna do quadro |
| `src/components/kanban/KanbanTaskCard.tsx` | Card de tarefa |
| `src/components/kanban/KanbanColumnFormDialog.tsx` | Modal coluna |
| `src/components/kanban/KanbanTaskFormDialog.tsx` | Modal tarefa |
| `src/components/kanban/KanbanBoardSettingsDialog.tsx` | Modal quadro |
| `src/components/kanban/KanbanAdvanceDialog.tsx` | Diálogo avanço pós-foco |
| `src/pages/Kanban/index.tsx` | Página `/tools/kanban` |
| `src/tests/kanbanService.test.ts` | Testes do service |

## Anotações de execução

- `kanbanService.moveTask` remove a tarefa da lista original, insere na coluna alvo no índice desejado (padrão: fim) e **reindexa as colunas de origem e destino** (0, 1, 2…) para evitar drift de floats. Quando origem e destino são a **mesma coluna** (reordenação), trata como caso único (sem duplicar).
- `kanbanRepository.initBoardIfMissing` cria o board com `getDefaultBoard` na primeira execução; colunas padrão não são criadas automaticamente — o usuário cria a primeira coluna via `EmptyState` (página) ou botão "Nova Coluna" no header.
- Drag and drop: `DndContext` com `closestCorners`, `MouseSensor` (activation distance 5) + `TouchSensor` (delay 200ms/tolerância 6, para não conflitar com scroll em touch) e `DragOverlay` para feedback visual. Colunas usam `useDroppable` (id da coluna); tarefas usam `useSortable` (id da tarefa). `handleDragEnd` converte `over.id` em coluna alvo + índice.
- **Responsivo**: no mobile as colunas empilham verticalmente (`flex-col`, `w-full`, scroll vertical da página); no desktop (`lg+`) ficam lado a lado (`lg:flex-row`, `lg:w-72`, scroll horizontal). Botões editar/excluir do card são visíveis no mobile (sem depender de hover).
- O `DragOverlay` usa a variante `overlay` do `KanbanTaskCard` (somente conteúdo visual, **sem** `useSortable`) para não registrar um droppable duplicado com o mesmo id da tarefa (anti-padrão do dnd-kit).
- `deleteKanbanColumn` move as tarefas órfãs para a primeira coluna restante (via `moveTask`); sem colunas restantes, as tarefas são excluídas. Confirmação descreve esse comportamento.
- `deleteKanbanTask` limpa `pomodoroSettings.linkedTaskId` se apontar para a tarefa excluída.
- `importData` só restaura kanban quando `kanbanBoard` for objeto com `name` string e `kanbanColumns`/`kanbanTasks` forem arrays (backups v1/v2 continuam importando).
- O vínculo de hábito existente no Pomodoro não é alterado; `linkedTaskId` é um campo adicional e independente.
- Ícone do quadro no Tools usa `KanbanSquare` (disponível no lucide-react) — o `IconRenderer` tem fallback para `Target` caso o ícone não exista.

## Correções de bugs (pós-entrega)

### 1. Botão "Nova Coluna" sumia após a primeira coluna
- **Sintoma**: com colunas cadastradas, o header só exibia "Configurar" e "Nova Tarefa" — o botão de criar coluna só existia no `EmptyState` (quando não havia colunas).
- **Correção**: adicionado botão "Nova Coluna" (`handleCreateColumn`) no header da página `src/pages/Kanban/index.tsx`, sempre visível. Testado: é possível criar quantas colunas forem necessárias.

### 2. Select de tarefa no Pomodoro exibia as colunas em vez das tarefas
- **Sintoma**: no `PomodoroSettingsForm`, o vínculo "Tarefa do quadro vinculada" mostrava os nomes das colunas (via `<optgroup>`), não as tarefas.
- **Correção**: o select de tarefa usa `getColumnsSortedForSelect` (agrupamento por coluna) apenas para **organizar**; as opções são as **tarefas** (título), agrupadas por coluna via `<optgroup>`. O bug relatado ocorria por não haver tarefas cadastradas ou pela confusão visual dos grupos; a implementação agora garante que as opções selecionáveis sejam as tarefas.

### 3. Tarefas duplicadas ao arrastar (drag and drop)
- **Sintoma**: ao arrastar tarefas entre colunas (ou reordenar dentro da coluna), tarefas apareciam duplicadas (as que já estavam na coluna + a movida).
- **Causa raiz 1** (`kanbanService.moveTask`): quando `sourceColumnId === targetColumnId`, `reindexedSource` e `reindexedTarget` eram calculados sobre o **mesmo** conjunto de tarefas e ambos entravam no resultado → duplicação. Corrigido tratando o caso de mesma coluna separadamente (reindexa uma única lista).
- **Causa raiz 2** (`DragOverlay`): o `KanbanTaskCard` (com `useSortable`) era reutilizado no overlay, registrando um droppable duplicado com o mesmo `id` da tarefa. Extraído `KanbanTaskCardContent` (puro) e adicionada prop `overlay` ao card para o `DragOverlay`.
- **Teste adicionado**: `kanbanService.test.ts` → "should reorder a task within the same column without duplicating" (garante a não-duplicação em reordenação na mesma coluna).
- **Validação**: lint OK · `test:run` **25/25** · build OK.
