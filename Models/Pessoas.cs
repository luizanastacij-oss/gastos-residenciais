namespace GastosResidenciais.Api.Models
{
    public class Pessoa
    {
        public int Id { get; set; }
        public string Nome { get; set; } = string.Empty;
        public int Idade { get; set; }
        public List<Transacao> Transacoes { get; set; } = new();
    }
}