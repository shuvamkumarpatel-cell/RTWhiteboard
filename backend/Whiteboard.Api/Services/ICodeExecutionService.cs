using Whiteboard.Api.Contracts;

namespace Whiteboard.Api.Services;

public interface ICodeExecutionService
{
    Task<RunCodeResponse> ExecuteAsync(RunCodeRequest request, CancellationToken cancellationToken);
}
