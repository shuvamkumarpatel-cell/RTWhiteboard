using Whiteboard.Api.Models;

namespace Whiteboard.Api.Services;

public interface IWhiteboardRoomStore
{
    WhiteboardRoomState GetOrCreateRoom(string roomId);
    WhiteboardRoomState AddParticipant(string roomId, WhiteboardParticipant participant);
    WhiteboardRoomState RemoveParticipant(string roomId, string connectionId);
    WhiteboardRoomState AddElement(string roomId, WhiteboardElement element);
    WhiteboardRoomState RemoveLatestElementByUser(string roomId, string userId);
    WhiteboardRoomState ClearRoom(string roomId);
}
