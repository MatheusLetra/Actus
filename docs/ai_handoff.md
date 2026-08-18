# AI Handoff — Estado do Trabalho

Documento de handoff para retomar o trabalho no repositório a partir de onde parou. O histórico completo das etapas está em `docs/PLANO-IMPLEMENTACAO-POMODORO.md` e `docs/PLANO-IMPLEMENTACAO-QUADRO-KANBAN.md`.

## Estado atual

### Fundação de Project

- `Project` é entidade própria, com nome, cor controlada, `createdAt` e `updatedAt`.
- `KanbanTask.projectId` é opcional, com no máximo um projeto por tarefa; tarefas legadas continuam válidas.
- Projects persistem em `actus:projects`, participam do backup v3, `ActusData`, merge LWW e tombstones.
- Exclusão de Project remove associações das tarefas e impede ressurreição durante merge offline.
- Projects viajam no core Firebase existente, sem path, shard ou listener novo; o `pushCoordinator` recebeu somente metadata DEV-only de diagnóstico nesta rodada.
- Gerenciamento, seletor no Task Dialog e badge textual com indicador de cor foram implementados. Filtro permanece fora do MVP.

O projeto base está completo e as features **Pomodoro**, **Quadro Kanban** e **Sincronização com Google/Firebase** foram implementadas, com **todas as etapas concluídas e validadas**:

- Pomodoro (etapas 1–10 + evoluções da segunda rodada): `[x]` — ver `docs/PLANO-IMPLEMENTACAO-POMODORO.md`.
- Quadro Kanban (etapas 1–9): `[x]` — ver `docs/PLANO-IMPLEMENTACAO-QUADRO-KANBAN.md`.
- Sincronização Google/Firebase: `[x]` — ver `docs/PLANEJAMENTO-SINCRONIZACAO-GOOGLE.md`.
- Estado de validação atual: `lint` (tsc --noEmit) sem erros · `test:run` **69/69 testes** (6 arquivos) · `build` OK (apenas aviso pré-existente de tamanho de chunk).
- **Correção de bug (rodada 5 — sincronização)**: exclusões/desmarcações agora **propagam para todos os dispositivos** via *tombstones* (antes, desmarcar em um dispositivo podia voltar a aparecer como concluído ao sincronizar com outro). Detalhes abaixo.
- **Correção de bug (rodada 6 — Pomodoro em background)**: sessões running agora usam deadline absoluto (`endAt`), reconciliam pelo relógio real, restauram pausadas após reload e concluem de forma idempotente. Notificação/áudio continuam best effort quando a página permanece executável.
- **Correção de bug (rodada 7 — edições de Habit)**: hábitos novos e alterados agora possuem `updatedAt` próprio; o merge usa LWW integral por hábito, com fallback global apenas entre cópias legadas. A guarda anti-eco compara conteúdo do último write e o payload Firebase remove `undefined` recursivamente.
- **Correção de bug (rodada 8 — formulário e comparação de snapshots)**: `HabitFormDialog` só reinicializa ao abrir ou trocar o `Habit.id`; `categories` não apaga mais edições locais. `FirebaseContext` normaliza `ActusSnapshot` para `ActusData` antes de decidir `importData()`, ignorando apenas metadata global. A suíte passou com **73 testes**.
- **Evolução — Pomodoro retroativo**: a página Pomodoro permite registrar focos concluídos fora do Actus com data, hora local e duração manual. A sessão nasce diretamente `completed`, preserva uma sessão ativa existente, conclui Habit na data histórica quando aplicável, mantém Task apenas como metadata e pode ser excluída individualmente via tombstone sem remover a completion do Habit.
- **Contenção de tempestade Firebase**: `pushCoordinator` separa acknowledged/writing/pending, coalesceia alterações durante writes, confirma somente após sucesso e impede retry agressivo de `resource-exhausted`. Callbacks intermediários dos três listeners são reconciliados sem write-back quando já estão cobertos pelo payload confirmado. Logout/troca de usuário invalida syncs assíncronos antigos.
- **Diagnóstico e hardening temporários**: `syncDiagnostics` registra eventos DEV-only com hashes RAW/canonical, hashes separados de core/completions/pomodoro, watch id e origem dos pushes. A comparação usa a mesma serialização canônica da fronteira Firestore (`undefined` em objetos equivale a ausência; `null` permanece distinto; arrays preservam ordem). Remotos durante writes são acumulados semanticamente, igualdade real do payload é distinguida de deferimento e remoto stale pode gerar um único write-back controlado. `syncQuotaGuard` permite no máximo 3 `writeSnapshot` reais por 60 segundos e reinicia por sessão; bloqueios não são acknowledged nem reentraiados. Os modos `?actusSyncMode=no-writes` e `?actusSyncMode=no-listeners` isolam listeners e writes. A arquitetura ainda não fornece CAS/revisão distribuída.
- **Publicação versionada Firebase**: contas v2 escrevem revisões imutáveis em `users/{uid}/revisions/{revision}` e publicam somente `users/{uid}/manifest/current` via transaction/CAS. O reader v2 lê exatamente a revisão e os meses declarados pelo manifest, com um listener lógico do manifest. Contas sem manifest permanecem legíveis pelo formato legado e migram no primeiro publish; revisões antigas/órfãs não são apagadas no hot path.

## O que foi implementado (resumo — rodada mais recente: Sincronização Google)

- **Login com Google** na tela Configurações (card "Sincronização com a Nuvem"): Firebase Authentication (`signInWithPopup`), sessão restaurada via `onAuthStateChanged`, logout com confirmação.
- **Cloud Firestore** com documento núcleo por usuário (`users/{uid}`) + **subcoleções mensais** (`completions/YYYY-MM`, `pomodoro/YYYY-MM`) para não estourar o limite de 1 MB/documento.
- **Sincronização bidirecional**: merge por item (união + last-writer-wins) sem perder dados locais no login; no novo dispositivo a nuvem desce para o localStorage. Push com debounce (~800 ms) + `onSnapshot` em tempo real com guarda anti-eco.
- **Credenciais via `.env`** (não versionado) + `.env.example`; `.gitignore` atualizado.
- **Aplicação no dispositivo**: `FirebaseProvider` dentro de `HabitProvider` em `src/App.tsx`; reuso do `importData()` existente para aplicar merges.

## Arquivos-chave criados/modificados (rodada Sincronização)

**Criados:**
- `src/services/firebase/config.ts` · `authService.ts` · `syncService.ts`
- `src/services/syncMergeService.ts` (merge puro)
- `src/context/FirebaseContext.tsx`
- `src/components/settings/CloudSyncCard.tsx`
- `src/tests/syncMergeService.test.ts` (17 testes)
- `src/repositories/tombstoneRepository.ts` (marcas de exclusão p/ sync)
- `.env` / `.env.example`

**Modificados:**
- `package.json` (dep `firebase@^12.17.1` — aprovado)
- `.gitignore` (`.env`, `.env.*` exceto `.env.example`)
- `src/constants/index.ts` (`STORAGE_KEYS.syncUser`, `lastSyncAt`, `tombstones`)
- `src/App.tsx` (FirebaseProvider)
- `src/pages/Settings/index.tsx` (CloudSyncCard + rodapé com status de sync)

## Correções de bugs (rodada 5 — sincronização: deleções propagando)

**Bug relatado**: desmarcar um hábito no celular "voltava a concluído" ao abrir no PC. Causa: o merge só fazia **união** (último escritor vence) e a desmarcação apenas removia o registro localmente — o registro antigo do outro dispositivo ressurgia no próximo merge.

**Correção — tombstones de exclusão** (arquivos):
- `src/types/index.ts`: `SyncTombstone` + `TombstoneKind`; `HabitCompletion.updatedAt`.
- `src/repositories/tombstoneRepository.ts` (novo): marcações `{ kind, id, deletedAt }` persistidas em `actus:tombstones`.
- `src/repositories/completionRepository.ts`: grava `updatedAt` ao marcar.
- `src/services/syncMergeService.ts`: `ActusData.tombstones`; união de tombstones por `kind+id` (vence o mais recente); filtro remove itens cobertos por exclusão; item **revive** se timestamp próprio > `deletedAt` (re-marcação).
- `src/context/HabitContext.tsx`: grava tombstone ao desmarcar/apagar (categoria, hábito + completions, session pomodoro, coluna/tarefa kanban, reset); remove ao re-marcar; export/import inclui `tombstones`.
- `src/context/FirebaseContext.tsx` + `src/services/firebase/syncService.ts`: `tombstones` no snapshot local, no push e no núcleo do Firestore.

**Regra de sincronização atual**: desmarcar/apagar propaga para todos os dispositivos; re-marcar (novo `updatedAt`) revoga a exclusão e volta a sincronizar. Testes novos em `syncMergeService.test.ts` (6 casos).

## Decisões de implementação (lembrar)

- **Scharding**: `completions` e `pomodoroSessions` são particionadas por mês (`YYYY-MM`) nas subcoleções Firestore; `readSnapshot` recombinar e `writeSnapshot` reparticiona (+ remove meses órfãos). Merge opera sobre arrays completos em memória.
- **Merge**: items só de um lado são sempre preservados (união); `Habit` em ambos vence pela versão integral com `updatedAt` próprio mais recente. Cópias legadas de `Habit` usam o timestamp global somente entre si. Completions unem por `habitId+date` preferindo `completed:true`. Kanban é reordenado/reindexado após o merge.
- **Tombstones**: exclusões (habits, categories, completions, pomodoroSessions, kanbanColumns/tasks) geram `{ kind, id, deletedAt }` em `actus:tombstones`; o merge une por `kind+id` (vence o mais recente) e remove itens cobertos. `HabitCompletion.updatedAt` registra marcações recentes; re-marcar "revive" o item (timestamp > `deletedAt`) e apaga o tombstone.
- **Antieco**: o listener ignora apenas snapshot com conteúdo igual ao último write; snapshots diferentes passam pelo merge por entidade. A comparação de aplicação ignora `updatedAt` global, mas preserva timestamps próprios como `Habit.updatedAt`. O write-back recebe timestamp novo e preserva as versões próprias dos itens.
- **Pomodoro em background**: sessões running persistem `endAt`; pause congela `remainingSeconds` e remove o deadline; resume cria outro deadline; reload reconcilia sessões modernas e as restaura pausadas. A UI reconcilia também em `visibilitychange`, e a conclusão é idempotente por sessão. Notification API e áudio são best effort e não executam se o navegador suspender completamente a página.
- **Firestore rules** (aplicar no console): `match /users/{userId}` + subcoleções, `allow read, write: if request.auth.uid == userId`.
- **Chunk size**: o bundle subiu para ~2,1 MB (Firebase ~+600 kB gzip). Aviso pré-existente. Código-splitting (import dinâmico do Firebase) é evolução pendente opcional.
- **Dívida técnica**: `Category`, `KanbanColumn` e `PomodoroSettings` ainda não possuem versionamento próprio equivalente a `Habit.updatedAt` e permanecem dependentes do timestamp global.

## Correções de bugs (rodada 4 — Kanban mobile)

- **Badges do log de ciclos sobrepondo o texto "Foco"**: itens flex-col no mobile; `max-w-28 sm:max-w-40`.
- **Kanban no mobile**: colunas empilham verticalmente (`flex-col`) e lado a lado no desktop (`lg:flex-row`).
- **Drag and drop no mobile**: `MouseSensor` + `TouchSensor` com delay/tolerância.
- **Botões editar/excluir no mobile**: visíveis sem hover (`opacity-100 sm:opacity-0 sm:group-hover:opacity-100`).
- **Header Kanban estourando no mobile**: container `flex-wrap`.

## Evoluções pendentes (não implementadas)

- Código-splitting do Firebase (import dinâmico) para reduzir o bundle inicial.
- Expor métricas de pomodoro no Dashboard.
- Permitir selecionar o hábito vinculado **por sessão**.
- Reagendar/editar ciclos registrados retroativamente.
- Múltiplos quadros Kanban (o modelo de dados já permite; UI atual é de quadro único).
- Estatísticas de tarefas por coluna/quadro.

## Como retomar

1. Ler `docs/AGENTS.md` e `docs/architecture.md` para contexto e convenções.
2. Confirmar o estado de `git status` e os arquivos modificados.
3. Escolher uma evolução pendente da lista acima.
4. Seguir o fluxo do AGENTS.md: types → service puro → repository → contexto → UI/página/rota → testes.
5. Validar: `npm run lint` → `npm run test:run` → `npm run build`.

## Validação atual (rodada mais recente)

- `npm run lint` — sem erros de tipo.
- `npm run test:run` — 6 arquivos, **73 testes** passando.
- `npm run build` — gerado com sucesso (chunk > 500 kB: aviso de tamanho, não é erro).

### Próximo smoke controlado

Não executar durante o BUILD. Usar no máximo 30–60 segundos por fase: `?actusSyncMode=no-writes` (listeners ativos, writes bloqueados), `?actusSyncMode=no-listeners` (listeners e writes bloqueados), URL normal sem interação com budget de 3 writes e, somente se estabilizar, uma alteração pequena. Copiar as linhas `[ACTUS_SYNC #...]` e parar no primeiro `QUOTA_GUARD_BLOCKED` ou segundo push inesperado.

## O que foi implementado (resumo — rodada mais recente: Quadro Kanban)

- **Nova ferramenta "Quadro Kanban"** no menu Ferramentas Úteis (rota `/tools/kanban`), ao lado do Pomodoro.
- **Quadro único** com colunas totalmente personalizáveis (nome + cor via `ColorPicker`), tarefas ordenáveis por **drag and drop** (dentro e entre colunas) usando `@dnd-kit/core` + `@dnd-kit/sortable`.
- **Modais** de cadastro/edição: coluna (`KanbanColumnFormDialog`), tarefa (`KanbanTaskFormDialog` — título, descrição, etapa, hábito e projeto vinculados opcionalmente), Projects (`KanbanProjectManagerDialog`) e quadro (`KanbanBoardSettingsDialog`).
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
