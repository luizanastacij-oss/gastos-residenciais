using GastosResidenciais.Api.Data;
using GastosResidenciais.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace GastosResidenciais.Api.Controllers
{
    /// <summary>
    /// Responsável por consolidar os dados financeiros de todas as pessoas cadastradas:
    /// KPIs gerais, resumo por pessoa, gráficos e destaques gerenciais.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    public class TotaisController : ControllerBase
    {
        private readonly AppDbContext _context;
        public TotaisController(AppDbContext context) => _context = context;

        // GET: api/totais
        [HttpGet]
        public async Task<IActionResult> GetDashboard()
        {
            var agora = DateTime.Now;
            var inicioMesAtual = new DateTime(agora.Year, agora.Month, 1);
            var inicioMesAnterior = inicioMesAtual.AddMonths(-1);

            // Carrega todas as pessoas já com suas transações (evita N+1 queries)
            var pessoas = await _context.Pessoas.Include(p => p.Transacoes).ToListAsync();
            var todasTransacoes = pessoas.SelectMany(p => p.Transacoes).ToList();

            // --- KPIs do mês atual, com tendência comparada ao mês anterior ---
            var receitasMes = todasTransacoes
                .Where(t => t.Tipo == TipoTransacao.Receita && t.Data >= inicioMesAtual)
                .Sum(t => t.Valor);
            var receitasMesAnterior = todasTransacoes
                .Where(t => t.Tipo == TipoTransacao.Receita && t.Data >= inicioMesAnterior && t.Data < inicioMesAtual)
                .Sum(t => t.Valor);

            var despesasMes = todasTransacoes
                .Where(t => t.Tipo == TipoTransacao.Despesa && t.Data >= inicioMesAtual)
                .Sum(t => t.Valor);
            var despesasMesAnterior = todasTransacoes
                .Where(t => t.Tipo == TipoTransacao.Despesa && t.Data >= inicioMesAnterior && t.Data < inicioMesAtual)
                .Sum(t => t.Valor);

            // --- Gráfico: Despesas agrupadas por categoria (descrição) ---
            var despesasPorCategoria = todasTransacoes
                .Where(t => t.Tipo == TipoTransacao.Despesa)
                .GroupBy(t => t.Descricao)
                .Select(g => new { name = g.Key, valor = g.Sum(t => t.Valor) })
                .OrderByDescending(x => x.valor)
                .ToList();

            // --- Gráfico: Evolução dos últimos 6 meses (receita x despesa) ---
            var evolucaoMensal = Enumerable.Range(0, 6).Reverse().Select(i =>
            {
                var mes = inicioMesAtual.AddMonths(-i);
                return new
                {
                    mes = mes.ToString("MMM"),
                    receita = todasTransacoes
                        .Where(t => t.Tipo == TipoTransacao.Receita && t.Data.Month == mes.Month && t.Data.Year == mes.Year)
                        .Sum(t => t.Valor),
                    despesa = todasTransacoes
                        .Where(t => t.Tipo == TipoTransacao.Despesa && t.Data.Month == mes.Month && t.Data.Year == mes.Year)
                        .Sum(t => t.Valor)
                };
            }).ToList();

            // --- Destaques gerenciais: maior receita/despesa individual e membro com maior saldo ---
            var maiorReceita = todasTransacoes
                .Where(t => t.Tipo == TipoTransacao.Receita)
                .OrderByDescending(t => t.Valor)
                .FirstOrDefault();
            var maiorDespesa = todasTransacoes
                .Where(t => t.Tipo == TipoTransacao.Despesa)
                .OrderByDescending(t => t.Valor)
                .FirstOrDefault();

            // --- Resumo por pessoa: total de receitas, despesas e saldo individual ---
            var resumoPessoas = pessoas.Select(p => new
            {
                p.Id,
                p.Nome,
                p.Idade,
                Receitas = p.Transacoes.Where(t => t.Tipo == TipoTransacao.Receita).Sum(t => t.Valor),
                Despesas = p.Transacoes.Where(t => t.Tipo == TipoTransacao.Despesa).Sum(t => t.Valor),
                Saldo = p.Transacoes.Where(t => t.Tipo == TipoTransacao.Receita).Sum(t => t.Valor)
                      - p.Transacoes.Where(t => t.Tipo == TipoTransacao.Despesa).Sum(t => t.Valor)
            }).ToList();

            return Ok(new
            {
                kpis = new
                {
                    receita = new { valor = receitasMes, tendencia = CalcularTendencia(receitasMes, receitasMesAnterior) },
                    despesa = new { valor = despesasMes, tendencia = CalcularTendencia(despesasMes, despesasMesAnterior) },
                    // Saldo geral considera o histórico completo, não só o mês atual
                    saldoGeral = todasTransacoes.Where(t => t.Tipo == TipoTransacao.Receita).Sum(t => t.Valor)
                               - todasTransacoes.Where(t => t.Tipo == TipoTransacao.Despesa).Sum(t => t.Valor)
                },
                graficos = new
                {
                    categorias = despesasPorCategoria,
                    mensal = evolucaoMensal
                },
                stats = new
                {
                    maiorReceita = maiorReceita != null ? new { nome = maiorReceita.Pessoa?.Nome, valor = maiorReceita.Valor } : null,
                    maiorDespesa = maiorDespesa != null ? new { nome = maiorDespesa.Pessoa?.Nome, valor = maiorDespesa.Valor } : null,
                    topMembro = resumoPessoas.OrderByDescending(r => r.Saldo).FirstOrDefault()?.Nome
                },
                // Últimas 5 transações registradas, para a timeline de atividade recente
                timeline = todasTransacoes
                    .OrderByDescending(t => t.Data)
                    .Take(5)
                    .Select(t => new { t.Descricao, t.Valor, t.Tipo, t.Data, nome = t.Pessoa?.Nome }),
                membros = resumoPessoas
            });
        }

        /// <summary>
        /// Calcula a variação percentual entre o valor atual e o valor do período anterior.
        /// Retorna 0 quando não há base de comparação (evita divisão por zero).
        /// </summary>
        private double CalcularTendencia(decimal atual, decimal anterior)
        {
            if (anterior == 0) return 0;
            return (double)((atual - anterior) / anterior) * 100;
        }
    }
}