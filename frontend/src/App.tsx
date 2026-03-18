import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as CanvasPointerEvent } from "react";
import {
  HubConnection,
  HubConnectionBuilder,
  LogLevel,
} from "@microsoft/signalr";
import { createRoom, endpoints, fetchRoom } from "./lib/api";
import { redrawCanvas } from "./lib/drawing";
import type { Participant, RoomState, Stroke, StrokePoint } from "./types";

const palette = ["#0f172a", "#2563eb", "#0891b2", "#16a34a", "#ea580c", "#dc2626"];
const brushSizes = [2, 4, 8, 12];

const randomId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const initialName = `Guest-${Math.floor(Math.random() * 900 + 100)}`;

function App() {
  const [roomId, setRoomId] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("room")?.trim().toLowerCase() || "studio";
  });
  const [displayName, setDisplayName] = useState(initialName);
  const [userId] = useState(randomId);
  const [status, setStatus] = useState("Disconnected");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [selectedColor, setSelectedColor] = useState(palette[1]);
  const [selectedWidth, setSelectedWidth] = useState(4);
  const [draftPoints, setDraftPoints] = useState<StrokePoint[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const connectionRef = useRef<HubConnection | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const isDrawingRef = useRef(false);

  const draftStroke = useMemo(
    () =>
      draftPoints.length > 0
        ? {
            color: selectedColor,
            width: selectedWidth,
            points: draftPoints,
          }
        : null,
    [draftPoints, selectedColor, selectedWidth],
  );

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const board = boardRef.current;

    if (!canvas || !board) {
      return;
    }

    const resizeCanvas = () => {
      const ratio = window.devicePixelRatio || 1;
      const width = board.clientWidth;
      const height = board.clientHeight;

      canvas.width = width * ratio;
      canvas.height = height * ratio;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const context = canvas.getContext("2d");
      context?.setTransform(ratio, 0, 0, ratio, 0, 0);

      redrawCanvas(canvas, strokes, draftStroke);
    };

    resizeCanvas();

    const observer = new ResizeObserver(resizeCanvas);
    observer.observe(board);
    window.addEventListener("resize", resizeCanvas);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", resizeCanvas);
    };
  }, [draftStroke, strokes]);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (canvas) {
      redrawCanvas(canvas, strokes, draftStroke);
    }
  }, [draftStroke, strokes]);

  useEffect(() => {
    return () => {
      connectionRef.current?.stop().catch(() => undefined);
    };
  }, []);

  const syncRoomState = (room: RoomState) => {
    setParticipants(room.participants);
    setStrokes(room.strokes);
  };

  const connectToRoom = async (targetRoomId: string) => {
    const nextRoomId = targetRoomId.trim().toLowerCase();

    if (!nextRoomId) {
      setErrorMessage("Choose a room id before connecting.");
      return;
    }

    setIsConnecting(true);
    setErrorMessage(null);
    setStatus("Connecting");

    await connectionRef.current?.stop().catch(() => undefined);

    const connection = new HubConnectionBuilder()
      .withUrl(endpoints.hubUrl)
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build();

    connection.on("RoomStateSynchronized", (room: RoomState) => {
      syncRoomState(room);
      setStatus(`Connected to ${room.roomId}`);
    });

    connection.on("ParticipantsUpdated", (nextParticipants: Participant[]) => {
      setParticipants(nextParticipants);
    });

    connection.on("StrokeAdded", (stroke: Stroke) => {
      setStrokes((current) => [...current, stroke]);
    });

    connection.on("BoardCleared", () => {
      setStrokes([]);
    });

    connection.onreconnecting(() => {
      setStatus("Reconnecting");
    });

    connection.onreconnected(async () => {
      setStatus(`Connected to ${nextRoomId}`);
      await connection.invoke("JoinRoom", {
        roomId: nextRoomId,
        userId,
        name: displayName.trim() || initialName,
      });
    });

    connection.onclose(() => {
      setStatus("Disconnected");
    });

    try {
      const room = await fetchRoom(nextRoomId);
      syncRoomState(room);
      await connection.start();
      await connection.invoke("JoinRoom", {
        roomId: nextRoomId,
        userId,
        name: displayName.trim() || initialName,
      });

      connectionRef.current = connection;
      setRoomId(nextRoomId);
    } catch (error) {
      setStatus("Disconnected");
      await connection.stop().catch(() => undefined);
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to connect to the room.",
      );
    } finally {
      setIsConnecting(false);
    }
  };

  const getCanvasPoint = (
    event: PointerEvent | CanvasPointerEvent<HTMLCanvasElement>,
  ) => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return null;
    }

    const rectangle = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rectangle.left,
      y: event.clientY - rectangle.top,
    };
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!connectionRef.current) {
      setErrorMessage("Connect to a room before drawing.");
      return;
    }

    const point = getCanvasPoint(event);

    if (!point) {
      return;
    }

    isDrawingRef.current = true;
    setDraftPoints([point]);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) {
      return;
    }

    const point = getCanvasPoint(event);

    if (!point) {
      return;
    }

    setDraftPoints((current) => [...current, point]);
  };

  const finishStroke = async () => {
    if (!isDrawingRef.current) {
      return;
    }

    isDrawingRef.current = false;

    if (draftPoints.length === 0 || !connectionRef.current) {
      setDraftPoints([]);
      return;
    }

    const strokeId = randomId();
    const points = draftPoints;
    setDraftPoints([]);

    try {
      await connectionRef.current.invoke("AddStroke", {
        roomId,
        strokeId,
        userId,
        color: selectedColor,
        width: selectedWidth,
        points,
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to send the stroke.",
      );
    }
  };

  const clearBoard = async () => {
    if (!connectionRef.current) {
      return;
    }

    try {
      await connectionRef.current.invoke("ClearBoard", roomId);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to clear the board.",
      );
    }
  };

  const createAndJoinRoom = async () => {
    try {
      const room = await createRoom();
      await connectToRoom(room.roomId);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to create a room.",
      );
    }
  };

  const activeParticipantNames = participants.map((participant) => participant.name);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">Realtime Collaboration</p>
          <h1>Whiteboard Studio</h1>
          <p className="lede">
            Sketch together in shared rooms with low-friction setup, live curseless
            sync, and instant board resets.
          </p>
        </div>

        <section className="panel">
          <label className="field">
            <span>Display name</span>
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Your name"
            />
          </label>

          <label className="field">
            <span>Room id</span>
            <input
              value={roomId}
              onChange={(event) => setRoomId(event.target.value)}
              placeholder="studio"
            />
          </label>

          <div className="button-row">
            <button onClick={() => void connectToRoom(roomId)} disabled={isConnecting}>
              {isConnecting ? "Joining..." : "Join room"}
            </button>
            <button className="secondary" onClick={() => void createAndJoinRoom()}>
              New room
            </button>
          </div>

          <p className="status-line">{status}</p>
          {errorMessage ? <p className="error-line">{errorMessage}</p> : null}
        </section>

        <section className="panel">
          <div className="panel-header">
            <h2>Brush</h2>
            <button className="ghost" onClick={() => void clearBoard()}>
              Clear board
            </button>
          </div>

          <div className="swatches">
            {palette.map((color) => (
              <button
                key={color}
                className={color === selectedColor ? "swatch active" : "swatch"}
                style={{ backgroundColor: color }}
                onClick={() => setSelectedColor(color)}
                aria-label={`Select ${color}`}
              />
            ))}
          </div>

          <div className="size-row">
            {brushSizes.map((size) => (
              <button
                key={size}
                className={size === selectedWidth ? "size-pill active" : "size-pill"}
                onClick={() => setSelectedWidth(size)}
              >
                {size}px
              </button>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <h2>Participants</h2>
            <span>{participants.length}</span>
          </div>

          <div className="participant-list">
            {activeParticipantNames.length > 0 ? (
              activeParticipantNames.map((name) => <span key={name}>{name}</span>)
            ) : (
              <span>Connect to see collaborators.</span>
            )}
          </div>
        </section>
      </aside>

      <main className="workspace">
        <div className="workspace-header">
          <div>
            <p className="eyebrow">Shared Canvas</p>
            <h2>{roomId || "studio"}</h2>
          </div>
          <button
            className="secondary"
            onClick={() =>
              navigator.clipboard.writeText(
                `${window.location.origin}?room=${encodeURIComponent(roomId)}`,
              )
            }
          >
            Copy invite link
          </button>
        </div>

        <div className="board" ref={boardRef}>
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={() => void finishStroke()}
            onPointerLeave={() => void finishStroke()}
          />
        </div>
      </main>
    </div>
  );
}

export default App;
