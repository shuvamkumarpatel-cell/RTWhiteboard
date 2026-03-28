using Microsoft.Extensions.Options;
using CodeRunner.Service.Contracts;

namespace CodeRunner.Service.Services;

public sealed class JavaScriptExecutionAdapter(IOptions<DockerRunnerOptions> options) : ICodeExecutionAdapter
{
    private readonly DockerRunnerOptions _options = options.Value;

    public string Language => "javascript";

    public Task<RunCodeResponse> ExecuteAsync(RunCodeRequest request, CancellationToken cancellationToken) =>
        DockerExecutionHelpers.RunInContainerAsync(
            "JavaScript",
            Language,
            "main.js",
            request.Code,
            request.Input,
            _options,
            null,
            cancellationToken);
}
