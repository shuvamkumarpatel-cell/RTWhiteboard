using CodeRunner.Service.Contracts;

namespace CodeRunner.Service.Services;

public sealed class CodeExecutionService(IEnumerable<ICodeExecutionAdapter> adapters) : ICodeExecutionService
{
    private readonly IReadOnlyDictionary<string, ICodeExecutionAdapter> _adapters =
        adapters.ToDictionary(adapter => adapter.Language, StringComparer.OrdinalIgnoreCase);

    public Task<RunCodeResponse> ExecuteAsync(RunCodeRequest request, CancellationToken cancellationToken)
    {
        if (_adapters.TryGetValue(request.Language, out var adapter))
        {
            return adapter.ExecuteAsync(request, cancellationToken);
        }

        var supportedLanguages = string.Join(", ", _adapters.Keys.OrderBy(language => language));
        return Task.FromResult(
            new RunCodeResponse(
                false,
                -1,
                string.Empty,
                $"Language '{request.Language}' is not configured in the runner. Available: {supportedLanguages}."));
    }
}
