using Microsoft.Extensions.Options;
using CodeRunner.Service.Contracts;

namespace CodeRunner.Service.Services;

public sealed class JavaExecutionAdapter(IOptions<DockerRunnerOptions> options) : ICodeExecutionAdapter
{
    private readonly DockerRunnerOptions _options = options.Value;

    public string Language => "java";

    public Task<RunCodeResponse> ExecuteAsync(RunCodeRequest request, CancellationToken cancellationToken) =>
        DockerExecutionHelpers.RunInContainerAsync(
            "Java",
            Language,
            "Main.java",
            request.Code,
            request.Input,
            _options,
            null,
            cancellationToken);
}
