using CodeRunner.Service.Contracts;
using CodeRunner.Service.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.Configure<DockerRunnerOptions>(builder.Configuration.GetSection("DockerRunner"));
builder.Services.AddSingleton<ICodeExecutionService, CodeExecutionService>();
builder.Services.AddSingleton<ICodeExecutionAdapter, JavaScriptExecutionAdapter>();
builder.Services.AddSingleton<ICodeExecutionAdapter, PythonExecutionAdapter>();
builder.Services.AddSingleton<ICodeExecutionAdapter, JavaExecutionAdapter>();
builder.Services.AddSingleton<ICodeExecutionAdapter, CppExecutionAdapter>();
builder.Services.AddSingleton<ICodeExecutionAdapter, CSharpExecutionAdapter>();

var app = builder.Build();

app.MapGet("/health", () => Results.Ok(new { status = "ok", timestamp = DateTimeOffset.UtcNow }));

app.MapPost(
    "/api/run",
    async (RunCodeRequest request, ICodeExecutionService service, CancellationToken cancellationToken) =>
    {
        var result = await service.ExecuteAsync(request, cancellationToken);
        return Results.Ok(result);
    });

app.Run();
