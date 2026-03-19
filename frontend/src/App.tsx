import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as CanvasPointerEvent } from "react";
import {
  HubConnection,
  HubConnectionBuilder,
  LogLevel,
} from "@microsoft/signalr";
import { createRoom, endpoints, fetchRoom } from "./lib/api";
import { redrawCanvas } from "./lib/drawing";
import type {
  BoardElement,
  BoardPoint,
  BoardTool,
  Participant,
  RoomState,
} from "./types";

const palette = ["#0f172a", "#2563eb", "#0891b2", "#16a34a", "#ea580c", "#dc2626"];
const brushSizes = [2, 4, 8, 12];
const fontSizes = [18, 24, 32, 40];
const toolDefinitions: Array<{ value: BoardTool; label: string }> = [
  { value: "pen", label: "Pen" },
  { value: "eraser", label: "Eraser" },
  { value: "line", label: "Line" },
  { value: "arrow", label: "Arrow" },
  { value: "rectangle", label: "Rectangle" },
  { value: "ellipse", label: "Ellipse" },
  { value: "text", label: "Text" },
];

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
  const [elements, setElements] = useState<BoardElement[]>([]);
  const [selectedTool, setSelectedTool] = useState<BoardTool>("pen");
  const [selectedColor, setSelectedColor] = useState(palette[1]);
  const [selectedWidth, setSelectedWidth] = useState(4);
  const [selectedFontSize, setSelectedFontSize] = useState(24);
  const [isFilled, setIsFilled] = useState(false);
  const [draftElement, setDraftElement] = useState<Omit<BoardElement, "id" | "userId" | "createdAt"> | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const connectionRef = useRef<HubConnection | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const isDrawingRef = useRef(false);
  const draftElementRef = useRef<Omit<BoardElement, "id" | "userId" | "createdAt"> | null>(
    null,
  );

  const updateDraftElement = (
    value: Omit<BoardElement, "id" | "userId" | "createdAt"> | null,
  ) => {
    draftElementRef.current = value;
    setDraftElement(value);
  };

  const draftPreview = useMemo(() => draftElement, [draftElement]);

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

      redrawCanvas(canvas, elements, draftPreview);
    };

    resizeCanvas();

    const observer = new ResizeObserver(resizeCanvas);
    observer.observe(board);
    window.addEventListener("resize", resizeCanvas);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", resizeCanvas);
    };
  }, [draftPreview, elements]);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (canvas) {
      redrawCanvas(canvas, elements, draftPreview);
    }
  }, [draftPreview, elements]);

  useEffect(() => {
    return () => {
      connectionRef.current?.stop().catch(() => undefined);
    };
  }, []);

  const syncRoomState = (room: RoomState) => {
    setParticipants(room.participants);
    setElements(room.elements);
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

    connection.on("BoardCleared", () => {
      setElements([]);
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

  const sendElement = async (
    nextElement: Omit<BoardElement, "id" | "userId" | "createdAt">,
  ) => {
    if (!connectionRef.current) {
      setErrorMessage("Connect to a room before editing the board.");
      return;
    }

    try {
      await connectionRef.current.invoke("AddBoardElement", {
        roomId,
        elementId: randomId(),
        userId,
        kind: nextElement.kind,
        color: nextElement.color,
        width: nextElement.width,
        points: nextElement.points,
        text: nextElement.text ?? null,
        fontSize: nextElement.fontSize,
        isFilled: nextElement.isFilled,
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to send the board change.",
      );
    }
  };

  const buildDraftElement = (point: BoardPoint) => ({
    kind: selectedTool,
    color: selectedColor,
    width: selectedWidth,
    points: [point],
    text: null,
    fontSize: selectedFontSize,
    isFilled,
  });

  const handlePointerDown = async (
    event: React.PointerEvent<HTMLCanvasElement>,
  ) => {
    if (!connectionRef.current) {
      setErrorMessage("Connect to a room before drawing.");
      return;
    }

    const point = getCanvasPoint(event);

    if (!point) {
      return;
    }

    setErrorMessage(null);

    if (selectedTool === "text") {
      const text = window.prompt("Enter text for the board:");

      if (!text?.trim()) {
        return;
      }

      await sendElement({
        kind: "text",
        color: selectedColor,
        width: selectedWidth,
        points: [point],
        text: text.trim(),
        fontSize: selectedFontSize,
        isFilled: false,
      });
      return;
    }

    isDrawingRef.current = true;
    updateDraftElement(buildDraftElement(point));
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

    const currentDraft = draftElementRef.current;

    if (!currentDraft) {
      return;
    }

    if (currentDraft.kind === "pen" || currentDraft.kind === "eraser") {
      updateDraftElement({
        ...currentDraft,
        points: [...currentDraft.points, point],
      });
      return;
    }

    updateDraftElement({
      ...currentDraft,
      points: [currentDraft.points[0], point],
    });
  };

  const finishStroke = async () => {
    if (!isDrawingRef.current) {
      return;
    }

    isDrawingRef.current = false;

    const currentDraft = draftElementRef.current;

    if (!currentDraft || !connectionRef.current) {
      updateDraftElement(null);
      return;
    }

    if (currentDraft.points.length === 0) {
      updateDraftElement(null);
      return;
    }

    updateDraftElement(null);
    await sendElement(currentDraft);
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

  const undoLastAction = async () => {
    if (!connectionRef.current) {
      return;
    }

    try {
      await connectionRef.current.invoke("UndoLastAction", roomId, userId);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to undo the last action.",
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
  const boardHelpText =
    selectedTool === "text"
      ? "Click anywhere on the board to place a text note."
      : selectedTool === "pen" || selectedTool === "eraser"
        ? "Drag on the board to draw."
        : "Drag on the board to place the selected shape.";

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
            <h2>Tools</h2>
            <span className="tool-badge">{selectedTool}</span>
          </div>

          <div className="tool-grid">
            {toolDefinitions.map((tool) => (
              <button
                key={tool.value}
                className={tool.value === selectedTool ? "tool-chip active" : "tool-chip"}
                onClick={() => setSelectedTool(tool.value)}
              >
                {tool.label}
              </button>
            ))}
          </div>

          <p className="helper-text">{boardHelpText}</p>
        </section>

        <section className="panel">
          <div className="panel-header">
            <h2>Style</h2>
            <div className="toolbar-actions">
              <button className="ghost" onClick={() => void undoLastAction()}>
                Undo mine
              </button>
              <button className="ghost" onClick={() => void clearBoard()}>
                Clear board
              </button>
            </div>
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

          <div className="panel-header compact">
            <h2>Text size</h2>
            <span>{selectedFontSize}px</span>
          </div>

          <div className="size-row">
            {fontSizes.map((size) => (
              <button
                key={size}
                className={size === selectedFontSize ? "size-pill active" : "size-pill"}
                onClick={() => setSelectedFontSize(size)}
              >
                {size}px
              </button>
            ))}
          </div>

          <button
            className={isFilled ? "toggle-chip active" : "toggle-chip"}
            onClick={() => setIsFilled((current) => !current)}
          >
            {isFilled ? "Filled shapes on" : "Filled shapes off"}
          </button>
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
            className={`board-canvas tool-${selectedTool}`}
            onPointerDown={(event) => void handlePointerDown(event)}
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
