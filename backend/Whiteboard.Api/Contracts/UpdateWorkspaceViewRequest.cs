namespace Whiteboard.Api.Contracts;

public sealed record UpdateWorkspaceViewRequest(
    string RoomId,
    string ViewMode);
