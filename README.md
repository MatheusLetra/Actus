# Actus — Controle de Hábitos Pessoais

Uma aplicação web completa, moderna e responsiva (Mobile-First) para **cadastrar, acompanhar e analisar hábitos diários**, com estatísticas detalhadas, gráficos interativos e cálculo automático de streaks.

A aplicação funciona **100% no navegador (offline-first)**, com persistência total via `localStorage`.

Inclui também um menu de **Ferramentas Úteis** com o **Pomodoro** e o **Quadro Kanban**: timer de foco/pausas totalmente configurável com vínculo opcional de hábitos/tarefas e registro automático de ciclos; quadro de tarefas com colunas personalizáveis, drag and drop e integração com o Pomodoro.

Há ainda uma **sincronização opcional com a nuvem**: ao entrar com a conta **Google**, seus dados (localStorage + Cloud Firestore) são mesclados e sincronizados automaticamente entre dispositivos, sem perder nenhum dado local. Alterações, inclusões e exclusões (como desmarcar um hábito ou apagar um registro) são propagadas entre todos os dispositivos. Credenciais via arquivo `.env`.

---

## 🚀 Tecnologias Utilizadas

* **Core**: React.js 19, Vite 8, TypeScript (Strict Mode)
* **Estilização**: Tailwind CSS v4, Lucide React (ícones), Shadcn/UI Components
* **Roteamento**: React Router DOM 7
* **Gráficos**: Recharts 3
* **Drag and drop**: @dnd-kit/core + @dnd-kit/sortable (Quadro Kanban)
* **Notificações & Áudio**: Web Notifications API e Web Audio (com arquivo de som em `public/`)
* **Cloud (opcional)**: Firebase (Authentication com Google + Cloud Firestore) para sincronização de dados
* **Testes**: Vitest (testes unitários para serviços e algoritmos de streak/pomodoro/kanban/sincronização)

---

## 🛠️ Instalação e Execução

### Pré-requisitos
* Node.js v18 ou superior
* Gerenciador de pacotes npm, yarn ou pnpm

### Passos
1. Entrar no diretório do projeto:
   ```bash
   cd actus
   ```
2. Instalar as dependências:
   ```bash
   npm install
   ```
3. Executar o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```
4. Acessar a aplicação em `http://localhost:5173`.

> **Opcional (sincronização com Google)**: copie `.env.example` para `.env` e preencha as credenciais do projeto Firebase. Sem isso, a funcionalidade fica oculta e o app continua 100% local.

---

## 📜 Scripts Disponíveis

* `npm run dev`: Inicia o servidor local de desenvolvimento Vite.
* `npm run build`: Valida a tipagem estrita do TypeScript e gera o build de produção minificado.
* `npm run preview`: Visualiza localmente o build de produção.
* `npm run lint`: Checa a ausência de erros de compilação/tipagem TypeScript (`tsc --noEmit`).
* `npm run test`: Executar suíte de testes unitários com Vitest em modo watch.
* `npm run test:run`: Executa os testes unitários uma única vez.

---

## 🏗️ Arquitetura do Projeto

O projeto segue princípios estritos de **Clean Code, SOLID, Single Responsibility e Separation of Concerns (SoC)**.

```text
src/
├── types/                # Interfaces estritas (Habit, Category, Completion, Stats, Pomodoro)
├── constants/            # Lista de ícones, cores, chaves de localStorage, dias da semana e labels do pomodoro
├── utils/                # Utilitários de merge de classes CSS (cn)
├── services/             # Regras de negócio puras (isoladas da UI)
│   ├── dateService.ts    # Operações de data timezone-safe (YYYY-MM-DD)
│   ├── streakService.ts  # Algoritmo de cálculo de streaks e taxas
│   ├── statisticsService.ts # Agrupamentos de analytics e gráficos
│   ├── seedService.ts    # Carga de dados iniciais de demonstração
│   ├── pomodoroService.ts # Lógica do pomodoro (settings, sequência de fases, stats de ciclos)
│   ├── kanbanService.ts  # Lógica do kanban (defaults, validação, ordenação, moveTask, stats)
│   └── syncMergeService.ts # Merge de snapshots (união + last-writer-wins + tombstones de exclusão) para sincronização
│   ├── notificationService.ts # Notificações do navegador (helper de browser)
│   └── audioService.ts   # Som de alerta (helper de browser)
│   └── firebase/         # config.ts, authService.ts, syncService.ts (helpers de browser — não puros)
├── repositories/         # Camada de persistência desacoplada
│   ├── storageService.ts # Wrapper seguro sobre localStorage com try/catch
│   ├── habitRepository.ts
│   ├── categoryRepository.ts
│   ├── completionRepository.ts
│   ├── pomodoroRepository.ts
│   ├── kanbanRepository.ts
│   └── tombstoneRepository.ts # Marcas de exclusão propagadas na sincronização
├── context/              # Gerenciamento de estado reativo (ThemeContext, HabitContext, FirebaseContext)
├── components/
│   ├── ui/               # Building blocks do Shadcn/UI (Button, Card, Dialog, Progress, Switch, Sheet, etc.)
│   ├── common/           # IconRenderer, IconPicker, ColorPicker, DeleteConfirmDialog, EmptyState
│   ├── layout/           # Sidebar, Header, AppLayout
│   ├── settings/         # CloudSyncCard (login/sincronização com Google)
│   ├── dashboard/        # TodayHabitItem
│   ├── habits/           # HabitCard, HabitFormDialog, CalendarHeatmap
│   ├── categories/       # CategoryCard, CategoryFormDialog
│   ├── pomodoro/         # PomodoroTimer, PomodoroSettingsForm, PomodoroSessionLog, usePomodoroTimer
│   ├── kanban/           # KanbanBoard, KanbanColumn, KanbanTaskCard, KanbanColumnFormDialog, KanbanTaskFormDialog, KanbanBoardSettingsDialog, KanbanAdvanceDialog
│   └── charts/           # Last7DaysChart, Last30DaysChart, CategoryDistributionChart, HabitPerformanceChart, PomodoroDailyChart, PomodoroHabitChart, PomodoroCycleDistribution
├── pages/
│   ├── Dashboard/        # Visão geral de métricas e hábitos do dia
│   ├── Habits/           # CRUD e listagem de hábitos com filtros
│   ├── Categories/       # CRUD de categorias com proteção contra exclusão
│   ├── Tools/            # Menu de Ferramentas Úteis
│   ├── Pomodoro/         # Timer + configurações + histórico + gráficos de ciclos
│   ├── Kanban/           # Quadro de tarefas com colunas e drag and drop
│   ├── History/          # Log histórico e filtros por período
│   └── Settings/         # Escolha de temas (Claro/Escuro/Sistema) e Backup JSON
├── routes/               # Configuração do React Router
└── tests/                # Suíte de testes unitários automatizados (Vitest)
```

---

## 💾 Persistência de Dados (`localStorage`)

Toda a leitura e gravação no `localStorage` é centralizada na camada de **repositories**. Componentes visuais e páginas nunca chamam `localStorage` diretamente.

As chaves são centralizadas:
* `actus:habits`: Lista de hábitos cadastrados
* `actus:categories`: Lista de categorias
* `actus:completions`: Histórico de conclusões por data (`YYYY-MM-DD`)
* `actus:theme`: Preferência de tema (`light` | `dark` | `system`)
* `actus:pomodoroSettings`: Configurações do pomodoro (durações, auto-início, notificações/som, hábito/tarefa vinculados)
* `actus:pomodoroSessions`: Ciclos de pomodoro registrados (foco, pausas e sessão ativa/pausada)
* `actus:kanbanBoard`: Quadro kanban (nome/cor)
* `actus:kanbanColumns`: Colunas do quadro kanban
* `actus:kanbanTasks`: Tarefas do quadro kanban
* `actus:tombstones`: Marcas de exclusão (usadas pela sincronização para propagar deleções/desmarcações)
* `actus:syncUser`: Conta Google conectada (quando a sincronização está ativa)
* `actus:lastSyncAt`: Data/hora da última sincronização bem-sucedida

Caso o `localStorage` contenha dados corrompidos, o `storageService` intercepta e retorna fallbacks seguros sem quebrar a aplicação.

A sincronização com o Firebase (quando ativa) usa o `syncMergeService` para **mesclar** os dados locais com os da nuvem na conta do usuário — hábitos, categorias, conclusões, pomodoro e kanban são unificados por item (nada é sobrescrito em massa) e participados por mês no Firestore para respeitar os limites de tamanho de documento. Exclusões (apagar hábito/categoria/registro ou desmarcar uma conclusão) ficam gravadas como **tombstones**, garantindo que a remoção também se propague para os demais dispositivos.

---

## 🔥 Cálculo de Streaks

As regras de streak são puras e não dependem do React:
1. **Streak Atual (`calculateCurrentStreak`)**: Conta sequências ininterruptas de dias concluídos. Se a data atual ainda não foi marcada como concluída, o sistema avalia a partir do dia anterior para não interromper a sequência indevidamente durante o dia vigente.
2. **Maior Streak (`calculateLongestStreak`)**: Percorre todo o histórico do hábito a partir da sua `startDate` e encontra a maior sequência contínua de conclusões.
3. **Heatmap Mensal (`CalendarHeatmap`)**: Visualiza o status de cada dia do mês (concluído, pendente ou folga) com navegação de meses.

---

## ⏱️ Ferramenta Pomodoro

Acessível pelo menu **Ferramentas** na Sidebar. Principais funções:

1. **Timer configurável**: durações de foco, pausa curta e pausa longa (com intervalo de pausa longa a cada N ciclos), auto-início de foco/pausas, e vínculo opcional a um hábito cadastrado ou a uma tarefa do Quadro Kanban.
2. **Notificações ao final do tempo**: alerta do navegador (Web Notifications) e som (`public/pomodoro-chime.wav`, com fallback via Web Audio) — ambos configuráveis.
3. **Registro automático de ciclos**: todo foco concluído é registrado no histórico; se houver hábito vinculado, sua conclusão é marcada na data (respeitando o agendamento do hábito); se houver tarefa do quadro vinculada, é possível avançá-la para outra etapa.
4. **Pausar e concluir depois**: o ciclo pausado é persistido (tempo restante) no `localStorage`; ao voltar, é possível retomar ou concluir manualmente.
5. **Gráficos de métricas**: ciclos de foco nos últimos 30 dias, distribuição entre foco/pausas e comparação de focos por hábito vinculado.

---

## 📋 Ferramenta Quadro Kanban

Acessível pelo menu **Ferramentas** na Sidebar. Principais funções:

1. **Colunas personalizáveis**: etapas com nome e cor, criadas/renomeadas/excluídas por modais.
2. **Tarefas com drag and drop**: ordenação dentro e entre colunas, com vínculo opcional a um hábito cadastrado.
3. **Integração com o Pomodoro**: vincule uma tarefa ao foco e avance-a para outra etapa ao concluir o ciclo.
4. **Responsivo**: colunas lado a lado no desktop e empilhadas verticalmente no mobile.

---

## ☁️ Sincronização com Google / Firebase

Acessível pela tela **Configurações** (card "Sincronização com a Nuvem"). Funciona assim:

1. **Login com Google**: Firebase Authentication (`signInWithPopup`); a sessão é restaurada automaticamente entre visitas. Sem credenciais no `.env`, o card fica oculto e o app continua 100% local.
2. **Mescla, não sobrescreve**: ao entrar, os dados do dispositivo são **mesclados** com os dados da conta (`syncMergeService` — união por item com "quem editou por último vence"). Nenhum dado local é perdido; em um novo dispositivo, os dados da nuvem são baixados para o localStorage.
3. **Deleções propagam**: apagar um hábito/categoria/registro ou **desmarcar uma conclusão** gera um *tombstone* (marca de exclusão). A remoção é propagada a todos os dispositivos; uma nova marcação (re-marcar) revoga a exclusão e volta a sincronizar.
4. **Sincronização automática e bidirecional**: toda alteração local é enviada à nuvem (com debounce); alterações feitas em outro dispositivo são aplicadas em tempo real (`onSnapshot`), com proteção contra loops de escrita.
5. **Armazenamento no Firestore**: um documento por usuário (`users/{uid}`) com as coleções que crescem (`completions`, `pomodoroSessions`) particionadas por mês.
6. **Controles**: botões "Sincronizar agora" (manual) e "Sair da conta" (os dados do dispositivo permanecem intactos).

> Pré-requisito (console do Firebase): habilitar Google Authentication, criar o banco Firestore e aplicar as regras de segurança que restringem o acesso por UID — exemplo em `docs/PLANEJAMENTO-SINCRONIZACAO-GOOGLE.md`.

---

## 🧪 Testes Unitários

Para executar a suíte de testes:
```bash
npm run test:run
```

Os testes cobrem:
* Manipulação e formatação de datas (`dateService.test.ts`)
* Algoritmo de streaks e sequência histórica (`streakService.test.ts`)
* Lógica do pomodoro: validação de settings, durações, sequência de fases e agregação de stats (`pomodoroService.test.ts`)
* Lógica do kanban: defaults, validação, ordenação/reindexação e movimentação de tarefas (`kanbanService.test.ts`)
* Lógica de sincronização: merge de snapshots, união por item, resolução de conflitos e propagação de exclusões via tombstones (`syncMergeService.test.ts`)
