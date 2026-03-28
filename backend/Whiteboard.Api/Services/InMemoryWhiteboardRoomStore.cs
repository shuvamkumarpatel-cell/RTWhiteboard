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

    public WhiteboardRoomState AddElement(string roomId, WhiteboardElement element)
    {
        var room = _rooms.GetOrAdd(roomId, WhiteboardRoom.Create);
        lock (room.SyncRoot)
        {
            room.Elements.Add(element);
            room.Touch();
            return room.ToState();
        }
    }

    public WhiteboardRoomState UpdateElement(string roomId, WhiteboardElement element)
    {
        var room = _rooms.GetOrAdd(roomId, WhiteboardRoom.Create);
        lock (room.SyncRoot)
        {
            var index = room.Elements.FindIndex(current => string.Equals(current.Id, element.Id, StringComparison.Ordinal));
            if (index >= 0)
            {
                room.Elements[index] = element;
            }
            else
            {
                room.Elements.Add(element);
            }

            room.Touch();
            return room.ToState();
        }
    }

    public WhiteboardRoomState UpdateCodeDocument(string roomId, WhiteboardCodeDocument document)
    {
        var room = _rooms.GetOrAdd(roomId, WhiteboardRoom.Create);
        lock (room.SyncRoot)
        {
            room.CodeDocument = document;
            room.Touch();
            return room.ToState();
        }
    }

    public WhiteboardRoomState UpdateWorkspaceView(string roomId, string viewMode)
    {
        var room = _rooms.GetOrAdd(roomId, WhiteboardRoom.Create);
        lock (room.SyncRoot)
        {
            room.WorkspaceView = viewMode;
            room.Touch();
            return room.ToState();
        }
    }

    public WhiteboardRoomState RemoveElement(string roomId, string elementId)
    {
        var room = _rooms.GetOrAdd(roomId, WhiteboardRoom.Create);
        lock (room.SyncRoot)
        {
            room.Elements.RemoveAll(element => string.Equals(element.Id, elementId, StringComparison.Ordinal));
            room.Touch();
            return room.ToState();
        }
    }

    public WhiteboardRoomState RemoveLatestElementByUser(string roomId, string userId)
    {
        var room = _rooms.GetOrAdd(roomId, WhiteboardRoom.Create);
        lock (room.SyncRoot)
        {
            var index = room.Elements.FindLastIndex(element => string.Equals(element.UserId, userId, StringComparison.Ordinal));
            if (index >= 0)
            {
                room.Elements.RemoveAt(index);
            }
            room.Touch();
            return room.ToState();
        }
    }

    public WhiteboardRoomState ClearRoom(string roomId)
    {
        var room = _rooms.GetOrAdd(roomId, WhiteboardRoom.Create);
        lock (room.SyncRoot)
        {
            room.Elements.Clear();
            room.Touch();
            return room.ToState();
        }
    }

    private sealed class WhiteboardRoom
    {
        public string RoomId { get; init; } = string.Empty;
        public DateTimeOffset CreatedAt { get; init; }
        public DateTimeOffset UpdatedAt { get; private set; }
        public List<WhiteboardElement> Elements { get; } = [];
        public WhiteboardCodeDocument CodeDocument { get; set; } = new(
            "main.js",
            "javascript",
            """
            function helloWhiteboard(name) {
              return `Hello, ${name}!`;
            }
            """,
            null,
            DateTimeOffset.UtcNow);
        public string WorkspaceView { get; set; } = "split";
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
                Elements.ToArray(),
                CodeDocument,
                WorkspaceView,
                Participants.Values
                    .OrderBy(participant => participant.Name, StringComparer.OrdinalIgnoreCase)
                    .ToArray(),
                UpdatedAt);
    }
}
