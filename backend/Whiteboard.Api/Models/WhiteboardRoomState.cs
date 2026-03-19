namespace Whiteboard.Api.Models;

public sealed record WhiteboardRoomState(
    string RoomId,
    DateTimeOffset CreatedAt,
    IReadOnlyCollection<WhiteboardElement> Elements,
    IReadOnlyCollection<WhiteboardParticipant> Participants,
    DateTimeOffset UpdatedAt);
