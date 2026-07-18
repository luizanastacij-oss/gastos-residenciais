import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import './App.css';

// 1. A Interface que protege o código contra erros do TypeScript
interface DashboardData {
  kpis?: {
    receita?: { valor: number };
    despesa?: { valor: number };
    saldoGeral?: number;
  };
  graficos?: {
    mensal?: { mes: string; receita: number; despesa: number }[];
  };
  timeline?: { descricao: string; valor: number; tipo: number; data: string; nome: string }[];
}

const formatarBRL = (valor?: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);

const maskCurrency = (value: string) => {
  const digits = value.replace(/\D/g, "");
  return formatarBRL(Number(digits) / 100);
};

const capitalize = (str: string) => str.replace(/\b\w/g, char => char.toUpperCase());

const API_URL = 'http://localhost:5167/api';

function App() {
  const [page, setPage] = useState('dashboard');
  const [data, setData] = useState<DashboardData | null>(null);
  const [pessoas, setPessoas] = useState<any[]>([]);
  
  // Estados do Formulário de Transações
  const [valorInput, setValorInput] = useState('');
  const [tipo, setTipo] = useState(0);
  const [pessoaId, setPessoaId] = useState(0);
  const [descricao, setDescricao] = useState('');
  const [outraDescricao, setOutraDescricao] = useState('');

  // Estados do Formulário de Pessoas
  const [nome, setNome] = useState('');
  const [idade, setIdade] = useState('');

  const [listDespesas] = useState(['Conta de Luz', 'Água', 'Supermercado', 'Aluguel', 'Internet', 'Outros']);
  const [listReceitas] = useState(['Salário', 'Vendas', 'Investimentos', 'Freelance', 'Outros']);

  const carregarDados = async () => {
    try {
      const [resT, resP] = await Promise.all([
        fetch(`${API_URL}/totais`),
        fetch(`${API_URL}/pessoas`)
      ]);
      const jsonT = await resT.json();
      const jsonP = await resP.json();
      
      setData(jsonT as DashboardData);
      setPessoas(jsonP || []);
    } catch (err) {
      console.error("Erro na API:", err);
    }
  };

  useEffect(() => { carregarDados(); }, []);

  const handleSalvarTransacao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pessoaId === 0) { alert("Selecione um responsável!"); return; }

    const valorPuro = Number(valorInput.replace(/\D/g, "")) / 100;
    const descFinal = descricao === 'Outros' ? outraDescricao : descricao;
    
    await fetch(`${API_URL}/transacoes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ descricao: descFinal, valor: valorPuro, tipo, pessoaId })
    });
    
    setValorInput(''); setDescricao(''); setOutraDescricao('');
    alert("Transação registrada!");
    carregarDados();
  };

  const handleSalvarPessoa = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch(`${API_URL}/pessoas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, idade: Number(idade) })
    });
    setNome(''); setIdade('');
    alert('Membro cadastrado!');
    carregarDados();
  };

  // Trava de segurança: Tela de carregamento
  if (!data) return <div style={{ color: 'white', padding: '40px', fontSize: '20px' }}>Conectando ao sistema financeiro...</div>;

  return (
    <div className="app-wrapper">
      
      <aside className="sidebar">
        <div className="sidebar-logo">FinFamily</div>
        <div className={`nav-item ${page === 'dashboard' ? 'active' : ''}`} onClick={() => setPage('dashboard')}>📊 Dashboard</div>
        <div className={`nav-item ${page === 'pessoas' ? 'active' : ''}`} onClick={() => setPage('pessoas')}>👥 Membros</div>
        <div className={`nav-item ${page === 'transacoes' ? 'active' : ''}`} onClick={() => setPage('transacoes')}>💰 Lançamentos</div>
      </aside>

      <main className="main-body">
        <header className="topbar">
          <div>
            <h2>Olá, Morador 👋</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>Visão Geral da Casa</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase' }}>Saldo Atual</span>
            <div className="kpi-value text-primary" style={{ margin: 0 }}>{formatarBRL(data.kpis?.saldoGeral)}</div>
          </div>
        </header>

        <div className="dashboard-content">
          
          {page === 'dashboard' && (
            <>
              <div className="card">
                <div className="kpi-label">Receitas do Mês</div>
                <div className="kpi-value text-success">{formatarBRL(data.kpis?.receita?.valor)}</div>
              </div>
              
              <div className="card">
                <div className="kpi-label">Despesas do Mês</div>
                <div className="kpi-value text-danger">{formatarBRL(data.kpis?.despesa?.valor)}</div>
              </div>
              
              <div className="card" style={{ gridColumn: '1 / -1' }}>
                <h3>Evolução Mensal (Receitas x Despesas)</h3>
                <div style={{ height: '300px', marginTop: '20px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={(data.graficos?.mensal || []) as any[]}>
                      <XAxis dataKey="mes" stroke="#94a3b8" />
                      <Tooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '8px' }} />
                      <Bar dataKey="receita" fill="#10b981" radius={[4, 4, 0, 0]} name="Receita" />
                      <Bar dataKey="despesa" fill="#ef4444" radius={[4, 4, 0, 0]} name="Despesa" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="card" style={{ gridColumn: '1 / -1' }}>
                <h3>Últimas Movimentações</h3>
                <div style={{ marginTop: '15px' }}>
                  {(data.timeline || []).length === 0 ? <p style={{ color: 'var(--text-muted)' }}>Nenhuma transação registrada ainda.</p> : null}
                  {(data.timeline || []).map((t: any, i: number) => (
                    <div key={i} className="timeline-item">
                      <div>
                        <strong style={{ display: 'block', fontSize: '16px' }}>{t.descricao}</strong>
                        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{t.nome} • {new Date(t.data).toLocaleDateString('pt-BR')}</span>
                      </div>
                      <div className={t.tipo === 1 ? 'text-success' : 'text-danger'} style={{ fontSize: '18px', fontWeight: 'bold' }}>
                        {t.tipo === 1 ? '+' : '-'}{formatarBRL(t.valor)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {page === 'pessoas' && (
            <div className="card" style={{ maxWidth: '600px' }}>
              <h2>Cadastrar Novo Membro</h2>
              <form onSubmit={handleSalvarPessoa}>
                <input type="text" placeholder="Nome Completo" value={nome} onChange={e => setNome(capitalize(e.target.value))} required />
                <input type="number" placeholder="Idade" value={idade} onChange={e => setIdade(e.target.value)} required />
                <button type="submit" className="btn-primary">Cadastrar Morador</button>
              </form>
              
              <h3 style={{ marginTop: '40px', marginBottom: '15px' }}>Membros Atuais</h3>
              {pessoas.map(p => (
                <div key={p.id} style={{ padding: '15px', background: 'var(--bg-dark)', borderRadius: '8px', marginBottom: '10px' }}>
                  <strong>{p.nome}</strong> - {p.idade} anos
                </div>
              ))}
            </div>
          )}

          {page === 'transacoes' && (
            <div className="card" style={{ maxWidth: '800px' }}>
              <h2>Registrar Nova Transação</h2>
              <form onSubmit={handleSalvarTransacao}>
                <select value={pessoaId} onChange={e => setPessoaId(Number(e.target.value))} required>
                    <option value={0}>Selecione o responsável...</option>
                    {pessoas.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
                
                <select value={tipo} onChange={e => { setTipo(Number(e.target.value)); setDescricao(''); setOutraDescricao(''); }}>
                    <option value={0}>Despesa (Saída de dinheiro)</option>
                    <option value={1}>Receita (Entrada de dinheiro)</option>
                </select>
                
                <select value={descricao} onChange={e => { setDescricao(e.target.value); setOutraDescricao(''); }} required>
                    <option value="">Selecione a categoria...</option>
                    {(tipo === 0 ? listDespesas : listReceitas).map(op => <option key={op} value={op}>{op}</option>)}
                </select>
                
                {descricao === 'Outros' && (
                  <input placeholder="Digite o nome da categoria..." value={outraDescricao} onChange={e => setOutraDescricao(capitalize(e.target.value))} required />
                )}
                
                <input value={valorInput} onChange={e => setValorInput(maskCurrency(e.target.value))} placeholder="R$ 0,00" required style={{ fontSize: '20px', padding: '15px' }} />
                
                <button type="submit" className="btn-primary" style={{ padding: '15px', fontSize: '16px' }}>Salvar Lançamento</button>
              </form>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;