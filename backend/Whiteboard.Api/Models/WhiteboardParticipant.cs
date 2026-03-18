namespace Whiteboard.Api.Models;

public sealed record WhiteboardParticipant(
    string UserId,
    string Name,
    string ConnectionId,
    DateTimeOffset JoinedAt);
