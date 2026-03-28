using Microsoft.Extensions.Options;
using CodeRunner.Service.Contracts;

namespace CodeRunner.Service.Services;

public sealed class PythonExecutionAdapter(IOptions<DockerRunnerOptions> options) : ICodeExecutionAdapter
{
    private readonly DockerRunnerOptions _options = options.Value;

    public string Language => "python";

    public Task<RunCodeResponse> ExecuteAsync(RunCodeRequest request, CancellationToken cancellationToken) =>
        DockerExecutionHelpers.RunInContainerAsync(
            "Python",
            Language,
            "main.py",
            request.Code,
            request.Input,
            _options,
            null,
            cancellationToken);
}
