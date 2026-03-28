using CodeRunner.Service.Contracts;

namespace CodeRunner.Service.Services;

public interface ICodeExecutionAdapter
{
    string Language { get; }

    Task<RunCodeResponse> ExecuteAsync(RunCodeRequest request, CancellationToken cancellationToken);
}
