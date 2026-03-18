namespace Whiteboard.Api.Models;

public sealed record WhiteboardStroke(
    string Id,
    string UserId,
    string Color,
    double Width,
    IReadOnlyList<WhiteboardStrokePoint> Points,
    DateTimeOffset CreatedAt);
