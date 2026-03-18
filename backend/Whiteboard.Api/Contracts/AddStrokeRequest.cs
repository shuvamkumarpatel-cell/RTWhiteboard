using Whiteboard.Api.Models;

namespace Whiteboard.Api.Contracts;

public sealed record AddStrokeRequest(
    string RoomId,
    string StrokeId,
    string UserId,
    string Color,
    double Width,
    IReadOnlyList<WhiteboardStrokePoint> Points);
