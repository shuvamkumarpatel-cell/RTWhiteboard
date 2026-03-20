import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as CanvasPointerEvent } from "react";
import {
  HubConnection,
  HubConnectionBuilder,
  LogLevel,
} from "@microsoft/signalr";
import { createRoom, endpoints, fetchRoom } from "./lib/api";
import {
  getElementBounds,
  hitTestElement,
  redrawCanvas,
  translateElement,
} from "./lib/drawing";
import type {
  BoardElement,
  BoardPoint,
  BoardTool,
  CodeDocument,
  Participant,
  RoomState,
} from "./types";

const palette = ["#0f172a", "#2563eb", "#0891b2", "#16a34a", "#ea580c", "#dc2626"];
const brushSizes = [2, 4, 8, 12];
const fontSizes = [18, 24, 32, 40];
const toolDefinitions: Array<{ value: BoardTool; label: string }> = [
  { value: "select", label: "Select" },
  { value: "pen", label: "Pen" },
  { value: "eraser", label: "Eraser" },
  { value: "line", label: "Line" },
  { value: "arrow", label: "Arrow" },
  { value: "rectangle", label: "Rectangle" },
  { value: "ellipse", label: "Ellipse" },
  { value: "text", label: "Text" },
];

type DraftElement = Omit<BoardElement, "id" | "userId" | "createdAt">;

type TextEditorState = {
  elementId: string | null;
  position: BoardPoint;
  value: string;
};

type DragState = {
  elementId: string;
  pointerId: number;
  origin: BoardPoint;
  baseElement: BoardElement;
  hasMoved: boolean;
};

type AutoSelectState = {
  elementId: string;
  returnTool: BoardTool;
};

const shapeTools: BoardTool[] = ["line", "arrow", "rectangle", "ellipse"];
const defaultCodeDocument: CodeDocument = {
  fileName: "main.ts",
  language: "typescript",
  content: [
    "export function helloWhiteboard(name: string) {",
    "  return `Hello, ${name}!`;",
    "}",
  ].join("\n"),
  lastEditedBy: null,
  updatedAt: new Date(0).toISOString(),
};

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
  const [selectedTool, setSelectedTool] = useState<BoardTool>("select");
  const [selectedColor, setSelectedColor] = useState(palette[1]);
  const [selectedWidth, setSelectedWidth] = useState(4);
  const [selectedFontSize, setSelectedFontSize] = useState(24);
  const [isFilled, setIsFilled] = useState(false);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [draftElement, setDraftElement] = useState<DraftElement | null>(null);
  const [textEditor, setTextEditor] = useState<TextEditorState | null>(null);
  const [showCodeEditor, setShowCodeEditor] = useState(false);
  const [codeDocument, setCodeDocument] = useState<CodeDocument>(defaultCodeDocument);
  const [isConnecting, setIsConnecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const connectionRef = useRef<HubConnection | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const isDrawingRef = useRef(false);
  const draftElementRef = useRef<DraftElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const autoSelectRef = useRef<AutoSelectState | null>(null);
  const codeSyncTimeoutRef = useRef<number | null>(null);

  const updateDraftElement = (value: DraftElement | null) => {
    draftElementRef.current = value;
    setDraftElement(value);
  };

  const draftPreview = useMemo(() => draftElement, [draftElement]);

  const selectedElement = useMemo(
    () => elements.find((element) => element.id === selectedElementId) ?? null,
    [elements, selectedElementId],
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

      redrawCanvas(canvas, elements, draftPreview, selectedElementId);
    };

    resizeCanvas();

    const observer = new ResizeObserver(resizeCanvas);
    observer.observe(board);
    window.addEventListener("resize", resizeCanvas);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", resizeCanvas);
    };
  }, [draftPreview, elements, selectedElementId]);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (canvas) {
      redrawCanvas(canvas, elements, draftPreview, selectedElementId);
    }
  }, [draftPreview, elements, selectedElementId]);

  useEffect(() => {
    if (selectedElementId && !elements.some((element) => element.id === selectedElementId)) {
      setSelectedElementId(null);
      if (autoSelectRef.current?.elementId === selectedElementId) {
        autoSelectRef.current = null;
      }
    }
  }, [elements, selectedElementId]);

  useEffect(() => {
    if (textEditor) {
      textAreaRef.current?.focus();
    }
  }, [textEditor]);

  useEffect(() => {
    return () => {
      if (codeSyncTimeoutRef.current) {
        window.clearTimeout(codeSyncTimeoutRef.current);
      }
      connectionRef.current?.stop().catch(() => undefined);
    };
  }, []);

  const syncRoomState = (room: RoomState) => {
    setParticipants(room.participants);
    setElements(room.elements);
    setCodeDocument(room.codeDocument);
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
      setSelectedElementId(null);
      setTextEditor(null);
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

  const findElementAtPoint = (point: BoardPoint) => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return null;
    }

    for (let index = elements.length - 1; index >= 0; index -= 1) {
      const element = elements[index];

      if (hitTestElement(canvas, element, point)) {
        return element;
      }
    }

    return null;
  };

  const sendElement = async (nextElement: DraftElement) => {
    if (!connectionRef.current) {
      setErrorMessage("Connect to a room before editing the board.");
      return null;
    }

    const elementId = randomId();
    const localElement: BoardElement = {
      id: elementId,
      userId,
      kind: nextElement.kind,
      color: nextElement.color,
      width: nextElement.width,
      points: nextElement.points,
      text: nextElement.text ?? null,
      fontSize: nextElement.fontSize,
      isFilled: nextElement.isFilled,
      createdAt: new Date().toISOString(),
    };

    setElements((current) => [...current, localElement]);

    try {
      await connectionRef.current.invoke("AddBoardElement", {
        roomId,
        elementId,
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

    return localElement;
  };

  const updateElement = async (nextElement: BoardElement) => {
    if (!connectionRef.current) {
      setErrorMessage("Connect to a room before editing the board.");
      return;
    }

    try {
      await connectionRef.current.invoke("UpdateBoardElement", {
        roomId,
        elementId: nextElement.id,
        userId: nextElement.userId,
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
        error instanceof Error ? error.message : "Unable to update the board element.",
      );
    }
  };

  const buildDraftElement = (point: BoardPoint): DraftElement => ({
    kind: selectedTool,
    color: selectedColor,
    width: selectedWidth,
    points: [point],
    text: null,
    fontSize: selectedFontSize,
    isFilled,
  });

  const queueCodeDocumentUpdate = (
    nextDocument: Pick<CodeDocument, "content" | "fileName" | "language">,
  ) => {
    if (!connectionRef.current) {
      return;
    }

    if (codeSyncTimeoutRef.current) {
      window.clearTimeout(codeSyncTimeoutRef.current);
    }

    codeSyncTimeoutRef.current = window.setTimeout(() => {
      void connectionRef.current?.invoke("UpdateCodeDocument", {
        roomId,
        userId,
        fileName: nextDocument.fileName,
        language: nextDocument.language,
        content: nextDocument.content,
      });
    }, 180);
  };

  const openTextEditor = (point: BoardPoint, element?: BoardElement | null) => {
    const nextEditor =
      element && element.kind === "text"
        ? {
            elementId: element.id,
            position: element.points[0] ?? point,
            value: element.text ?? "",
          }
        : {
            elementId: null,
            position: point,
            value: "",
          };

    if (element) {
      setSelectedElementId(element.id);
      setSelectedColor(element.color);
      setSelectedFontSize(element.fontSize);
    } else {
      setSelectedElementId(null);
    }

    setTextEditor(nextEditor);
  };

  const closeTextEditor = () => {
    setTextEditor(null);
  };

  const armAutoSelect = (elementId: string, returnTool: BoardTool) => {
    autoSelectRef.current = {
      elementId,
      returnTool,
    };
    setSelectedElementId(elementId);
    setSelectedTool("select");
  };

  const restoreAutoSelectedTool = () => {
    if (!autoSelectRef.current) {
      return;
    }

    setSelectedTool(autoSelectRef.current.returnTool);
    autoSelectRef.current = null;
  };

  const submitTextEditor = async () => {
    if (!textEditor) {
      return;
    }

    const trimmedValue = textEditor.value.trim();

    if (!trimmedValue) {
      closeTextEditor();
      return;
    }

    if (textEditor.elementId) {
      const existingElement = elements.find((element) => element.id === textEditor.elementId);

      if (existingElement) {
        const updatedElement: BoardElement = {
          ...existingElement,
          text: trimmedValue,
          fontSize: selectedFontSize,
          color: selectedColor,
          points: [textEditor.position],
        };

        setElements((current) =>
          current.map((element) =>
            element.id === updatedElement.id ? updatedElement : element,
          ),
        );
        setSelectedElementId(updatedElement.id);
        await updateElement(updatedElement);
      }
    } else {
      const returnTool = selectedTool;
      const createdElement = await sendElement({
        kind: "text",
        color: selectedColor,
        width: selectedWidth,
        points: [textEditor.position],
        text: trimmedValue,
        fontSize: selectedFontSize,
        isFilled: false,
      });

      if (createdElement) {
        armAutoSelect(createdElement.id, returnTool);
      }
    }

    closeTextEditor();
  };

  const handlePointerDown = (
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
      const hitElement = findElementAtPoint(point);
      openTextEditor(point, hitElement?.kind === "text" ? hitElement : null);
      return;
    }

    if (selectedTool === "select") {
      const hitElement = findElementAtPoint(point);
      setSelectedElementId(hitElement?.id ?? null);

      if (!hitElement) {
        restoreAutoSelectedTool();
        setSelectedElementId(null);
        setTextEditor(null);
        return;
      }

      if (
        autoSelectRef.current &&
        autoSelectRef.current.elementId !== hitElement.id
      ) {
        restoreAutoSelectedTool();
        return;
      }

      dragRef.current = {
        elementId: hitElement.id,
        pointerId: event.pointerId,
        origin: point,
        baseElement: hitElement,
        hasMoved: false,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }

    setTextEditor(null);
    setSelectedElementId(null);
    autoSelectRef.current = null;
    isDrawingRef.current = true;
    updateDraftElement(buildDraftElement(point));
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const point = getCanvasPoint(event);

    if (!point) {
      return;
    }

    const dragState = dragRef.current;

    if (dragState) {
      const deltaX = point.x - dragState.origin.x;
      const deltaY = point.y - dragState.origin.y;

      if (!dragState.hasMoved && Math.hypot(deltaX, deltaY) < 3) {
        return;
      }

      dragState.hasMoved = true;
      const movedElement = translateElement(dragState.baseElement, deltaX, deltaY);

      setElements((current) =>
        current.map((element) => (element.id === movedElement.id ? movedElement : element)),
      );
      return;
    }

    if (!isDrawingRef.current) {
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

  const finishInteraction = async (
    event?: React.PointerEvent<HTMLCanvasElement>,
  ) => {
    const point = event ? getCanvasPoint(event) : null;

    if (dragRef.current) {
      const dragState = dragRef.current;
      dragRef.current = null;

      if (!dragState.hasMoved) {
        return;
      }

      const currentPoint = point ?? dragState.origin;
      const movedElement = translateElement(
        dragState.baseElement,
        currentPoint.x - dragState.origin.x,
        currentPoint.y - dragState.origin.y,
      );

      await updateElement(movedElement);

      if (autoSelectRef.current?.elementId === movedElement.id) {
        setSelectedTool(autoSelectRef.current.returnTool);
        autoSelectRef.current = null;
      }

      return;
    }

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

    if (
      shapeTools.includes(currentDraft.kind) &&
      currentDraft.points.length >= 2 &&
      Math.hypot(
        currentDraft.points[currentDraft.points.length - 1]!.x - currentDraft.points[0]!.x,
        currentDraft.points[currentDraft.points.length - 1]!.y - currentDraft.points[0]!.y,
      ) < 3
    ) {
      updateDraftElement(null);
      return;
    }

    updateDraftElement(null);
    const returnTool = selectedTool;
    const createdElement = await sendElement(currentDraft);

    if (
      createdElement &&
      createdElement.kind !== "eraser" &&
      createdElement.kind !== "pen"
    ) {
      armAutoSelect(createdElement.id, returnTool);
    }
  };

  const clearBoard = async () => {
    if (!connectionRef.current) {
      return;
    }

    try {
      await connectionRef.current.invoke("ClearBoard", roomId);
      setSelectedElementId(null);
      setTextEditor(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to clear the board.",
      );
    }
  };

  const deleteSelectedElement = async () => {
    if (!connectionRef.current || !selectedElement) {
      return;
    }

    const elementId = selectedElement.id;

    setElements((current) => current.filter((element) => element.id !== elementId));
    setSelectedElementId(null);
    autoSelectRef.current = null;

    try {
      await connectionRef.current.invoke("DeleteBoardElement", roomId, elementId);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to delete the selected element.",
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
    selectedTool === "select"
      ? "Click an item to select it, then drag to move it around the board."
      : selectedTool === "text"
        ? "Click on the board to open an inline text editor, or click existing text to edit it."
        : selectedTool === "pen" || selectedTool === "eraser"
          ? "Drag on the board to draw."
          : "Drag on the board to place the selected shape.";

  const editorStyle = useMemo(() => {
    if (!textEditor || !boardRef.current) {
      return null;
    }

    return {
      left: `${Math.max(textEditor.position.x, 12)}px`,
      top: `${Math.max(textEditor.position.y, 12)}px`,
      color: selectedColor,
      fontSize: `${selectedFontSize}px`,
    };
  }, [selectedColor, selectedFontSize, textEditor]);

  const selectedElementMeta = useMemo(() => {
    if (!selectedElement || !canvasRef.current) {
      return null;
    }

    return getElementBounds(canvasRef.current, selectedElement);
  }, [selectedElement]);

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

          {selectedElement ? (
            <p className="helper-text">
              Selected: <strong>{selectedElement.kind}</strong>
            </p>
          ) : null}
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
          <div className="workspace-actions">
            <button
              className="secondary"
              onClick={() => setShowCodeEditor((current) => !current)}
            >
              {showCodeEditor ? "Hide code editor" : "Open code editor"}
            </button>
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
        </div>

        <div className={showCodeEditor ? "workspace-body split" : "workspace-body"}>
          <div className="board" ref={boardRef}>
            <canvas
              ref={canvasRef}
              className={`board-canvas tool-${selectedTool}`}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={(event) => void finishInteraction(event)}
              onPointerLeave={(event) => void finishInteraction(event)}
            />

            {selectedElementMeta ? (
              <div
                className="selection-toolbar"
                style={{
                  left: `${selectedElementMeta.x}px`,
                  top: `${Math.max(selectedElementMeta.y - 34, 8)}px`,
                }}
              >
                <div className="selection-chip">Drag to move</div>
                <button
                  className="selection-delete"
                  onClick={() => void deleteSelectedElement()}
                  aria-label="Delete selected shape"
                  title="Delete"
                >
                  ×
                </button>
              </div>
            ) : null}

            {textEditor && editorStyle ? (
              <div className="text-editor" style={editorStyle}>
                <textarea
                  ref={textAreaRef}
                  value={textEditor.value}
                  onChange={(event) =>
                    setTextEditor((current) =>
                      current
                        ? {
                            ...current,
                            value: event.target.value,
                          }
                        : current,
                    )
                  }
                  onKeyDown={(event) => {
                    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                      event.preventDefault();
                      void submitTextEditor();
                    }
                  }}
                  placeholder="Type your text..."
                />
                <div className="text-editor-actions">
                  <button onClick={() => void submitTextEditor()}>Save</button>
                  <button className="secondary" onClick={closeTextEditor}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          {showCodeEditor ? (
            <section className="code-editor-panel">
              <div className="code-editor-header">
                <div>
                  <p className="eyebrow">Realtime Code</p>
                  <h2>{codeDocument.fileName}</h2>
                </div>
                <div className="code-meta">
                  <span>{codeDocument.language}</span>
                  <span>
                    {codeDocument.lastEditedBy
                      ? `Edited by ${codeDocument.lastEditedBy}`
                      : "Shared document"}
                  </span>
                </div>
              </div>

              <textarea
                className="code-editor-textarea"
                value={codeDocument.content}
                onChange={(event) => {
                  const nextDocument = {
                    ...codeDocument,
                    content: event.target.value,
                    lastEditedBy: displayName.trim() || initialName,
                    updatedAt: new Date().toISOString(),
                  };

                  setCodeDocument(nextDocument);
                  queueCodeDocumentUpdate(nextDocument);
                }}
                spellCheck={false}
              />
            </section>
          ) : null}
        </div>
      </main>
    </div>
  );
}

export default App;
