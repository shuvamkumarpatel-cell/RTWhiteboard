using Whiteboard.Api.Models;

namespace Whiteboard.Api.Contracts;

public sealed record AddBoardElementRequest(
    string RoomId,
    string ElementId,
    string UserId,
    string Kind,
    string Color,
    double Width,
    IReadOnlyList<WhiteboardStrokePoint> Points,
    string? Text,
    double FontSize,
    bool IsFilled);
