namespace Whiteboard.Api.Contracts;

public sealed record UpdateCodeDocumentRequest(
    string RoomId,
    string UserId,
    string FileName,
    string Language,
    string Content);
