import type { BoardElement, BoardPoint } from "../types";

type DrawableElement = Pick<
  BoardElement,
  "kind" | "color" | "width" | "points" | "text" | "fontSize" | "isFilled"
>;

function withAlpha(color: string, alpha: number) {
  const normalized = color.trim();

  if (/^#[\da-f]{6}$/i.test(normalized)) {
    const red = Number.parseInt(normalized.slice(1, 3), 16);
    const green = Number.parseInt(normalized.slice(3, 5), 16);
    const blue = Number.parseInt(normalized.slice(5, 7), 16);
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }

  return color;
}

function getStartAndEnd(points: BoardPoint[]) {
  const start = points[0];
  const end = points[points.length - 1] ?? start;

  if (!start || !end) {
    return null;
  }

  return { start, end };
}

function drawFreehand(
  context: CanvasRenderingContext2D,
  element: Pick<BoardElement, "points" | "color" | "width" | "kind">,
) {
  if (element.points.length === 0) {
    return;
  }

  context.save();
  context.beginPath();
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = element.width;
  context.strokeStyle = element.kind === "eraser" ? "#000000" : element.color;
  context.globalCompositeOperation =
    element.kind === "eraser" ? "destination-out" : "source-over";

  const [firstPoint, ...restPoints] = element.points;
  context.moveTo(firstPoint.x, firstPoint.y);

  for (const point of restPoints) {
    context.lineTo(point.x, point.y);
  }

  if (element.points.length === 1) {
    context.lineTo(firstPoint.x + 0.01, firstPoint.y + 0.01);
  }

  context.stroke();
  context.restore();
}

function drawLineLike(
  context: CanvasRenderingContext2D,
  element: Pick<BoardElement, "points" | "color" | "width" | "kind">,
) {
  const coordinates = getStartAndEnd(element.points);

  if (!coordinates) {
    return;
  }

  const { start, end } = coordinates;
  context.save();
  context.beginPath();
  context.lineCap = "round";
  context.lineJoin = "round";
  context.strokeStyle = element.color;
  context.lineWidth = element.width;
  context.moveTo(start.x, start.y);
  context.lineTo(end.x, end.y);
  context.stroke();

  if (element.kind === "arrow") {
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    const headLength = Math.max(12, element.width * 3);

    context.beginPath();
    context.moveTo(end.x, end.y);
    context.lineTo(
      end.x - headLength * Math.cos(angle - Math.PI / 6),
      end.y - headLength * Math.sin(angle - Math.PI / 6),
    );
    context.moveTo(end.x, end.y);
    context.lineTo(
      end.x - headLength * Math.cos(angle + Math.PI / 6),
      end.y - headLength * Math.sin(angle + Math.PI / 6),
    );
    context.stroke();
  }

  context.restore();
}

function drawRectangleOrEllipse(
  context: CanvasRenderingContext2D,
  element: Pick<BoardElement, "points" | "color" | "width" | "kind" | "isFilled">,
) {
  const coordinates = getStartAndEnd(element.points);

  if (!coordinates) {
    return;
  }

  const { start, end } = coordinates;
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  const width = Math.abs(end.x - start.x);
  const height = Math.abs(end.y - start.y);

  context.save();
  context.lineWidth = element.width;
  context.strokeStyle = element.color;
  context.fillStyle = withAlpha(element.color, 0.18);
  context.beginPath();

  if (element.kind === "ellipse") {
    context.ellipse(
      x + width / 2,
      y + height / 2,
      Math.max(width / 2, 0.5),
      Math.max(height / 2, 0.5),
      0,
      0,
      Math.PI * 2,
    );
  } else {
    context.rect(x, y, width, height);
  }

  if (element.isFilled) {
    context.fill();
  }

  context.stroke();
  context.restore();
}

function drawText(
  context: CanvasRenderingContext2D,
  element: Pick<BoardElement, "points" | "color" | "text" | "fontSize">,
) {
  const anchor = element.points[0];

  if (!anchor || !element.text) {
    return;
  }

  context.save();
  context.fillStyle = element.color;
  context.font = `${element.fontSize}px "Segoe UI", sans-serif`;
  context.textBaseline = "top";

  const lines = element.text.split(/\r?\n/);
  lines.forEach((line, index) => {
    context.fillText(line, anchor.x, anchor.y + index * (element.fontSize + 6));
  });

  context.restore();
}

function drawElement(context: CanvasRenderingContext2D, element: DrawableElement) {
  switch (element.kind) {
    case "pen":
    case "eraser":
      drawFreehand(context, element);
      return;
    case "line":
    case "arrow":
      drawLineLike(context, element);
      return;
    case "rectangle":
    case "ellipse":
      drawRectangleOrEllipse(context, element);
      return;
    case "text":
      drawText(context, element);
      return;
    default:
      return;
  }
}

export function redrawCanvas(
  canvas: HTMLCanvasElement,
  elements: BoardElement[],
  draftElement: DrawableElement | null,
) {
  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  context.save();
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.restore();

  for (const element of elements) {
    drawElement(context, element);
  }

  if (draftElement) {
    drawElement(context, draftElement);
  }
}
