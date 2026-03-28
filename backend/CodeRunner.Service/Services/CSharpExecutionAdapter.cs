using Microsoft.Extensions.Options;
using CodeRunner.Service.Contracts;

namespace CodeRunner.Service.Services;

public sealed class CSharpExecutionAdapter(IOptions<DockerRunnerOptions> options) : ICodeExecutionAdapter
{
    private readonly DockerRunnerOptions _options = options.Value;

    public string Language => "csharp";

    public Task<RunCodeResponse> ExecuteAsync(RunCodeRequest request, CancellationToken cancellationToken) =>
        DockerExecutionHelpers.RunInContainerAsync(
            "C#",
            Language,
            "Program.cs",
            request.Code,
            request.Input,
            _options,
            20,
            cancellationToken);
}
