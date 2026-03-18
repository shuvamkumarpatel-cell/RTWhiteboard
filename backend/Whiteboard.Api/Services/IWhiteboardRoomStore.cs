using Whiteboard.Api.Models;

namespace Whiteboard.Api.Services;

public interface IWhiteboardRoomStore
{
    WhiteboardRoomState GetOrCreateRoom(string roomId);
    WhiteboardRoomState AddParticipant(string roomId, WhiteboardParticipant participant);
    WhiteboardRoomState RemoveParticipant(string roomId, string connectionId);
    WhiteboardRoomState AddStroke(string roomId, WhiteboardStroke stroke);
    WhiteboardRoomState ClearRoom(string roomId);
}
