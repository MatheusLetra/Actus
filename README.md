# Actus — Controle de Hábitos Pessoais

Uma aplicação web completa, moderna e responsiva (Mobile-First) para **cadastrar, acompanhar e analisar hábitos diários**, com estatísticas detalhadas, gráficos interativos e cálculo automático de streaks.

A aplicação funciona **100% no navegador (offline-first)**, com persistência total via `localStorage`.

---

## 🚀 Tecnologias Utilizadas

* **Core**: React.js 19, Vite 8, TypeScript (Strict Mode)
* **Estilização**: Tailwind CSS v4, Lucide React (ícones), Shadcn/UI Components
* **Roteamento**: React Router DOM 7
* **Gráficos**: Recharts 3
* **Testes**: Vitest (testes unitários para serviços e algoritmos de streak)

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
├── types/                # Interfaces estritas (Habit, Category, Completion, Stats)
├── constants/            # Lista de ícones, cores, chaves de localStorage e dias da semana
├── utils/                # Utilitários de merge de classes CSS (cn)
├── services/             # Regras de negócio puras (isoladas da UI)
│   ├── dateService.ts    # Operações de data timezone-safe (YYYY-MM-DD)
│   ├── streakService.ts  # Algoritmo de cálculo de streaks e taxas
│   ├── statisticsService.ts # Agrupamentos de analytics e gráficos
│   └── seedService.ts    # Carga de dados iniciais de demonstração
├── repositories/         # Camada de persistência desacoplada
│   ├── storageService.ts # Wrapper seguro sobre localStorage com try/catch
│   ├── habitRepository.ts
│   ├── categoryRepository.ts
│   └── completionRepository.ts
├── context/              # Gerenciamento de estado reativo (ThemeContext, HabitContext)
├── components/
│   ├── ui/               # Building blocks do Shadcn/UI (Button, Card, Dialog, Progress, Switch, Sheet, etc.)
│   ├── common/           # IconRenderer, IconPicker, ColorPicker, DeleteConfirmDialog, EmptyState
│   ├── layout/           # Sidebar, Header, AppLayout
│   ├── dashboard/        # TodayHabitItem
│   ├── habits/           # HabitCard, HabitFormDialog, CalendarHeatmap
│   ├── categories/       # CategoryCard, CategoryFormDialog
│   └── charts/           # Last7DaysChart, Last30DaysChart, CategoryDistributionChart, HabitPerformanceChart
├── pages/
│   ├── Dashboard/        # Visão geral de métricas e hábitos do dia
│   ├── Habits/           # CRUD e listagem de hábitos com filtros
│   ├── Categories/       # CRUD de categorias com proteção contra exclusão
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

Caso o `localStorage` contenha dados corrompidos, o `storageService` intercepta e retorna fallbacks seguros sem quebrar a aplicação.

---

## 🔥 Cálculo de Streaks

As regras de streak são puras e não dependem do React:
1. **Streak Atual (`calculateCurrentStreak`)**: Conta sequências ininterruptas de dias concluídos. Se a data atual ainda não foi marcada como concluída, o sistema avalia a partir do dia anterior para não interromper a sequência indevidamente durante o dia vigente.
2. **Maior Streak (`calculateLongestStreak`)**: Percorre todo o histórico do hábito a partir da sua `startDate` e encontra a maior sequência contínua de conclusões.
3. **Heatmap Mensal (`CalendarHeatmap`)**: Visualiza o status de cada dia do mês (concluído, pendente ou folga) com navegação de meses.

---

## 🧪 Testes Unitários

Para executar a suíte de testes:
```bash
npm run test:run
```

Os testes cobrem:
* Manipulação e formatação de datas (`dateService.test.ts`)
* Algoritmo de streaks e sequência histórica (`streakService.test.ts`)
