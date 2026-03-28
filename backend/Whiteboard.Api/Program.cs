using Whiteboard.Api.Hubs;
using Whiteboard.Api.Services;

var builder = WebApplication.CreateBuilder(args);

const string CorsPolicyName = "Frontend";
var allowedOrigins = GetAllowedOrigins(builder.Configuration);

builder.Services.Configure<CodeRunnerOptions>(builder.Configuration.GetSection("CodeRunner"));
builder.Services.AddControllers();
builder.Services.AddSignalR();
builder.Services.AddSingleton<IWhiteboardRoomStore, InMemoryWhiteboardRoomStore>();
builder.Services.AddHttpClient<ICodeExecutionService, RemoteCodeExecutionService>();
builder.Services.AddCors(options =>
{
    options.AddPolicy(
        CorsPolicyName,
        policy =>
        {
            policy
                .WithOrigins(allowedOrigins)
                .AllowAnyHeader()
                .AllowAnyMethod()
                .AllowCredentials();
        });
});

var app = builder.Build();

app.UseCors(CorsPolicyName);
app.UseAuthorization();

app.MapGet("/health", () => Results.Ok(new { status = "ok", timestamp = DateTimeOffset.UtcNow }));
app.MapControllers();
app.MapHub<WhiteboardHub>("/hubs/whiteboard");

app.Run();

static string[] GetAllowedOrigins(IConfiguration configuration)
{
    var configuredOrigins = configuration["FRONTEND_ORIGINS"];

    if (string.IsNullOrWhiteSpace(configuredOrigins))
    {
        return
        [
            "http://localhost:5173",
            "https://localhost:5173",
            "http://127.0.0.1:5173",
            "https://127.0.0.1:5173"
        ];
    }

    return configuredOrigins
        .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
        .Distinct(StringComparer.OrdinalIgnoreCase)
        .ToArray();
}
