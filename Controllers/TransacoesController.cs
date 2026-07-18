using GastosResidenciais.Api.Data;
using GastosResidenciais.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace GastosResidenciais.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class TransacoesController : ControllerBase
    {
        private readonly AppDbContext _context;
        public TransacoesController(AppDbContext context) => _context = context;

        // GET: api/transacoes
        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var transacoes = await _context.Transacoes
                .Include(t => t.Pessoa)
                .OrderByDescending(t => t.Data)
                .ToListAsync();

            return Ok(transacoes);
        }

        // POST: api/transacoes
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] Transacao transacao)
        {
            // A pessoa informada precisa existir no cadastro
            var pessoa = await _context.Pessoas.FindAsync(transacao.PessoaId);
            if (pessoa == null)
                return BadRequest(new { mensagem = "Pessoa não encontrada. Verifique o responsável selecionado." });

            // Regra de negócio: menores de 18 anos só podem registrar despesas
            if (pessoa.Idade < 18 && transacao.Tipo == TipoTransacao.Receita)
                return BadRequest(new { mensagem = $"{pessoa.Nome} tem {pessoa.Idade} anos. Menores de 18 anos só podem registrar despesas." });

            if (transacao.Data == default)
                transacao.Data = DateTime.Now;

            _context.Transacoes.Add(transacao);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetAll), new { id = transacao.Id }, new
            {
                transacao.Id,
                transacao.Descricao,
                transacao.Valor,
                transacao.Tipo,
                transacao.Data,
                transacao.PessoaId
            });
        }

        // PUT: api/transacoes/{id}
        // Permite editar uma movimentação existente, reaplicando a mesma regra
        // de negócio de menor de idade só poder registrar despesas.
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] Transacao input)
        {
            var transacao = await _context.Transacoes.FindAsync(id);
            if (transacao == null)
                return NotFound(new { mensagem = "Movimentação não encontrada." });

            var pessoa = await _context.Pessoas.FindAsync(input.PessoaId);
            if (pessoa == null)
                return BadRequest(new { mensagem = "Pessoa não encontrada. Verifique o responsável selecionado." });

            if (pessoa.Idade < 18 && input.Tipo == TipoTransacao.Receita)
                return BadRequest(new { mensagem = $"{pessoa.Nome} tem {pessoa.Idade} anos. Menores de 18 anos só podem registrar despesas." });

            transacao.Descricao = input.Descricao;
            transacao.Valor = input.Valor;
            transacao.Tipo = input.Tipo;
            transacao.Data = input.Data == default ? transacao.Data : input.Data;
            transacao.PessoaId = input.PessoaId;

            await _context.SaveChangesAsync();

            return Ok(new
            {
                transacao.Id,
                transacao.Descricao,
                transacao.Valor,
                transacao.Tipo,
                transacao.Data,
                transacao.PessoaId
            });
        }

        // DELETE: api/transacoes/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var transacao = await _context.Transacoes.FindAsync(id);
            if (transacao == null)
                return NotFound(new { mensagem = "Movimentação não encontrada." });

            _context.Transacoes.Remove(transacao);
            await _context.SaveChangesAsync();

            return NoContent();
        }
    }
}