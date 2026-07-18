import { useEffect, useMemo, useState } from 'react';
import { PieChart, Pie, Cell, ComposedChart, Bar, Line, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Wallet, TrendingUp, TrendingDown, Users, FileText, BookOpen, LayoutDashboard, BarChart3 } from 'lucide-react';
import './App.css';
import * as XLSX from 'xlsx';
import ExtratoDrawer, { type TransacaoComSaldo } from "./assets/Components/ExtratoDrawer.tsx";

interface Pessoa { id: number; nome: string; idade: number; }

interface DashboardData {
  kpis: {
    receita: { valor: number; tendencia: number };
    despesa: { valor: number; tendencia: number };
    saldoGeral: number;
  };
  graficos: {
    categorias: { name: string; valor: number }[];
    mensal: { mes: string; receita: number; despesa: number }[];
  };
  stats: {
    maiorReceita: { nome?: string; valor: number } | null;
    maiorDespesa: { nome?: string; valor: number } | null;
    topMembro: string | null;
  };
  timeline: { descricao: string; valor: number; tipo: number; data: string; nome: string }[];
  membros: { id: number; nome: string; idade: number; receitas: number; despesas: number; saldo: number }[];
}

const formatarBRL = (valor: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);

const maskCurrency = (value: string) => {
  const digits = value.replace(/\D/g, "");
  return formatarBRL(Number(digits) / 100);
};

const API_URL = 'http://localhost:5167/api'; // ajuste a porta conforme o "dotnet run" exibir

const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#0ea5e9'];

type Pagina = 'dashboard' | 'analise' | 'cadastro' | 'manual';

interface DrawerState {
  aberto: boolean;
  titulo: string;
  modoPessoa: boolean;
  mostrarSaldo: boolean;
  filtroTipoInicial: number | 'todos';
  filtroPessoaInicial: number | 'todos';
}

function App() {
  const [page, setPage] = useState<Pagina>('dashboard');
  const [data, setData] = useState<DashboardData | null>(null);
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [transacoes, setTransacoes] = useState<TransacaoComSaldo[]>([]);

  const [drawer, setDrawer] = useState<DrawerState>({
    aberto: false, titulo: '', modoPessoa: false, mostrarSaldo: false,
    filtroTipoInicial: 'todos', filtroPessoaInicial: 'todos'
  });

  const [nome, setNome] = useState('');
  const [idade, setIdade] = useState('');

  const [valorInput, setValorInput] = useState('');
  const [tipo, setTipo] = useState(0);
  const [pessoaId, setPessoaId] = useState(0);
  const [descricao, setDescricao] = useState('');
  const [outraDescricao, setOutraDescricao] = useState('');

  const listDespesas = ['Conta de Luz', 'Água', 'Supermercado', 'Aluguel', 'Internet', 'Outros'];
  const listReceitas = ['Salário', 'Vendas', 'Investimentos', 'Freelance', 'Outros'];

  const carregarDados = async () => {
    try {
      const [resT, resP, resTr] = await Promise.all([
        fetch(`${API_URL}/totais`),
        fetch(`${API_URL}/pessoas`),
        fetch(`${API_URL}/transacoes`)
      ]);
      setData(await resT.json());
      setPessoas(await resP.json());

      const bruto: Omit<TransacaoComSaldo, 'saldoAcumulado'>[] = await resTr.json();
      const cronologica = [...bruto].sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());
      let acumulado = 0;
      const comSaldo: TransacaoComSaldo[] = cronologica.map(t => {
        acumulado += t.tipo === 1 ? t.valor : -t.valor;
        return { ...t, saldoAcumulado: acumulado };
      });
      setTransacoes(comSaldo);
    } catch (err) {
      console.error("Erro na API:", err);
    }
  };

  useEffect(() => { carregarDados(); }, []);

  const pessoaSelecionada = pessoas.find(p => p.id === pessoaId);
  const isMenorDeIdade = !!pessoaSelecionada && pessoaSelecionada.idade < 18;

  useEffect(() => {
    if (isMenorDeIdade && tipo === 1) setTipo(0);
  }, [pessoaId]);

  const handleCadastrarPessoa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !idade) return;
    try {
      const res = await fetch(`${API_URL}/pessoas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, idade: Number(idade) })
      });
      if (!res.ok) {
        const erro = await res.json().catch(() => null);
        alert(erro?.mensagem ?? "Não foi possível cadastrar.");
        return;
      }
      setNome(''); setIdade('');
      await carregarDados();
    } catch {
      alert("Não foi possível conectar à API. Verifique se o backend está rodando.");
    }
  };

  const handleExcluirPessoa = async (id: number) => {
    if (!confirm("Excluir esta pessoa também remove todas as transações dela. Confirmar?")) return;
    try {
      await fetch(`${API_URL}/pessoas/${id}`, { method: 'DELETE' });
      await carregarDados();
    } catch {
      alert("Não foi possível conectar à API. Verifique se o backend está rodando.");
    }
  };

  const handleSalvarTransacao = async (e: React.FormEvent) => {
    e.preventDefault();
    const valorPuro = Number(valorInput.replace(/\D/g, "")) / 100;
    const descFinal = descricao === 'Outros' ? outraDescricao : descricao;
    if (!pessoaId || !descFinal || !valorPuro) {
      alert("Preencha responsável, descrição e valor.");
      return;
    }
    try {
      const res = await fetch(`${API_URL}/transacoes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ descricao: descFinal, valor: valorPuro, tipo, pessoaId })
      });
      if (!res.ok) {
        const erro = await res.json().catch(() => null);
        alert(erro?.mensagem ?? `Erro ao salvar (status ${res.status}).`);
        return;
      }
      setValorInput(''); setDescricao('');
      await carregarDados();
    } catch {
      alert("Não foi possível conectar à API. Verifique se o backend está rodando.");
    }
  };

  const handleEditarTransacao = async (
    id: number,
    dados: { descricao: string; valor: number; tipo: number; data: string; pessoaId: number }
  ): Promise<boolean> => {
    try {
      const res = await fetch(`${API_URL}/transacoes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados)
      });

      if (!res.ok) {
        const erro = await res.json().catch(() => null);
        alert(erro?.mensagem ?? `Erro ao editar (status ${res.status}).`);
        return false;
      }

      await carregarDados();
      return true;
    } catch {
      alert("Não foi possível conectar à API. Verifique se o backend está rodando.");
      return false;
    }
  };

  const handleExcluirTransacao = async (id: number): Promise<boolean> => {
    try {
      const res = await fetch(`${API_URL}/transacoes/${id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) {
        const erro = await res.json().catch(() => null);
        alert(erro?.mensagem ?? "Não foi possível excluir a movimentação.");
        return false;
      }
      await carregarDados();
      return true;
    } catch {
      alert("Não foi possível conectar à API. Verifique se o backend está rodando.");
      return false;
    }
  };

  const handleExportarExcel = () => {
    if (!data) return;
    const abaResumo = data.membros.map(m => ({ Pessoa: m.nome, Idade: m.idade, Receitas: m.receitas, Despesas: m.despesas, Saldo: m.saldo }));
    const abaKpis = [
      { Indicador: 'Receitas Acumuladas', Valor: data.kpis.receita.valor },
      { Indicador: 'Despesas Acumuladas', Valor: data.kpis.despesa.valor },
      { Indicador: 'Saldo Líquido Geral', Valor: data.kpis.saldoGeral },
      { Indicador: 'Maior Receita Individual', Valor: data.stats?.maiorReceita?.valor ?? 0, Responsável: data.stats?.maiorReceita?.nome ?? '—' },
      { Indicador: 'Maior Despesa Individual', Valor: data.stats?.maiorDespesa?.valor ?? 0, Responsável: data.stats?.maiorDespesa?.nome ?? '—' },
      { Indicador: 'Destaque do Mês', Responsável: data.stats?.topMembro ?? '—' },
    ];
    const abaMensal = data.graficos.mensal.map(m => ({ Mês: m.mes, Receita: m.receita, Despesa: m.despesa, Saldo: m.receita - m.despesa }));
    const abaTimeline = data.timeline.map(t => ({ Data: new Date(t.data).toLocaleDateString('pt-BR'), Pessoa: t.nome, Descrição: t.descricao, Tipo: t.tipo === 1 ? 'Receita' : 'Despesa', Valor: t.valor }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(abaResumo), 'Resumo por Integrante');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(abaKpis), 'Indicadores Gerais');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(abaMensal), 'Evolução Mensal');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(abaTimeline), 'Últimas Transações');
    const dataAtual = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
    XLSX.writeFile(workbook, `relatorio-financeiro-${dataAtual}.xlsx`);
  };

  const abrirExtrato = (opts: Partial<DrawerState> & { titulo: string }) => {
    setDrawer({
      aberto: true,
      modoPessoa: false,
      mostrarSaldo: false,
      filtroTipoInicial: 'todos',
      filtroPessoaInicial: 'todos',
      ...opts,
    });
  };

  const fecharDrawer = () => setDrawer(d => ({ ...d, aberto: false }));

  const alertasFinanceiros = useMemo(
    () => (data?.membros ?? []).filter(m => m.saldo < 0),
    [data]
  );

  if (!data) return <div style={{ padding: '40px' }}>Carregando Dashboard...</div>;

  return (
    <div className="app-wrapper">
      <aside className="sidebar">
        <div className={`nav-item ${page === 'dashboard' ? 'active' : ''}`} onClick={() => setPage('dashboard')}>
          <LayoutDashboard size={18} /> Painel Geral
        </div>
        <div className={`nav-item ${page === 'analise' ? 'active' : ''}`} onClick={() => setPage('analise')}>
          <BarChart3 size={18} /> Análise Gerencial
        </div>
        <div className={`nav-item ${page === 'cadastro' ? 'active' : ''}`} onClick={() => setPage('cadastro')}>
          <Users size={18} /> Cadastro
        </div>
        <div className={`nav-item ${page === 'manual' ? 'active' : ''}`} onClick={() => setPage('manual')}>
          <BookOpen size={18} /> Manual do Usuário
        </div>
      </aside>

      <main className="main-body">
        <header className="topbar">
          <h2>Controle Financeiro Residencial</h2>
        </header>

        <div className="dashboard-content">
          {page === 'dashboard' && (
            <>
              <div
                className="card card-clicavel"
                onClick={() => abrirExtrato({ titulo: 'Extrato de Receitas', filtroTipoInicial: 1 })}
              >
                <div className="kpi-icone kpi-icone-success"><TrendingUp size={20} /></div>
                <div className="kpi-label">Receitas Acumuladas</div>
                <div className="kpi-value text-success">{formatarBRL(data.kpis.receita.valor)}</div>
                <div className="kpi-sub">Clique para ver o extrato completo</div>
              </div>

              <div
                className="card card-clicavel"
                onClick={() => abrirExtrato({ titulo: 'Extrato de Despesas', filtroTipoInicial: 0 })}
              >
                <div className="kpi-icone kpi-icone-danger"><TrendingDown size={20} /></div>
                <div className="kpi-label">Despesas Acumuladas</div>
                <div className="kpi-value text-danger">{formatarBRL(data.kpis.despesa.valor)}</div>
                <div className="kpi-sub">Clique para ver o extrato completo</div>
              </div>

              <div
                className="card card-clicavel"
                onClick={() => abrirExtrato({ titulo: 'Saldo Líquido Geral', mostrarSaldo: true })}
              >
                <div className="kpi-icone kpi-icone-primary"><Wallet size={20} /></div>
                <div className="kpi-label">Saldo Líquido Geral</div>
                <div className="kpi-value text-primary">{formatarBRL(data.kpis.saldoGeral)}</div>
                <div className="kpi-sub">Clique para ver o extrato completo</div>
              </div>

              <div className="card" style={{ gridColumn: '1 / -1' }}>
                <h3>Resumo por Integrante</h3>
                <table className="tabela-resumo">
                  <thead>
                    <tr>
                      <th>Pessoa</th>
                      <th>Receitas</th>
                      <th>Despesas</th>
                      <th>Saldo</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.membros.map(m => (
                      <tr key={m.id}>
                        <td>{m.nome}</td>
                        <td className="text-success">{formatarBRL(m.receitas)}</td>
                        <td className="text-danger">{formatarBRL(m.despesas)}</td>
                        <td className={m.saldo >= 0 ? 'text-success' : 'text-danger'}>{formatarBRL(m.saldo)}</td>
                        <td>
                          <button
                            className="btn-link"
                            onClick={() => abrirExtrato({
                              titulo: `Extrato de ${m.nome}`,
                              modoPessoa: true,
                              filtroPessoaInicial: m.id,
                            })}
                          >
                            Visualizar Extrato
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {alertasFinanceiros.length > 0 && (
                <div className="card card-alerta" style={{ gridColumn: '1 / -1' }}>
                  <h3>Alertas Financeiros</h3>
                  {alertasFinanceiros.map(m => (
                    <div key={m.id} className="alerta-item">
                      <span>{m.nome} está com saldo negativo</span>
                      <span className="text-danger">{formatarBRL(m.saldo)}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="card" style={{ gridColumn: '1 / -1' }}>
                <h3>Últimas Movimentações</h3>
                {data.timeline.map((t, i) => (
                  <div key={i} className="timeline-item">
                    <span>{t.descricao} <span className="timeline-nome">({t.nome})</span></span>
                    <span className={t.tipo === 1 ? 'text-success' : 'text-danger'}>{t.tipo === 1 ? '+' : '-'}{formatarBRL(t.valor)}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {page === 'analise' && (
            <>
              <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn-primary" style={{ width: 'auto', padding: '10px 20px' }} onClick={handleExportarExcel}>
                  Baixar Relatório em Excel
                </button>
              </div>

              <div className="card">
                <div className="kpi-label">Maior Receita Individual</div>
                <div className="kpi-value text-success">{data.stats?.maiorReceita ? formatarBRL(data.stats.maiorReceita.valor) : '—'}</div>
                <div className="kpi-sub">{data.stats?.maiorReceita?.nome ?? 'Sem registros'}</div>
              </div>
              <div className="card">
                <div className="kpi-label">Maior Despesa Individual</div>
                <div className="kpi-value text-danger">{data.stats?.maiorDespesa ? formatarBRL(data.stats.maiorDespesa.valor) : '—'}</div>
                <div className="kpi-sub">{data.stats?.maiorDespesa?.nome ?? 'Sem registros'}</div>
              </div>
              <div className="card">
                <div className="kpi-label">Destaque do Mês</div>
                <div className="kpi-value text-primary">{data.stats?.topMembro ?? '—'}</div>
                <div className="kpi-sub">Maior saldo acumulado</div>
              </div>

              <div className="card">
                <h3>Despesas por Categoria</h3>
                <div style={{ height: '260px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={data.graficos.categorias} dataKey="valor" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={3}>
                        {data.graficos.categorias.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(value: any) => formatarBRL(Number(value))} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="card">
                <h3>Receita × Despesa × Saldo (6 meses)</h3>
                <div style={{ height: '260px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={data.graficos.mensal.map(m => ({ ...m, saldo: m.receita - m.despesa }))}>
                      <XAxis dataKey="mes" stroke="#64748b" />
                      <Tooltip formatter={(value: any) => formatarBRL(Number(value))} />
                      <Bar dataKey="receita" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="despesa" fill="#ef4444" radius={[4, 4, 0, 0]} />
                      <Line type="monotone" dataKey="saldo" stroke="#4f46e5" strokeWidth={2} dot={{ r: 3 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="card" style={{ gridColumn: '1 / -1' }}>
                <h3>Ranking por Saldo</h3>
                {[...data.membros].sort((a, b) => b.saldo - a.saldo).map(m => {
                  const max = Math.max(...data.membros.map(x => Math.abs(x.saldo)), 1);
                  const largura = Math.min(100, (Math.abs(m.saldo) / max) * 100);
                  return (
                    <div key={m.id} style={{ marginBottom: '14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '4px' }}>
                        <span>{m.nome}{m.idade < 18 && <span className="badge-menor"> menor de idade</span>}</span>
                        <span className={m.saldo >= 0 ? 'text-success' : 'text-danger'}>{formatarBRL(m.saldo)}</span>
                      </div>
                      <div className="barra-fundo">
                        <div className="barra-preenchida" style={{ width: `${largura}%`, background: m.saldo >= 0 ? '#10b981' : '#ef4444' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {page === 'cadastro' && (
            <>
              <div className="card" style={{ gridColumn: '1 / -1' }}>
                <h3><Users size={18} style={{ verticalAlign: 'text-bottom', marginRight: 6 }} />Cadastro de Pessoas</h3>
                <form onSubmit={handleCadastrarPessoa}>
                  <label>Nome Completo</label>
                  <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: João Silva" />
                  <label>Idade</label>
                  <input type="number" value={idade} onChange={e => setIdade(e.target.value)} placeholder="Ex: 28" />
                  <button type="submit" className="btn-primary">Cadastrar Pessoa</button>
                </form>
                <div className="lista-pessoas">
                  {pessoas.map(p => (
                    <div key={p.id} className="pessoa-item">
                      <span>{p.nome} ({p.idade} anos){p.idade < 18 && <span className="badge-menor"> menor de idade</span>}</span>
                      <button className="btn-danger" onClick={() => handleExcluirPessoa(p.id)}>Excluir</button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card" style={{ gridColumn: '1 / -1' }}>
                <h3><FileText size={18} style={{ verticalAlign: 'text-bottom', marginRight: 6 }} />Nova Transação</h3>
                <form onSubmit={handleSalvarTransacao}>
                  <label>Responsável</label>
                  <select value={pessoaId} onChange={e => setPessoaId(Number(e.target.value))}>
                    <option value={0}>Selecione responsável...</option>
                    {pessoas.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>

                  <label>Tipo de Transação</label>
                  <select value={tipo} onChange={e => setTipo(Number(e.target.value))}>
                    <option value={0}>Saída (Despesa)</option>
                    <option value={1} disabled={isMenorDeIdade}>Entrada (Receita)</option>
                  </select>
                  {isMenorDeIdade && (
                    <small className="aviso-menor">
                      {pessoaSelecionada?.nome} tem {pessoaSelecionada?.idade} anos — menores de 18 só podem registrar despesas.
                    </small>
                  )}

                  <label>Descrição / Categoria</label>
                  <select value={descricao} onChange={e => setDescricao(e.target.value)}>
                    <option value="">Selecione uma categoria...</option>
                    {(tipo === 0 ? listDespesas : listReceitas).map(op => <option key={op} value={op}>{op}</option>)}
                  </select>
                  {descricao === 'Outros' && <input placeholder="Especifique..." onChange={e => setOutraDescricao(e.target.value)} />}

                  <label>Valor (Utilize vírgula)</label>
                  <input value={valorInput} onChange={e => setValorInput(maskCurrency(e.target.value))} placeholder="Ex: 1500,50" />

                  <button type="submit" className="btn-primary">Salvar Transação</button>
                </form>
              </div>
            </>
          )}

          {page === 'manual' && (
            <div className="manual-container" style={{ gridColumn: '1 / -1' }}>

              <div className="card">
                <h3>1. Visão Geral</h3>
                <p>O <strong>Controle Financeiro Residencial</strong> é um sistema para gerenciar receitas, despesas e o saldo de cada integrante da residência, além de oferecer indicadores executivos, extratos detalhados e exportação de relatórios.</p>
                <p>O sistema é organizado em quatro módulos, acessíveis pelo menu lateral:</p>
                <ul>
                  <li><strong>Painel Geral</strong> — visão consolidada dos indicadores, resumo por integrante, alertas e últimas movimentações.</li>
                  <li><strong>Análise Gerencial</strong> — destaques, gráficos e exportação de relatório em Excel.</li>
                  <li><strong>Cadastro</strong> — cadastro de pessoas e registro de novas transações.</li>
                  <li><strong>Manual do Usuário</strong> — esta documentação.</li>
                </ul>
                <p><strong>Fluxo básico de uso:</strong> cadastre as pessoas da residência → registre as transações (receitas e despesas) → acompanhe os indicadores no Painel Geral → consulte extratos detalhados clicando nos cards ou no botão "Visualizar Extrato".</p>
              </div>

              <div className="card">
                <h3>2. Controle Financeiro</h3>
                <p>O controle financeiro é organizado em torno de dois cadastros principais:</p>
                <ul>
                  <li><strong>Pessoas:</strong> nome e idade de cada integrante da residência. É o cadastro base para vincular todas as transações.</li>
                  <li><strong>Transações:</strong> lançamentos de receita ou despesa, sempre vinculados a uma pessoa e a uma categoria (descrição).</li>
                </ul>
                <p>A partir desses cadastros, o sistema calcula automaticamente:</p>
                <ul>
                  <li><strong>Totalizadores:</strong> Receitas Acumuladas, Despesas Acumuladas e Saldo Líquido Geral, exibidos como cards no topo do Painel Geral.</li>
                  <li><strong>Saldo Geral:</strong> soma de todas as receitas menos todas as despesas da residência, considerando todo o histórico.</li>
                  <li><strong>Saldo do Período:</strong> exibido dentro de cada extrato, recalculado automaticamente conforme os filtros de data aplicados.</li>
                  <li><strong>Resumo por Integrante:</strong> tabela com receitas, despesas e saldo individual de cada pessoa cadastrada.</li>
                </ul>
                <p>Todos os valores são atualizados automaticamente após qualquer inclusão, edição ou exclusão de transação, sem necessidade de recarregar a página.</p>
              </div>

              <div className="card">
                <h3>3. Extrato Financeiro</h3>
                <p><strong>Como abrir o extrato:</strong></p>
                <ul>
                  <li>Clique em qualquer um dos cards <strong>Receitas Acumuladas</strong>, <strong>Despesas Acumuladas</strong> ou <strong>Saldo Líquido Geral</strong>, no Painel Geral, para abrir o extrato já filtrado pelo tipo correspondente.</li>
                  <li>Clique em <strong>Visualizar Extrato</strong>, na tabela Resumo por Integrante, para abrir o extrato de uma pessoa específica.</li>
                </ul>

                <p><strong>Regra do cabeçalho do extrato:</strong></p>
                <ul>
                  <li>Quando aberto a partir de <strong>Visualizar Extrato</strong> com uma pessoa selecionada, o cabeçalho exibe <em>"Extrato de [Nome da Pessoa]"</em>.</li>
                  <li>Se, dentro do próprio extrato, o filtro <strong>Pessoa</strong> for alterado para <em>"Todas as pessoas"</em>, o cabeçalho é atualizado automaticamente para <em>"Extrato Geral"</em>.</li>
                  <li>Se o usuário digitar um nome no campo de busca que corresponda a exatamente uma pessoa, o cabeçalho também passa a exibir o nome dessa pessoa.</li>
                  <li>Essa atualização ocorre em tempo real, sem necessidade de fechar e reabrir o extrato.</li>
                </ul>

                <p><strong>Dentro do extrato, é possível:</strong></p>
                <ul>
                  <li>Consultar entradas, saídas e saldo do período filtrado, exibidos no topo do painel.</li>
                  <li>Pesquisar por descrição ou nome do responsável.</li>
                  <li>Filtrar por período (data inicial e final), pessoa, tipo (receita/despesa) e categoria.</li>
                  <li>Ordenar os registros por data (mais recente/mais antiga) ou por valor (maior/menor).</li>
                  <li>Editar ou excluir qualquer movimentação diretamente na listagem.</li>
                  <li>Exportar o extrato filtrado em Excel ou PDF.</li>
                </ul>
              </div>

              <div className="card">
                <h3>4. Filtros</h3>
                <p>Todos os filtros do extrato podem ser combinados livremente entre si:</p>
                <ul>
                  <li><strong>Pessoa:</strong> restringe a listagem a um integrante específico, ou "Todas as pessoas" para o extrato consolidado.</li>
                  <li><strong>Categoria:</strong> filtra por uma descrição específica (ex.: "Salário", "Supermercado").</li>
                  <li><strong>Tipo:</strong> Receitas e Despesas, Somente Receitas ou Somente Despesas.</li>
                  <li><strong>Data Inicial / Data Final:</strong> restringe o período das movimentações exibidas.</li>
                  <li><strong>Pesquisa textual:</strong> busca por descrição ou nome do responsável, sem fechar o extrato ao ser apagada.</li>
                  <li><strong>Ordenação:</strong> mais recentes, mais antigas, maior valor ou menor valor.</li>
                </ul>
                <p>Os totalizadores exibidos no topo do extrato (entradas, saídas e saldo do período) são recalculados automaticamente conforme os filtros aplicados.</p>
              </div>

              <div className="card">
                <h3>5. Relatórios</h3>
                <p>O sistema oferece exportação em dois formatos, respeitando sempre os filtros aplicados no momento da exportação:</p>
                <ul>
                  <li><strong>Excel (.xlsx):</strong> disponível tanto dentro de qualquer extrato (aba única com os registros filtrados) quanto na Análise Gerencial (relatório completo com 4 abas: Resumo por Integrante, Indicadores Gerais, Evolução Mensal e Últimas Transações).</li>
                  <li><strong>PDF:</strong> disponível dentro de qualquer extrato, gerando um documento com os mesmos registros exibidos na tela no momento da exportação.</li>
                </ul>
              </div>

              <div className="card">
                <h3>6. Regras de Negócio</h3>
                <ul>
                  <li>Pessoas menores de 18 anos só podem registrar <strong>despesas</strong> — o sistema bloqueia a opção "Receita" automaticamente no formulário e valida essa regra também no back-end.</li>
                  <li>Ao excluir uma pessoa, todas as transações vinculadas a ela são removidas automaticamente.</li>
                  <li>O cabeçalho do extrato acompanha dinamicamente o filtro de Pessoa selecionado (via dropdown ou busca textual), sem manter informações de seleções anteriores que não representem o estado atual da tela.</li>
                  <li>Os totalizadores (Receitas, Despesas, Saldo Geral, Resumo por Integrante, Alertas Financeiros e Últimas Movimentações) são recalculados automaticamente sempre que houver inclusão, edição ou exclusão de transação.</li>
                  <li>Um integrante aparece na seção <strong>Alertas Financeiros</strong> sempre que seu saldo individual for negativo.</li>
                </ul>
              </div>

              <div className="card">
                <h3>7. Perguntas Frequentes (FAQ)</h3>

                <details className="faq-item">
                  <summary>Como cadastrar uma pessoa?</summary>
                  <p>Acesse <strong>Cadastro</strong> no menu lateral, preencha nome e idade no formulário "Cadastro de Pessoas" e clique em <strong>Cadastrar Pessoa</strong>.</p>
                </details>

                <details className="faq-item">
                  <summary>Como cadastrar uma receita ou despesa?</summary>
                  <p>Acesse <strong>Cadastro</strong>, preencha o formulário "Nova Transação" selecionando o responsável, o tipo (receita ou despesa), a categoria e o valor, e clique em <strong>Salvar Transação</strong>.</p>
                </details>

                <details className="faq-item">
                  <summary>Como editar um lançamento?</summary>
                  <p>Abra o extrato (pelo card correspondente ou por "Visualizar Extrato"), localize a movimentação na listagem e clique no ícone de lápis. Ajuste os campos e confirme clicando no ícone de check.</p>
                </details>

                <details className="faq-item">
                  <summary>Como excluir um lançamento?</summary>
                  <p>Dentro do extrato, clique no ícone de lixeira na linha da movimentação desejada e confirme a exclusão na mensagem exibida.</p>
                </details>

                <details className="faq-item">
                  <summary>Como utilizar os filtros do extrato?</summary>
                  <p>Dentro de qualquer extrato, use os campos de pesquisa, período, pessoa, tipo e categoria — todos podem ser combinados. Para voltar ao extrato consolidado, selecione "Todas as pessoas" no filtro de Pessoa.</p>
                </details>

                <details className="faq-item">
                  <summary>Como consultar os registros de uma pessoa específica?</summary>
                  <p>Na tabela "Resumo por Integrante", clique em <strong>Visualizar Extrato</strong> na linha da pessoa desejada.</p>
                </details>

                <details className="faq-item">
                  <summary>Como visualizar o extrato consolidado de todas as pessoas?</summary>
                  <p>Clique em qualquer um dos cards do topo (Receitas, Despesas ou Saldo Líquido Geral), ou, dentro de um extrato individual, selecione "Todas as pessoas" no filtro de Pessoa.</p>
                </details>

                <details className="faq-item">
                  <summary>Como exportar um relatório?</summary>
                  <p>Dentro de qualquer extrato, use os botões <strong>Excel</strong> ou <strong>PDF</strong> no topo da listagem. Para o relatório gerencial completo, acesse <strong>Análise Gerencial</strong> e clique em <strong>Baixar Relatório em Excel</strong>.</p>
                </details>
              </div>

              <div className="card">
                <h3>8. Melhorias de Usabilidade</h3>
                <ul>
                  <li>Interface com tema claro, cards com sombra suave e efeitos de hover, inspirada em dashboards modernos.</li>
                  <li>Atualização automática de todos os indicadores após qualquer alteração, sem necessidade de recarregar a página.</li>
                  <li>Cabeçalho do extrato dinâmico, sempre refletindo o filtro de Pessoa selecionado no momento.</li>
                  <li>Alertas financeiros automáticos para integrantes com saldo negativo.</li>
                  <li>Filtros combináveis e persistentes durante a navegação dentro do mesmo extrato aberto.</li>
                  <li>Exportação de relatórios em Excel e PDF disponível em múltiplos pontos do sistema.</li>
                </ul>
              </div>

            </div>
          )}
        </div>
      </main>

      <ExtratoDrawer
        key={`${drawer.titulo}-${drawer.filtroPessoaInicial}-${drawer.filtroTipoInicial}`}
        aberto={drawer.aberto}
        onFechar={fecharDrawer}
        titulo={drawer.titulo}
        modoPessoa={drawer.modoPessoa}
        transacoes={transacoes}
        pessoas={pessoas}
        mostrarColunaSaldo={drawer.mostrarSaldo}
        filtroTipoInicial={drawer.filtroTipoInicial}
        filtroPessoaInicial={drawer.filtroPessoaInicial}
        onEditar={handleEditarTransacao}
        onExcluir={handleExcluirTransacao}
      />
    </div>
  );
}

export default App;