using Whiteboard.Api.Models;

namespace Whiteboard.Api.Services;

public interface IWhiteboardRoomStore
{
    WhiteboardRoomState GetOrCreateRoom(string roomId);
    WhiteboardRoomState AddParticipant(string roomId, WhiteboardParticipant participant);
    WhiteboardRoomState RemoveParticipant(string roomId, string connectionId);
    WhiteboardRoomState AddElement(string roomId, WhiteboardElement element);
    WhiteboardRoomState UpdateElement(string roomId, WhiteboardElement element);
    WhiteboardRoomState UpdateCodeDocument(string roomId, WhiteboardCodeDocument document);
    WhiteboardRoomState UpdateWorkspaceView(string roomId, string viewMode);
    WhiteboardRoomState RemoveElement(string roomId, string elementId);
    WhiteboardRoomState RemoveLatestElementByUser(string roomId, string userId);
    WhiteboardRoomState ClearRoom(string roomId);
}
