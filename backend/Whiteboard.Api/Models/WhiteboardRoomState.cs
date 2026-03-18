namespace Whiteboard.Api.Models;

public sealed record WhiteboardRoomState(
    string RoomId,
    DateTimeOffset CreatedAt,
    IReadOnlyCollection<WhiteboardStroke> Strokes,
    IReadOnlyCollection<WhiteboardParticipant> Participants,
    DateTimeOffset UpdatedAt);
