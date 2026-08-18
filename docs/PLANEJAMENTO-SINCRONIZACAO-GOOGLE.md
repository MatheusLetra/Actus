# Planejamento — Sincronização com Firebase (Login Google)

Documento de planejamento da funcionalidade de **login com Google e sincronização bidirecional dos dados** do Actus com o **Firebase** (Cloud Firestore). Documento de rastreamento: atualizar ao concluir cada etapa.
Legenda: `[x]` feito | `[ ]` pendente | `[~]` em andamento.

## Objetivo

Na tela de **Configurações**, adicionar um card de **Sincronização com a Nuvem** com um botão **"Entrar com Google"**. Ao logar:

- Os dados do dispositivo local (localStorage) **não devem ser perdidos**.
- Os dados passam a ser salvos **tanto no localStorage quanto no Firebase** (Cloud Firestore).
- Ao entrar em um **novo dispositivo**, os dados do Firebase são sincronizados para o localStorage.
- A sincronização é **bidirecional**: alterações locais sobem para a nuvem; alterações na nuvem (feitas em outro dispositivo) descem para o local.
- As credenciais do projeto Firebase ficam em um arquivo **`.env`** (não versionado).

## Abordagem recomendada (análise)

A aplicação é **offline-first, 100% no navegador, sem backend próprio** e a persistência atual é um "snapshot" estruturado (mesma forma do backup `version: 3` do `exportData()`). A melhor abordagem dado esse contexto:

1. **Autenticação**: **Firebase Authentication** com o provedor **Google** (`GoogleAuthProvider` + `signInWithPopup`), usando o SDK modular (`firebase/auth`). O estado de autenticação persiste no navegador (persistência padrão local), então o usuário continua logado entre sessões.
2. **Banco de dados**: **Cloud Firestore**, com um **documento núcleo por usuário** + **subcoleções particionadas por mês** para as coleções que crescem sem limite (`completions`, `pomodoroSessions`). O documento núcleo (`users/{uid}`) guarda os dados pequenos estáticos (categories, habits, configurações, kanban); os registros que crescem (conclusões e ciclos pomodoro) vão em documentos de mês (`users/{uid}/completions/YYYY-MM`, `users/{uid}/pomodoro/YYYY-MM`), cada um muito abaixo do limite de 1 MB por documento. Isso elimina o risco de estouro com o passar dos anos.
3. **Sincronização**: estratégia **"merge por item (união) com last-writer-wins"**, em vez de sobrescrita cega. Isso garante que **nada do localStorage seja perdido ao logar** e que um **dispositivo novo receba os dados da nuvem** — os dois requisitos centrais.
4. **Fluxo contínuo**: **push com debounce** das alterações locais para a nuvem + **`onSnapshot`** (listener em tempo real) da nuvem para o local, com **proteção contra eco** (loop de escrita própria).
5. Reuso máximo do código existente: a leitura/escrita do Firestore usa o mesmo shape do `exportData()`, e **aplicar um snapshot no local reutiliza o `importData()` já existente** no `HabitContext`.

### Alternativas consideradas e por quê foram descartadas

| Alternativa | Motivo de descarte |
|---|---|
| **Sobrescrita unilateral ao logar** (local → nuvem OU nuvem → local) | Quebra um dos dois requisitos (perde dados locais ou não funciona em dispositivo novo). |
| **Realtime Database** | Sincronização full-state com merge lógico é mais complexa; Firestore tem SDK web mais simples e regras de segurança por documento mais diretas. |
| **Armazenar cada item em um documento** (`users/{uid}/habits/{id}`, `users/{uid}/categories/{id}`...) | Muitas leituras/escritas (dezenas a milhares) por sincronização e estado parcial/consistência frágil. O snapshot completo é a unidade natural do app; por isso apenas as coleções que crescem são particionadas por mês, não por item. |
| **Backend próprio (Auth REST + log de operações)** | Exige servidor/API externa — contradiz o modelo 100% no navegador do projeto. |

## Decisões de implementação (confirmar com o usuário)

1. **Merge automático ao logar** (recomendado): ao entrar com Google, faz-se `merge(local + nuvem)` e o resultado é gravado nos dois lados. Simples, previsível e resolve os dois requisitos sem perguntas.
   - Alternativa (se preferir dar controle ao usuário): exibir na primeira sincronização de cada dispositivo um diálogo — "Mesclar dados (recomendado)" / "Sobrescrever locais pela nuvem" / "Enviar locais para a nuvem".
2. **Resolução de conflito** — "quem editou por último vence por item": itens com `id` igual presentes nos dois lados são resolvidos pela versão da origem com timestamp próprio mais recente. `Habit.updatedAt` resolve a versão integral do hábito; hábitos legados sem o campo usam `updatedAt` global apenas quando ambas as cópias são legadas. Itens exclusivos de um lado são preservados (união).
3. **Sincronização em tempo real** (recomendado): `onSnapshot` do documento aplica mudanças remotas automaticamente, com guarda anti-eco. Se preferir algo minimalista: sincronizar **apenas no login + botão "Sincronizar agora"** + push com debounce.
4. **Intervalo de push**: debounce de ~800 ms após qualquer alteração de dados no `HabitContext`.
5. **Escopo sincronizado**: categorias, hábitos, completions, pomodoro settings/sessions, kanban board/columns/tasks **e tombstones** de exclusão (espelho exato do backup `version: 3`). O **tema** (`actus:theme`) permanece local por dispositivo.

## Arquitetura

```
main.tsx ──> App.tsx
              ├─ ThemeProvider
              └─ HabitProvider (estado + persistência localStorage)
                   └─ FirebaseProvider (NOVO — usa useHabits())
                        ├─ onAuthStateChanged
                        ├─ watchSnapshot(uid)          ← nuvem → local (onSnapshot)
                        └─ debouncedPush(snapshot)     ← local → nuvem (Firestore)
                             └─ AppRouter ... Pages (Settings com botão Google)
        └─ repositories (localStorage) ── services (date/streak/statistics/seed/pomodoro/kanban)
        └─ services/firebase (config/auth/sync) ── syncMergeService (puro, sem Firebase)
```

- Novo **`FirebaseProvider`** (contexto) fica **dentro** do `HabitProvider` (a sincronização lê e escreve o estado do app via `useHabits()`).
- Services puros de sync ficam separados: `syncMergeService` (**puro**, testável, sem Firebase) e `services/firebase/*` (config, auth, sync — acessam Firestore/Auth, como `notificationService`/`audioService`, não contêm lógica de negócio).

## Modelo de dados no Firestore

Para não esbarrar no limite de **1 MB por documento**, o snapshot é **particionado por mês** nas coleções que crescem continuamente:

```
users/{uid}                                  // documento núcleo — dados pequenos e estáticos
{
  updatedAt: 1755000000000,                  // epoch ms — "última escrita" (last-writer-wins)
  data: {
    version: 3,
    categories:       [...],                 // mesmos objetos do localStorage
    habits:           [...],
    completions:      [] /* excluído aqui */,
    pomodoroSettings: {...},
    pomodoroSessions: [] /* excluído aqui */,
    kanbanBoard:      {...},
    kanbanColumns:    [...],
    kanbanTasks:      [...],
    tombstones:       [ { kind, id, deletedAt } ]   // marcas de exclusão propagáveis
  }
}

users/{uid}/completions/{YYYY-MM}            // 1 doc por mês: array de HabitCompletion
{ items: [ { id, habitId, date, completed }, ... ] }

users/{uid}/pomodoro/{YYYY-MM}               // 1 doc por mês: array de PomodoroSession
{ items: [ { id, cycleType, status, startedAt, date, ... }, ... ] }
```

**Dimensionamento dos shards mensais**: cada registro de conclusão tem ~100–120 bytes; com 20 hábitos × 31 dias ≈ 620 registros ≈ **~70 KB/mês** (100 hábitos → ~350 KB/mês) — sempre muito abaixo de 1 MB. Ciclos pomodoro são ainda menores. Os campos `data` de `completions` e `date` de `pomodoroSessions` definem a partição `YYYY-MM`.

O **SDK lida com o particionamento de forma transparente** para o resto da aplicação:

- **`readSnapshot(uid)`**: lê o documento núcleo + todos os docs das subcoleções `completions` e `pomodoro` (`getDocs`) → recompõe o objeto snapshot idêntico ao `exportData()` (com `completions` e `pomodoroSessions` inteiros).
- **`writeSnapshot(uid, snapshot)`**: grava o núcleo e **reparticiona** as duas listas em meses, escrevendo/atualizando cada doc `YYYY-MM` (e removendo docs de meses que deixaram de existir, quando houver).

Assim, a lógica de merge continua operando sobre **arrays completos em memória**, sem conhecimento do particionamento.

## Algoritmo de merge (`syncMergeService`)

Serviço puro (object literal, sem React/Firebase) com entrada `(local, remote)` e saída `{ merged }`:

1. `updatedAt = max(local.updatedAt, remote.updatedAt)`.
2. **Coleções com `id`** (categories, habits, kanbanColumns, kanbanTasks): união por `id`; item em ambos os lados → versão da origem mais recente. Hábitos usam `Habit.updatedAt`; para hábitos legados, o fallback global só é usado quando ambos não têm timestamp próprio.
3. **Completions**: união por chave `habitId + date`; `completed: true` vence registros falsos. Desmarcar/remover registra um **tombstone** (`completion`, chave `habitId|date`) para propagar a remoção aos demais dispositivos; re-marcar cria um novo registro com `updatedAt` mais novo, que **revive** o item e elimina o tombstone.
4. **Tombstones** (deleções): toda exclusão (categoria, hábito, `completion`, `pomodoroSession`, `kanbanColumn`, `kanbanTask`) grava `{ kind, id, deletedAt }`. No merge, tombstone de mesmo `kind+id` vence o mais recente e **remove itens cobertos** das coleções; um item só sobrevive se tiver timestamp próprio mais novo que o `deletedAt` (revira/recriação).
5. **PomodoroSessions**: união por `id`; versão com `completedAt`/`startedAt` mais recente.
6. **Configurações**: `pomodoroSettings` (sem timestamp próprio) e `kanbanBoard` (tem `updatedAt`) → prevalece o lado com `updatedAt` global mais recente.
7. Após o merge, os dados do snapshot são comparados sem o metadata global `updatedAt`; `importData(JSON.stringify(merged))` só é chamado quando o domínio realmente mudou. Quando aplicado, valida a estrutura completa e grava em localStorage + estado.
8. O particionamento mensal é **transparente**: o merge opera sobre os arrays completos (`completions`, `pomodoroSessions`) recombinados pelo `syncService` (leitura) e reparticionados na escrita.

## Fluxos

### Login (primeiro acesso / novo dispositivo)
1. Usuário clica **"Entrar com Google"** → `signInWithPopup(auth, provider)`.
2. No sucesso: salva marca local (`actus:syncUser`) e lê o documento `users/{uid}`.
3. Monta snapshot local (via `useHabits()` no `FirebaseProvider`) e remote (ou `null`).
4. Realiza **merge** (`syncMergeService`) e aplica nos dois lados:
   - **Local** → `importData(JSON.stringify(merged))` (reutiliza persistência + estado existentes; **não perde dados locais**).
   - **Nuvem** → `setDoc(users/{uid}, { updatedAt, data: merged.data })`.
5. Ativa o listener `onSnapshot` e o push com debounce.

### Pós-login (device atual)
- **Local → Nuvem**: toda alteração no `HabitContext` (add/update/delete/toggle, pomodoro, kanban) dispara push com debounce de ~800 ms gravando o snapshot atual com `updatedAt = Date.now()`.
- **Nuvem → Local** (alteração feita em outro dispositivo): `onSnapshot` detecta `updatedAt` da nuvem > último `updatedAt` escrito localmente → aplica merge e atualiza localStorage + estado.

### Logout
- `signOut(auth)`, encerra o listener e descarta o push pendente. Os dados do localStorage **permanecem** (como hoje). Um novo login refaz o merge.

### Novo dispositivo (dados do Firebase no localStorage)
- Fluxo idêntico ao login: o merge copia os itens remotos para o local; como o local está vazio (ou só com seed), nada é perdido e a nuvem "desce".

### Offline
- Sem internet: sign-in falha com mensagem amigável; o app continua 100% funcional no localStorage. Pushes falham e são repetidos no próximo evento de mudança. Um botão **"Sincronizar agora"** permite forçar a troca de dados quando a conexão voltar.

## Contenção de tempestade de sincronização

Após um incidente confirmado no Firebase Spark, com aproximadamente 42 mil leituras e 20 mil gravações em uma janela curta, o `FirebaseProvider` passou a usar `src/services/firebase/pushCoordinator.ts`. O coordenador mantém separadamente o último payload acknowledged, o payload currently writing e o pending latest. Alterações que surgem durante uma escrita são coalescidas; o sucesso confirma somente o payload efetivamente concluído.

`resource-exhausted` não inicia retry agressivo. Falhas deixam o estado não acknowledged para tentativa posterior por nova alteração, sincronização manual ou reconexão. Snapshots remotos semanticamente iguais ao estado local, acknowledged ou ao resultado já publicado não geram `importData()` nem write-back. A geração da sessão de autenticação invalida resultados tardios de sync após logout ou troca de usuário.

### BUILD de diagnóstico temporário

Antes de novo smoke Firebase, `syncDiagnostics` e `syncQuotaGuard` registram, somente em DEV, a sequência do fluxo, origem dos requests, watch id, hashes RAW/canonical e hashes separados de core, completions e Pomodoro. Nenhum conteúdo de usuário é logado. O quarto `writeSnapshot` em uma janela móvel de 60 segundos é bloqueado antes do Firestore; o payload não é confirmado nem reentraiado.

Modos DEV-only: `?actusSyncMode=no-writes` mantém bootstrap/listeners e bloqueia writes; `?actusSyncMode=no-listeners` mantém bootstrap e bloqueia listeners/writes; sem parâmetro é o modo normal protegido por 3 writes. A serialização de comparação agora compartilha a política do Firestore para `undefined`/ausência, sem reordenar arrays. Snapshots diferentes recebidos durante um write são acumulados para reconciliação; snapshots iguais ao payload em escrita são apenas deferidos, e remoto stale pode ser republicado uma vez de forma controlada. Não há alteração de schema, paths, merge arquitetural, Rules ou arquitetura distribuída.

### Publicação v2 por revisão

O transporte Firebase v2 usa o manifest isolado `users/{uid}/manifest/current` e revisões imutáveis em `users/{uid}/revisions/{revision}`. Cada revisão contém um documento core e shards mensais com o mesmo `revision`; o manifest declara `currentRevision`, `previousRevision`, `publishedAt` e `shardMonths`. A publicação escreve todos os documentos da revisão primeiro e troca o manifest por transaction que exige `currentRevision === baseRevision`. Em conflito CAS, a revisão é abandonada, o estado publicado é relido, o merge é refeito e há limite defensivo de tentativas. O reader v2 observa somente o manifest e nunca faz scan de shards para descobrir meses.

O reader legado continua atendendo contas sem `manifest/current`. O primeiro publish necessário cria a primeira revisão v2 sem deletar o core/shards legados. Clientes v1 posteriores podem continuar escrevendo o core legado, mas não alteram o manifest v2 e essas escritas não são incorporadas automaticamente.

As Rules precisam permitir, para o mesmo `userId`, leitura e escrita de `manifest/current`, `revisions/{revision}` e suas subcoleções `completions/{month}` e `pomodoro/{month}`, mantendo a mesma condição de ownership usada no path legado. Não há arquivo de Rules versionado neste repositório; essa alteração deverá ser aplicada no Console antes do smoke v2.

Essa contenção não altera o schema, os paths, os shards, as regras Firestore ou a política de merge. Revision, manifest e CAS continuam adiados.

## Segurança

### Regras do Firestore (aplicar no console do Firebase)
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      match /completions/{month} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
      match /pomodoro/{month} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```
*(Somente o dono lê/escreve o próprio documento núcleo e as subcoleções de meses.)*

### Credenciais
- Arquivo **`.env`** na raiz (não versionado) com prefixo `VITE_` (exposto pelo Vite em `import.meta.env`):
  - `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`.
- Criar **`.env.example`** (versionado, com placeholders) para documentar as variáveis.
- Adicionar **`.env`** e **`.env.local`** ao `.gitignore`.
- **Pré-requisito no console do Firebase** (ações manuais do usuário): criar projeto, habilitar **Authentication → Google**, criar banco **Firestore**, aplicar as regras acima e configurar os **domínios autorizados** (localhost:5173) do provedor Google.

## Dependências

- **`firebase`** (SDK modular, v11+) — **novo pacote; requer aprovação explícita do usuário** (AGENTS.md: `package.json` é arquivo protegido). O pacote já inclui tipagens TS (não exige `@types`).
- Nenhum plugin novo no Vite necessário (variáveis `VITE_*` são expostas automaticamente).

## Etapas

### 1. Preparação de ambiente e dependência
- [x] Adicionar `firebase` ao `package.json` (aprovado pelo usuário).
- [x] Criar `.env` (credenciais reais) e `.env.example` (placeholders).
- [x] Adicionar `.env` e `.env.local` ao `.gitignore`.

### 2. Configuração do Firebase (helpers de browser)
- [x] Criar `src/services/firebase/config.ts` — `initializeApp` com `import.meta.env.VITE_*` (com fallback seguro se faltando) e exporta `auth` + `db` (Firestore). Loga aviso se a config estiver ausente.
- [x] Criar `src/services/firebase/authService.ts` — `signInWithGoogle()`, `signOut()`, `onAuthStateChanged(cb)`, `getCurrentUser()`.
- [x] Criar `src/services/firebase/syncService.ts` — `readSnapshot(uid)` (núcleo + subcoleções de meses), `writeSnapshot(uid, snapshot)` (núcleo + reparticionamento mensal), `watchSnapshot(uid, cb)` (escuta o núcleo + subcoleções), `stopWatch()`.

### 3. Lógica pura — `syncMergeService` + testes
- [x] Criar `src/services/syncMergeService.ts`: `mergeSnapshots(local, remote)` conforme o algoritmo acima (união + last-writer-wins por item), `getSnapshotUpdatedAt`, helpers de resolução de conflito.
- [x] Criar `src/tests/syncMergeService.test.ts` (testes: merge preserva itens exclusivos locais e remotos; item em ambos → vence o mais recente; completions unem por habitId+date; settings vence o lado mais recente; updatedAt = max; propaga desmarcação via tombstone; re-marcação revive; exclusão de hábito; união de tombstones; casos limite vazios).

### 4. Persistência local da sessão (constants)
- [x] `src/constants/index.ts` — adicionar em `STORAGE_KEYS`: `syncUser: 'actus:syncUser'`, `lastSyncAt: 'actus:lastSyncAt'`.

### 5. Estado — `FirebaseProvider` (contexto)
- [x] Criar `src/context/FirebaseContext.tsx` (padrão `Provider` + `useFirebase()` com guarda): expõe `status` (`'idle' | 'connecting' | 'signedIn' | 'signingOut'`), `user` (uid/email/nome/foto), `lastSyncAt`, `error` (mensagem PT-BR), e ações `signInWithGoogle()`, `signOut()`, `syncNow()`.
- [x] Integrar com `useHabits()`: montar snapshot local (`exportData`), aplicar merges via `importData`, observar mudanças para push com debounce.
- [x] Guarda anti-eco: registrar `lastWrittenUpdatedAtRef` ao fazer push; ignorar snapshots com `updatedAt <= lastWritten`; nunca fazer push durante a aplicação de um snapshot remoto.
- [x] Restaurar sessão no mount via `onAuthStateChanged` (sem re-login).

### 6. UI — card de sincronização em Configurações
- [x] Criar `src/components/settings/CloudSyncCard.tsx` — card com botão **"Entrar com Google"** (não logado), e após login: avatar/nome/email, "Sincronizar agora", "Sair" (com `DeleteConfirmDialog` de confirmação e aviso de que dados locais não são apagados).
- [x] `src/pages/Settings/index.tsx` — renderizar o card (ícone `Cloud`/`LogIn`); atualizar o rodapé de "Persistência 100% Local" para refletir status de sync quando logado.
- [x] Esconder/desativar o botão Google se a config Firebase estiver ausente (`.env` sem credenciais), com aviso em PT-BR.

### 7. Integração de providers + validação
- [x] `src/App.tsx` — adicionar `FirebaseProvider` dentro de `HabitProvider`.
- [x] Atualizar este documento (marcar etapas), `docs/ai_handoff.md` e `docs/AGENTS.md`/`docs/architecture.md` (seção de sincronização).
- [x] Validar na ordem: `npm run lint` → `npm run test:run` → `npm run build`.
- [ ] Smoke test manual: sign-in com Google, verificação de merge (dados locais preservados), sincronização em segundo dispositivo, disconnect/offline.

## Arquivos novos

| Arquivo | Finalidade |
|---|---|
| `src/services/firebase/config.ts` | Inicialização do SDK (auth + Firestore) via `.env` |
| `src/services/firebase/authService.ts` | Google sign-in / sign-out / observação de estado |
| `src/services/firebase/syncService.ts` | Leitura/escrita/observação do snapshot no Firestore |
| `src/services/syncMergeService.ts` | Merge puro (união + last-writer-wins) |
| `src/context/FirebaseContext.tsx` | Estado de auth + orquestração de sync/push |
| `src/components/settings/CloudSyncCard.tsx` | UI do card na tela Configurações |
| `src/tests/syncMergeService.test.ts` | Testes unitários do merge |
| `.env` / `.env.example` | Credenciais (não versionado) / placeholder |

## Arquivos a modificar (existentes)

| Arquivo | Alteração |
|---|---|
| `package.json` | + dependência `firebase` (requer aprovação) |
| `.gitignore` | + `.env`, `.env.local` |
| `src/constants/index.ts` | + chaves `syncUser`, `lastSyncAt` em `STORAGE_KEYS` |
| `src/App.tsx` | + `FirebaseProvider` dentro de `HabitProvider` |
| `src/pages/Settings/index.tsx` | + `CloudSyncCard` e atualização do rodapé |
| `docs/AGENTS.md` / `docs/architecture.md` / `docs/ai_handoff.md` | Documentar a feature e o estado |

*(Não serão alterados `src/types/index.ts`, `src/routes/index.tsx`, `vite.config.ts`, `tsconfig*.json` nem `index.html` — este planejamento não os exige.)*

## Riscos e limitações

- **Limite de 1 MB por documento Firestore**: resolvido com o particionamento mensal das coleções que crescem (`completions`, `pomodoroSessions`). Um único shard de mês fica na casa das dezenas/centenas de KB mesmo em uso intenso; o documento núcleo contém apenas dados pequenos e estáticos. Ainda assim, o `syncService` tratará erro de escrita (tamanho/quota) com mensagem amigável.
- **Conflito "último escritor vence por item"**: em edições simultâneas em dois dispositivos, uma das versões predomina por item; 100% dos dados são retidos (união). O modelo não faz merge de conteúdo dentro de um mesmo item editado em paralelo.
- **Lista de domínios autorizados do Google**: o sign-in popup pode falhar em domínios não configurados no console do Firebase (ex.: outro hostname de preview).
- **Realtime no dispositivo em uso**: conflito entre o push local (debounce) e um snapshot remoto recebido no meio — mitigado pela guarda anti-eco (`updatedAt`/flag de escrita).
- **Rastreamento de meses excluídos**: para não acumular docs órfãos no Firestore, o `writeSnapshot` compara os shards atuais com os previamente gravados (lista de meses armazenada no núcleo) e remove os que deixaram de existir.
