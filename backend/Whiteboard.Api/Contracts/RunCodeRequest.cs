namespace Whiteboard.Api.Contracts;

public sealed record RunCodeRequest(
    string Language,
    string Code,
    string? Input);
