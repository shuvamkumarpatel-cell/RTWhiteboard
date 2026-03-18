using Microsoft.AspNetCore.SignalR;
using Whiteboard.Api.Contracts;
using Whiteboard.Api.Models;
using Whiteboard.Api.Services;

namespace Whiteboard.Api.Hubs;

public sealed class WhiteboardHub(IWhiteboardRoomStore roomStore) : Hub
{
    private readonly IWhiteboardRoomStore _roomStore = roomStore;

    public async Task JoinRoom(JoinRoomRequest request)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, request.RoomId);

        var participant = new WhiteboardParticipant(
            request.UserId,
            request.Name,
            Context.ConnectionId,
            DateTimeOffset.UtcNow);

        Context.Items["roomId"] = request.RoomId;

        var state = _roomStore.AddParticipant(request.RoomId, participant);

        await Clients.Caller.SendAsync("RoomStateSynchronized", state);
        await Clients.Group(request.RoomId).SendAsync("ParticipantsUpdated", state.Participants);
    }

    public async Task AddStroke(AddStrokeRequest request)
    {
        var stroke = new WhiteboardStroke(
            request.StrokeId,
            request.UserId,
            request.Color,
            request.Width,
            request.Points,
            DateTimeOffset.UtcNow);

        var state = _roomStore.AddStroke(request.RoomId, stroke);

        await Clients.Group(request.RoomId).SendAsync("StrokeAdded", stroke);
        await Clients.Group(request.RoomId).SendAsync("RoomMetadataUpdated", state.UpdatedAt);
    }

    public async Task ClearBoard(string roomId)
    {
        var state = _roomStore.ClearRoom(roomId);
        await Clients.Group(roomId).SendAsync("BoardCleared");
        await Clients.Group(roomId).SendAsync("RoomMetadataUpdated", state.UpdatedAt);
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        if (Context.Items.TryGetValue("roomId", out var roomIdValue) && roomIdValue is string roomId)
        {
            var state = _roomStore.RemoveParticipant(roomId, Context.ConnectionId);
            await Clients.Group(roomId).SendAsync("ParticipantsUpdated", state.Participants);
        }

        await base.OnDisconnectedAsync(exception);
    }
}
