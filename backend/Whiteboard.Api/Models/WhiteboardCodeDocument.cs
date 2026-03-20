namespace Whiteboard.Api.Models;

public sealed record WhiteboardCodeDocument(
    string FileName,
    string Language,
    string Content,
    string? LastEditedBy,
    DateTimeOffset UpdatedAt);
