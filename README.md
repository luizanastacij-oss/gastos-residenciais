# Controle de Gastos Residenciais

Sistema de controle financeiro residencial desenvolvido como teste técnico, permitindo o cadastro de pessoas, registro de transações (receitas e despesas), consulta de indicadores consolidados por pessoa e da residência como um todo, e extratos financeiros detalhados com edição e exclusão de movimentações.

## Tecnologias utilizadas

- **Back-end:** .NET 8 (ASP.NET Core Web API) + Entity Framework Core + SQLite
- **Front-end:** React + TypeScript (Vite) + Recharts (gráficos) + lucide-react (ícones) + SheetJS/xlsx (exportação Excel) + jsPDF + jspdf-autotable (exportação PDF)

## Funcionalidades

### Cadastro de Pessoas
- Criação, listagem e exclusão de pessoas (nome, idade, identificador único gerado automaticamente).
- Ao excluir uma pessoa, todas as suas transações são removidas automaticamente (cascade delete configurado no `AppDbContext`).
- Disponível na aba **Cadastro** do menu lateral.

### Cadastro de Transações
- Criação de transações (descrição/categoria, valor, tipo — receita ou despesa —, pessoa responsável), disponível na aba **Cadastro**.
- Edição e exclusão de transações diretamente pelo **Extrato Financeiro** (ver abaixo).
- **Regra de negócio:** pessoas menores de 18 anos só podem registrar despesas. A validação é feita no back-end (`TransacoesController`, nos métodos `Create` e `Update`), impedindo o cadastro ou a edição de receitas para menores mesmo que a checagem do front seja contornada; o front-end também bloqueia essa opção na interface para melhorar a experiência do usuário.
- A pessoa vinculada à transação precisa existir previamente no cadastro (validação de integridade referencial).

### Painel Geral
- Cards clicáveis de **Receitas Acumuladas**, **Despesas Acumuladas** e **Saldo Líquido Geral**, que abrem o extrato correspondente ao clicar.
- Tabela **Resumo por Integrante**, com receitas, despesas e saldo individual de cada pessoa, e botão **Visualizar Extrato** para abrir o histórico financeiro individual.
- **Alertas Financeiros:** destaca automaticamente integrantes com saldo negativo.
- **Últimas Movimentações:** lista as transações mais recentes de toda a residência.
- Todos os indicadores são recalculados automaticamente após qualquer inclusão, edição ou exclusão de transação, sem necessidade de recarregar a página.

### Extrato Financeiro
Painel lateral (drawer) reutilizável, aberto tanto pelos cards do Painel Geral quanto pelo botão "Visualizar Extrato" de um integrante específico. Contém:

- **Totalizadores do período:** entradas, saídas e saldo, recalculados conforme os filtros aplicados.
- **Filtros combináveis:** período (data inicial/final), pessoa, tipo (receita/despesa), categoria, pesquisa textual por descrição ou responsável, e ordenação (data ou valor, crescente/decrescente).
- **Cabeçalho dinâmico:** quando o extrato é aberto para uma pessoa específica, o título exibe "Extrato de [Nome]"; ao alterar o filtro de Pessoa para "Todas as pessoas" dentro do próprio extrato, o título é atualizado automaticamente para "Extrato Geral", sem manter o nome da pessoa anteriormente selecionada.
- **Edição de movimentações:** botão de editar em cada linha, permitindo alterar descrição, valor, tipo, data e responsável diretamente na listagem.
- **Exclusão de movimentações:** botão de excluir com confirmação antes de remover o registro.
- **Exportação:** Excel (`.xlsx`) e PDF, respeitando os filtros aplicados no momento da exportação.

### Análise Gerencial
- Destaques: maior receita individual, maior despesa individual e integrante com maior saldo acumulado.
- Gráfico de despesas por categoria (pizza) e gráfico de evolução mensal — receita x despesa x saldo dos últimos 6 meses (barras + linha).
- Ranking visual por saldo entre os integrantes.
- **Exportação em Excel:** relatório completo com 4 abas (Resumo por Integrante, Indicadores Gerais, Evolução Mensal, Últimas Transações).

### Manual do Usuário
Aba com documentação completa do sistema para o usuário final: visão geral, controle financeiro, extrato financeiro (incluindo a regra do cabeçalho dinâmico), filtros, relatórios, regras de negócio e uma seção de perguntas frequentes (FAQ).

## Persistência de dados

Os dados são armazenados em um banco SQLite (`gastos.db`), gerado automaticamente via migrations do Entity Framework Core. Os dados persistem entre execuções da aplicação — fechar e abrir o sistema novamente mantém todo o histórico cadastrado.

## Como executar o projeto

### Pré-requisitos
- .NET SDK 8.0+
- Node.js 18+

### 1. Back-end

```bash
cd GastosResidenciais.Api
dotnet restore
dotnet ef database update   # cria o banco gastos.db e aplica as migrations
dotnet run
```

A API sobe em `http://localhost:5167`.

### 2. Front-end

Em outro terminal:

```bash
cd gastos-front
npm install
npm run dev
```

O front sobe por padrão em `http://localhost:5173` (o Vite escolhe automaticamente a próxima porta livre, como `5174`, caso a padrão já esteja em uso — confirme a porta exibida no terminal).

> ⚠️ Se a porta da API for diferente de `5167`, ajuste a constante `API_URL` em `gastos-front/src/App.tsx`.

## Endpoints da API

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/pessoas` | Lista todas as pessoas cadastradas |
| POST | `/api/pessoas` | Cadastra uma nova pessoa |
| DELETE | `/api/pessoas/{id}` | Exclui uma pessoa e suas transações (cascade) |
| GET | `/api/transacoes` | Lista todas as transações |
| POST | `/api/transacoes` | Registra uma nova transação |
| PUT | `/api/transacoes/{id}` | Edita uma transação existente |
| DELETE | `/api/transacoes/{id}` | Exclui uma transação |
| GET | `/api/totais` | Retorna KPIs, gráficos, destaques e resumo por integrante |

## Decisões técnicas

- **SQLite** foi escolhido por não exigir instalação de um servidor de banco separado, facilitando a avaliação do teste em qualquer máquina.
- **Cascade delete** configurado explicitamente no `AppDbContext` (em vez de depender do comportamento padrão do EF Core) para deixar a regra de negócio explícita e visível no código.
- **Validação de menor de idade** centralizada no back-end como fonte de verdade (aplicada tanto na criação quanto na edição de transações), com reforço no front-end apenas para UX (impedir a seleção da opção "Receita" na interface).
- **Tratamento de erros** em todas as chamadas `fetch` do front, evitando falhas silenciosas e exibindo mensagens claras ao usuário quando a API retorna erro de validação (HTTP 400) ou está indisponível.
- **`ReferenceHandler.IgnoreCycles`** configurado no `System.Text.Json` para evitar erro de serialização causado pela referência bidirecional entre `Pessoa` e `Transacao`.
- **Componente `ExtratoDrawer` reutilizável:** um único componente atende aos três contextos de extrato (Receitas, Despesas, Saldo Geral e extrato individual por pessoa), alterando apenas a origem dos dados e o filtro inicial, evitando duplicação de telas.
- **Cabeçalho reativo ao filtro:** o título do extrato é derivado do estado atual do filtro de Pessoa (via `useMemo`) em vez de fixado no momento da abertura, evitando que o cabeçalho "grude" na última pessoa selecionada.
- **Recarregamento centralizado:** toda operação de criação, edição ou exclusão (pessoas e transações) chama uma única função (`carregarDados`) que atualiza KPIs, resumo por integrante, alertas e timeline de uma vez, garantindo consistência entre as telas sem necessidade de recarregar a página.

## Autor

**Luiz Carlos da Silva Anastácio**