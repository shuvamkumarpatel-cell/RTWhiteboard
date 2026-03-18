using System.Collections.Concurrent;
using Whiteboard.Api.Models;

namespace Whiteboard.Api.Services;

public sealed class InMemoryWhiteboardRoomStore : IWhiteboardRoomStore
{
    private readonly ConcurrentDictionary<string, WhiteboardRoom> _rooms = new(StringComparer.OrdinalIgnoreCase);

    public WhiteboardRoomState GetOrCreateRoom(string roomId)
    {
        var room = _rooms.GetOrAdd(roomId, WhiteboardRoom.Create);
        lock (room.SyncRoot)
        {
            return room.ToState();
        }
    }

    public WhiteboardRoomState AddParticipant(string roomId, WhiteboardParticipant participant)
    {
        var room = _rooms.GetOrAdd(roomId, WhiteboardRoom.Create);
        lock (room.SyncRoot)
        {
            room.Participants[participant.ConnectionId] = participant;
            room.Touch();
            return room.ToState();
        }
    }

    public WhiteboardRoomState RemoveParticipant(string roomId, string connectionId)
    {
        var room = _rooms.GetOrAdd(roomId, WhiteboardRoom.Create);
        lock (room.SyncRoot)
        {
            room.Participants.Remove(connectionId);
            room.Touch();
            return room.ToState();
        }
    }

    public WhiteboardRoomState AddStroke(string roomId, WhiteboardStroke stroke)
    {
        var room = _rooms.GetOrAdd(roomId, WhiteboardRoom.Create);
        lock (room.SyncRoot)
        {
            room.Strokes.Add(stroke);
            room.Touch();
            return room.ToState();
        }
    }

    public WhiteboardRoomState ClearRoom(string roomId)
    {
        var room = _rooms.GetOrAdd(roomId, WhiteboardRoom.Create);
        lock (room.SyncRoot)
        {
            room.Strokes.Clear();
            room.Touch();
            return room.ToState();
        }
    }

    private sealed class WhiteboardRoom
    {
        public string RoomId { get; init; } = string.Empty;
        public DateTimeOffset CreatedAt { get; init; }
        public DateTimeOffset UpdatedAt { get; private set; }
        public List<WhiteboardStroke> Strokes { get; } = [];
        public Dictionary<string, WhiteboardParticipant> Participants { get; } = new(StringComparer.Ordinal);
        public object SyncRoot { get; } = new();

        public static WhiteboardRoom Create(string roomId) =>
            new()
            {
                RoomId = roomId,
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            };

        public void Touch() => UpdatedAt = DateTimeOffset.UtcNow;

        public WhiteboardRoomState ToState() =>
            new(
                RoomId,
                CreatedAt,
                Strokes.ToArray(),
                Participants.Values
                    .OrderBy(participant => participant.Name, StringComparer.OrdinalIgnoreCase)
                    .ToArray(),
                UpdatedAt);
    }
}
