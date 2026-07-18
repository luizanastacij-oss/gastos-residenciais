import { useEffect, useMemo, useState } from 'react';
import { X, Download, FileSpreadsheet, Pencil, Trash2, Check, XCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface TransacaoComSaldo {
  id: number;
  descricao: string;
  valor: number;
  tipo: number; // 0 = Despesa, 1 = Receita
  data: string;
  pessoaId: number;
  pessoa?: { id: number; nome: string; idade: number } | null;
  saldoAcumulado?: number;
}

interface Pessoa { id: number; nome: string; idade: number; }

interface Props {
  aberto: boolean;
  onFechar: () => void;
  titulo: string;
  modoPessoa?: boolean;
  transacoes: TransacaoComSaldo[];
  pessoas: Pessoa[];
  mostrarColunaSaldo?: boolean;
  filtroTipoInicial?: number | 'todos';
  filtroPessoaInicial?: number | 'todos';
  onEditar: (id: number, dados: { descricao: string; valor: number; tipo: number; data: string; pessoaId: number }) => Promise<boolean>;
  onExcluir: (id: number) => Promise<boolean>;
}

const formatarBRL = (valor: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);

const formatarData = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');
const paraInputDate = (iso: string) => new Date(iso).toISOString().slice(0, 10);

export default function ExtratoDrawer({
  aberto, onFechar, titulo, modoPessoa = false,
  transacoes, pessoas,
  mostrarColunaSaldo = false,
  filtroTipoInicial = 'todos',
  filtroPessoaInicial = 'todos',
  onEditar, onExcluir,
}: Props) {
  const [busca, setBusca] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [filtroPessoa, setFiltroPessoa] = useState<number | 'todos'>(filtroPessoaInicial);
  const [filtroTipo, setFiltroTipo] = useState<number | 'todos'>(filtroTipoInicial);
  const [filtroCategoria, setFiltroCategoria] = useState('todas');
  const [ordenacao, setOrdenacao] = useState<'data-desc' | 'data-asc' | 'valor-desc' | 'valor-asc'>('data-desc');

  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [editDescricao, setEditDescricao] = useState('');
  const [editValor, setEditValor] = useState('');
  const [editTipo, setEditTipo] = useState(0);
  const [editData, setEditData] = useState('');
  const [editPessoaId, setEditPessoaId] = useState(0);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    setFiltroPessoa(filtroPessoaInicial);
    setFiltroTipo(filtroTipoInicial);
    setEditandoId(null);
  }, [filtroPessoaInicial, filtroTipoInicial, aberto]);

  // Quando o filtro dropdown de Pessoa está em "todos" mas o usuário digitou
  // um nome no campo de busca que corresponde a exatamente uma pessoa,
  // consideramos essa pessoa como "selecionada via pesquisa" para fins de
  // cabeçalho. Se o texto não bater com ninguém, bater com mais de uma
  // pessoa, ou estiver vazio, isso não afeta o título (volta a "Extrato Geral").
  const pessoaViaBusca = useMemo(() => {
    if (!modoPessoa) return null;
    if (filtroPessoa !== 'todos') return null; // o dropdown, quando usado, tem prioridade
    const termo = busca.trim().toLowerCase();
    if (!termo) return null;
    const encontradas = pessoas.filter(p => p.nome.toLowerCase().includes(termo));
    return encontradas.length === 1 ? encontradas[0] : null;
  }, [modoPessoa, filtroPessoa, busca, pessoas]);

  // Título exibido: no modo pessoa, reflete em tempo real o filtro de Pessoa
  // (dropdown) ou, na ausência dele, o nome encontrado via busca textual —
  // nunca "gruda" no nome anterior nem permanece em "Extrato Geral" quando
  // uma pessoa é identificada pela pesquisa.
  const tituloExibido = useMemo(() => {
    if (!modoPessoa) return titulo;

    if (filtroPessoa !== 'todos') {
      const pessoa = pessoas.find(p => p.id === filtroPessoa);
      return pessoa ? `Extrato de ${pessoa.nome}` : 'Extrato Geral';
    }

    if (pessoaViaBusca) return `Extrato de ${pessoaViaBusca.nome}`;

    return 'Extrato Geral';
  }, [modoPessoa, titulo, filtroPessoa, pessoas, pessoaViaBusca]);

  const categorias = useMemo(
    () => Array.from(new Set(transacoes.map(t => t.descricao))).sort(),
    [transacoes]
  );

  const filtradas = useMemo(() => {
    let lista = [...transacoes];

    if (busca.trim()) {
      const termo = busca.trim().toLowerCase();
      lista = lista.filter(t =>
        t.descricao.toLowerCase().includes(termo) ||
        (t.pessoa?.nome ?? '').toLowerCase().includes(termo)
      );
    }

    if (dataInicio) lista = lista.filter(t => new Date(t.data) >= new Date(dataInicio));
    if (dataFim) lista = lista.filter(t => new Date(t.data) <= new Date(dataFim + 'T23:59:59'));

    if (filtroPessoa !== 'todos') lista = lista.filter(t => t.pessoaId === filtroPessoa);
    if (filtroTipo !== 'todos') lista = lista.filter(t => t.tipo === filtroTipo);
    if (filtroCategoria !== 'todas') lista = lista.filter(t => t.descricao === filtroCategoria);

    lista.sort((a, b) => {
      if (ordenacao === 'data-desc') return new Date(b.data).getTime() - new Date(a.data).getTime();
      if (ordenacao === 'data-asc') return new Date(a.data).getTime() - new Date(b.data).getTime();
      if (ordenacao === 'valor-desc') return b.valor - a.valor;
      return a.valor - b.valor;
    });

    return lista;
  }, [transacoes, busca, dataInicio, dataFim, filtroPessoa, filtroTipo, filtroCategoria, ordenacao]);

  const totalEntradas = filtradas.filter(t => t.tipo === 1).reduce((s, t) => s + t.valor, 0);
  const totalSaidas = filtradas.filter(t => t.tipo === 0).reduce((s, t) => s + t.valor, 0);

  const exportarExcel = () => {
    const linhas = filtradas.map(t => ({
      Data: formatarData(t.data),
      Pessoa: t.pessoa?.nome ?? '—',
      Tipo: t.tipo === 1 ? 'Receita' : 'Despesa',
      Categoria: t.descricao,
      Valor: t.valor,
      ...(mostrarColunaSaldo ? { 'Saldo Acumulado': t.saldoAcumulado ?? 0 } : {})
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(linhas), 'Extrato');
    XLSX.writeFile(wb, `${tituloExibido.toLowerCase().replace(/\s+/g, '-')}.xlsx`);
  };

  const exportarPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text(tituloExibido, 14, 16);
    autoTable(doc, {
      startY: 22,
      head: [['Data', 'Pessoa', 'Tipo', 'Categoria', 'Valor', ...(mostrarColunaSaldo ? ['Saldo'] : [])]],
      body: filtradas.map(t => [
        formatarData(t.data),
        t.pessoa?.nome ?? '—',
        t.tipo === 1 ? 'Receita' : 'Despesa',
        t.descricao,
        formatarBRL(t.valor),
        ...(mostrarColunaSaldo ? [formatarBRL(t.saldoAcumulado ?? 0)] : [])
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [79, 70, 229] },
    });
    doc.save(`${tituloExibido.toLowerCase().replace(/\s+/g, '-')}.pdf`);
  };

  const iniciarEdicao = (t: TransacaoComSaldo) => {
    setEditandoId(t.id);
    setEditDescricao(t.descricao);
    setEditValor(String(t.valor.toFixed(2)).replace('.', ','));
    setEditTipo(t.tipo);
    setEditData(paraInputDate(t.data));
    setEditPessoaId(t.pessoaId);
  };

  const cancelarEdicao = () => setEditandoId(null);

  const salvarEdicao = async (id: number) => {
    const valorNumerico = Number(editValor.replace(/\./g, '').replace(',', '.'));
    if (!editDescricao.trim() || !valorNumerico || !editPessoaId) {
      alert('Preencha descrição, valor e responsável.');
      return;
    }
    setSalvando(true);
    const ok = await onEditar(id, {
      descricao: editDescricao,
      valor: valorNumerico,
      tipo: editTipo,
      data: editData,
      pessoaId: editPessoaId,
    });
    setSalvando(false);
    if (ok) setEditandoId(null);
  };

  const excluir = async (id: number) => {
    if (!confirm('Deseja realmente excluir esta movimentação?')) return;
    await onExcluir(id);
  };

  if (!aberto) return null;

  return (
    <div className="drawer-overlay" onClick={onFechar}>
      <div className="drawer-painel" onClick={e => e.stopPropagation()}>
        <div className="drawer-header">
          <h3>{tituloExibido}</h3>
          <button className="drawer-fechar" onClick={onFechar}><X size={20} /></button>
        </div>

        <div className="drawer-resumo">
          <div><span className="drawer-resumo-label">Entradas</span><span className="text-success">{formatarBRL(totalEntradas)}</span></div>
          <div><span className="drawer-resumo-label">Saídas</span><span className="text-danger">{formatarBRL(totalSaidas)}</span></div>
          <div><span className="drawer-resumo-label">Saldo do período</span><span className={totalEntradas - totalSaidas >= 0 ? 'text-success' : 'text-danger'}>{formatarBRL(totalEntradas - totalSaidas)}</span></div>
        </div>

        <div className="drawer-filtros">
          <input
            placeholder="Buscar por descrição ou responsável..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
          <div className="drawer-filtros-linha">
            <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
            <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} />
          </div>
          <div className="drawer-filtros-linha">
            <select value={filtroPessoa} onChange={e => setFiltroPessoa(e.target.value === 'todos' ? 'todos' : Number(e.target.value))}>
              <option value="todos">Todas as pessoas</option>
              {pessoas.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
            <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value === 'todos' ? 'todos' : Number(e.target.value))}>
              <option value="todos">Receitas e Despesas</option>
              <option value={1}>Somente Receitas</option>
              <option value={0}>Somente Despesas</option>
            </select>
          </div>
          <div className="drawer-filtros-linha">
            <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)}>
              <option value="todas">Todas as categorias</option>
              {categorias.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={ordenacao} onChange={e => setOrdenacao(e.target.value as any)}>
              <option value="data-desc">Mais recentes</option>
              <option value="data-asc">Mais antigas</option>
              <option value="valor-desc">Maior valor</option>
              <option value="valor-asc">Menor valor</option>
            </select>
          </div>
        </div>

        <div className="drawer-export">
          <button className="btn-secondary" onClick={exportarExcel}><FileSpreadsheet size={16} /> Excel</button>
          <button className="btn-secondary" onClick={exportarPDF}><Download size={16} /> PDF</button>
        </div>

        <div className="drawer-tabela-wrapper">
          <table className="tabela-extrato">
            <thead>
              <tr>
                <th>Data</th>
                <th>Pessoa</th>
                <th>Categoria</th>
                <th>Tipo</th>
                <th>Valor</th>
                {mostrarColunaSaldo && <th>Saldo</th>}
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.length === 0 && (
                <tr><td colSpan={mostrarColunaSaldo ? 7 : 6} className="drawer-vazio">Nenhuma movimentação encontrada para os filtros selecionados.</td></tr>
              )}

              {filtradas.map(t => {
                const emEdicao = editandoId === t.id;

                if (emEdicao) {
                  return (
                    <tr key={t.id} className="linha-edicao">
                      <td><input type="date" value={editData} onChange={e => setEditData(e.target.value)} /></td>
                      <td>
                        <select value={editPessoaId} onChange={e => setEditPessoaId(Number(e.target.value))}>
                          {pessoas.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                        </select>
                      </td>
                      <td><input value={editDescricao} onChange={e => setEditDescricao(e.target.value)} /></td>
                      <td>
                        <select value={editTipo} onChange={e => setEditTipo(Number(e.target.value))}>
                          <option value={0}>Despesa</option>
                          <option value={1}>Receita</option>
                        </select>
                      </td>
                      <td><input value={editValor} onChange={e => setEditValor(e.target.value)} placeholder="0,00" /></td>
                      {mostrarColunaSaldo && <td>—</td>}
                      <td>
                        <div className="acoes-linha">
                          <button className="btn-icone btn-icone-success" disabled={salvando} onClick={() => salvarEdicao(t.id)}><Check size={16} /></button>
                          <button className="btn-icone" disabled={salvando} onClick={cancelarEdicao}><XCircle size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={t.id}>
                    <td>{formatarData(t.data)}</td>
                    <td>{t.pessoa?.nome ?? '—'}</td>
                    <td>{t.descricao}</td>
                    <td><span className={`chip ${t.tipo === 1 ? 'chip-success' : 'chip-danger'}`}>{t.tipo === 1 ? 'Receita' : 'Despesa'}</span></td>
                    <td className={t.tipo === 1 ? 'text-success' : 'text-danger'}>{t.tipo === 1 ? '+' : '-'}{formatarBRL(t.valor)}</td>
                    {mostrarColunaSaldo && <td>{formatarBRL(t.saldoAcumulado ?? 0)}</td>}
                    <td>
                      <div className="acoes-linha">
                        <button className="btn-icone" title="Editar" onClick={() => iniciarEdicao(t)}><Pencil size={15} /></button>
                        <button className="btn-icone btn-icone-danger" title="Excluir" onClick={() => excluir(t.id)}><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}