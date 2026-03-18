using Microsoft.AspNetCore.Mvc;
using Whiteboard.Api.Contracts;
using Whiteboard.Api.Services;

namespace Whiteboard.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public sealed class RoomsController(IWhiteboardRoomStore roomStore) : ControllerBase
{
    private readonly IWhiteboardRoomStore _roomStore = roomStore;

    [HttpPost]
    public ActionResult<RoomSummaryResponse> CreateRoom()
    {
        var roomId = Guid.NewGuid().ToString("N")[..8];
        var room = _roomStore.GetOrCreateRoom(roomId);

        return CreatedAtAction(
            nameof(GetRoom),
            new { roomId },
            new RoomSummaryResponse(room.RoomId, room.CreatedAt));
    }

    [HttpGet("{roomId}")]
    public IActionResult GetRoom(string roomId)
    {
        var room = _roomStore.GetOrCreateRoom(roomId);
        return Ok(room);
    }
}
