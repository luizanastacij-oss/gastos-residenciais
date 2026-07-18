using GastosResidenciais.Api.Data;
using GastosResidenciais.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace GastosResidenciais.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class PessoasController : ControllerBase
    {
        private readonly AppDbContext _context;
        public PessoasController(AppDbContext context) => _context = context;

        // GET: api/pessoas
        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var pessoas = await _context.Pessoas.OrderBy(p => p.Nome).ToListAsync();
            return Ok(pessoas);
        }

        // POST: api/pessoas
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] Pessoa pessoa)
        {
            if (string.IsNullOrWhiteSpace(pessoa.Nome))
                return BadRequest(new { mensagem = "O nome é obrigatório." });

            if (pessoa.Idade < 0)
                return BadRequest(new { mensagem = "Idade inválida." });

            _context.Pessoas.Add(pessoa);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetAll), new { id = pessoa.Id }, pessoa);
        }

        // DELETE: api/pessoas/{id}
        // Ao excluir a pessoa, o cascade delete configurado no AppDbContext
        // remove automaticamente todas as transações vinculadas a ela.
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var pessoa = await _context.Pessoas.FindAsync(id);
            if (pessoa == null)
                return NotFound(new { mensagem = "Pessoa não encontrada." });

            _context.Pessoas.Remove(pessoa);
            await _context.SaveChangesAsync();

            return NoContent();
        }
    }
}