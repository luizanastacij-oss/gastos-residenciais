namespace GastosResidenciais.Api.Models
{
    public enum TipoTransacao { Despesa, Receita }

    public class Transacao
    {
        public int Id { get; set; }
        public string Descricao { get; set; } = string.Empty;
        public decimal Valor { get; set; }
        public TipoTransacao Tipo { get; set; }
        public DateTime Data { get; set; } = DateTime.Now;
        public int PessoaId { get; set; }
        public Pessoa? Pessoa { get; set; }
    }
}