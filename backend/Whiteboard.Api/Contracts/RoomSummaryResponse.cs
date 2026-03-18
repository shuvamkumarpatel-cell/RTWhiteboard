namespace Whiteboard.Api.Contracts;

public sealed record RoomSummaryResponse(string RoomId, DateTimeOffset CreatedAt);
