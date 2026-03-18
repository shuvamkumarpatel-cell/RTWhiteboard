namespace Whiteboard.Api.Contracts;

public sealed record JoinRoomRequest(string RoomId, string UserId, string Name);
