namespace CodeRunner.Service.Contracts;

public sealed record RunCodeResponse(
    bool Succeeded,
    int ExitCode,
    string Output,
    string Error);
