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

    public async Task AddBoardElement(AddBoardElementRequest request)
    {
        var element = new WhiteboardElement(
            request.ElementId,
            request.UserId,
            request.Kind,
            request.Color,
            request.Width,
            request.Points,
            request.Text,
            request.FontSize,
            request.IsFilled,
            DateTimeOffset.UtcNow);

        var state = _roomStore.AddElement(request.RoomId, element);

        await Clients.Group(request.RoomId).SendAsync("ElementAdded", element);
        await Clients.Group(request.RoomId).SendAsync("RoomStateSynchronized", state);
        await Clients.Group(request.RoomId).SendAsync("RoomMetadataUpdated", state.UpdatedAt);
    }

    public async Task UpdateBoardElement(UpdateBoardElementRequest request)
    {
        var existingState = _roomStore.GetOrCreateRoom(request.RoomId);
        var existingElement = existingState.Elements.FirstOrDefault(element => string.Equals(element.Id, request.ElementId, StringComparison.Ordinal));

        var element = new WhiteboardElement(
            request.ElementId,
            request.UserId,
            request.Kind,
            request.Color,
            request.Width,
            request.Points,
            request.Text,
            request.FontSize,
            request.IsFilled,
            existingElement?.CreatedAt ?? DateTimeOffset.UtcNow);

        var state = _roomStore.UpdateElement(request.RoomId, element);

        await Clients.Group(request.RoomId).SendAsync("RoomStateSynchronized", state);
        await Clients.Group(request.RoomId).SendAsync("RoomMetadataUpdated", state.UpdatedAt);
    }

    public async Task UpdateCodeDocument(UpdateCodeDocumentRequest request)
    {
        var document = new WhiteboardCodeDocument(
            request.FileName,
            request.Language,
            request.Content,
            request.UserId,
            DateTimeOffset.UtcNow);

        var state = _roomStore.UpdateCodeDocument(request.RoomId, document);

        await Clients.Group(request.RoomId).SendAsync("RoomStateSynchronized", state);
        await Clients.Group(request.RoomId).SendAsync("RoomMetadataUpdated", state.UpdatedAt);
    }

    public async Task DeleteBoardElement(string roomId, string elementId)
    {
        var state = _roomStore.RemoveElement(roomId, elementId);
        await Clients.Group(roomId).SendAsync("RoomStateSynchronized", state);
        await Clients.Group(roomId).SendAsync("RoomMetadataUpdated", state.UpdatedAt);
    }

    public async Task UndoLastAction(string roomId, string userId)
    {
        var state = _roomStore.RemoveLatestElementByUser(roomId, userId);
        await Clients.Group(roomId).SendAsync("RoomStateSynchronized", state);
        await Clients.Group(roomId).SendAsync("RoomMetadataUpdated", state.UpdatedAt);
    }

    public async Task ClearBoard(string roomId)
    {
        var state = _roomStore.ClearRoom(roomId);
        await Clients.Group(roomId).SendAsync("BoardCleared");
        await Clients.Group(roomId).SendAsync("RoomStateSynchronized", state);
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
