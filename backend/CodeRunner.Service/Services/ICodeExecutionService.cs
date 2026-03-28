using CodeRunner.Service.Contracts;

namespace CodeRunner.Service.Services;

public interface ICodeExecutionService
{
    Task<RunCodeResponse> ExecuteAsync(RunCodeRequest request, CancellationToken cancellationToken);
}
