using Microsoft.Extensions.Options;
using CodeRunner.Service.Contracts;

namespace CodeRunner.Service.Services;

public sealed class CppExecutionAdapter(IOptions<DockerRunnerOptions> options) : ICodeExecutionAdapter
{
    private readonly DockerRunnerOptions _options = options.Value;

    public string Language => "cpp";

    public Task<RunCodeResponse> ExecuteAsync(RunCodeRequest request, CancellationToken cancellationToken) =>
        DockerExecutionHelpers.RunInContainerAsync(
            "C++",
            Language,
            "main.cpp",
            request.Code,
            request.Input,
            _options,
            null,
            cancellationToken);
}
