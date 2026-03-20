namespace Whiteboard.Api.Models;

public sealed record WhiteboardRoomState(
    string RoomId,
    DateTimeOffset CreatedAt,
    IReadOnlyCollection<WhiteboardElement> Elements,
    WhiteboardCodeDocument CodeDocument,
    string WorkspaceView,
    IReadOnlyCollection<WhiteboardParticipant> Participants,
    DateTimeOffset UpdatedAt);
