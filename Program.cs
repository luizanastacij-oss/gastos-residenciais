using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using GastosResidenciais.Api.Data;

var builder = WebApplication.CreateBuilder(args);

// CORS liberado para o front-end acessar a API durante o desenvolvimento
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy => policy.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader());
});

// Serializa o JSON em camelCase (padrão esperado pelo front em React)
builder.Services.AddControllers().AddJsonOptions(options =>
{
    options.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
    options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
});

// Registro do EF Core com SQLite — os dados persistem em arquivo local (gastos.db)
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection")));

var app = builder.Build();

app.UseCors("AllowAll");
app.UseAuthorization();
app.MapControllers();

app.Run();