namespace Whiteboard.Api.Models;

public sealed record WhiteboardElement(
    string Id,
    string UserId,
    string Kind,
    string Color,
    double Width,
    IReadOnlyList<WhiteboardStrokePoint> Points,
    string? Text,
    double FontSize,
    bool IsFilled,
    DateTimeOffset CreatedAt);
