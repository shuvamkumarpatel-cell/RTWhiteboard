import type { BoardElement, BoardPoint } from "../types";

type DrawableElement = Pick<
  BoardElement,
  "kind" | "color" | "width" | "points" | "text" | "fontSize" | "isFilled"
>;

type ElementBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

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

function distanceBetweenPoints(start: BoardPoint, end: BoardPoint) {
  return Math.hypot(end.x - start.x, end.y - start.y);
}

function distanceToSegment(point: BoardPoint, start: BoardPoint, end: BoardPoint) {
  const lengthSquared = (end.x - start.x) ** 2 + (end.y - start.y) ** 2;

  if (lengthSquared === 0) {
    return distanceBetweenPoints(point, start);
  }

  const projection =
    ((point.x - start.x) * (end.x - start.x) +
      (point.y - start.y) * (end.y - start.y)) /
    lengthSquared;
  const clamped = Math.max(0, Math.min(1, projection));

  return distanceBetweenPoints(point, {
    x: start.x + clamped * (end.x - start.x),
    y: start.y + clamped * (end.y - start.y),
  });
}

function getTextMetrics(
  context: CanvasRenderingContext2D,
  element: Pick<BoardElement, "text" | "fontSize">,
) {
  const lines = (element.text ?? "").split(/\r?\n/);
  const width = lines.reduce((maxWidth, line) => {
    return Math.max(maxWidth, context.measureText(line || " ").width);
  }, 0);
  const lineHeight = element.fontSize + 6;

  return {
    lineHeight,
    width: Math.max(width, element.fontSize),
    height: Math.max(lineHeight * lines.length, lineHeight),
  };
}

export function getElementBounds(
  canvas: HTMLCanvasElement,
  element: DrawableElement,
): ElementBounds | null {
  const context = canvas.getContext("2d");

  if (!context || element.points.length === 0) {
    return null;
  }

  if (element.kind === "text") {
    const anchor = element.points[0];

    if (!anchor) {
      return null;
    }

    context.save();
    context.font = `${element.fontSize}px "Segoe UI", sans-serif`;
    const metrics = getTextMetrics(context, element);
    context.restore();

    return {
      x: anchor.x,
      y: anchor.y,
      width: metrics.width,
      height: metrics.height,
    };
  }

  const xs = element.points.map((point) => point.x);
  const ys = element.points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const padding = Math.max(element.width, 8);

  return {
    x: minX - padding,
    y: minY - padding,
    width: Math.max(maxX - minX + padding * 2, padding * 2),
    height: Math.max(maxY - minY + padding * 2, padding * 2),
  };
}

function drawSelectionOutline(
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  element: DrawableElement,
) {
  const bounds = getElementBounds(canvas, element);

  if (!bounds) {
    return;
  }

  context.save();
  context.strokeStyle = "#7dd3fc";
  context.fillStyle = "rgba(125, 211, 252, 0.08)";
  context.lineWidth = 1.5;
  context.setLineDash([8, 6]);
  context.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
  context.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
  context.restore();
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

export function translateElement(element: BoardElement, deltaX: number, deltaY: number) {
  return {
    ...element,
    points: element.points.map((point) => ({
      x: point.x + deltaX,
      y: point.y + deltaY,
    })),
  };
}

export function hitTestElement(
  canvas: HTMLCanvasElement,
  element: BoardElement,
  point: BoardPoint,
) {
  if (element.points.length === 0) {
    return false;
  }

  if (element.kind === "eraser") {
    return false;
  }

  const tolerance = Math.max(element.width + 6, 10);

  switch (element.kind) {
    case "pen":
      for (let index = 1; index < element.points.length; index += 1) {
        if (
          distanceToSegment(point, element.points[index - 1], element.points[index]) <=
          tolerance
        ) {
          return true;
        }
      }
      return distanceBetweenPoints(point, element.points[0]) <= tolerance;
    case "line":
    case "arrow": {
      const coordinates = getStartAndEnd(element.points);
      return coordinates
        ? distanceToSegment(point, coordinates.start, coordinates.end) <= tolerance
        : false;
    }
    case "rectangle":
    case "ellipse": {
      const bounds = getElementBounds(canvas, element);

      if (!bounds) {
        return false;
      }

      return (
        point.x >= bounds.x &&
        point.x <= bounds.x + bounds.width &&
        point.y >= bounds.y &&
        point.y <= bounds.y + bounds.height
      );
    }
    case "text": {
      const bounds = getElementBounds(canvas, element);

      if (!bounds) {
        return false;
      }

      return (
        point.x >= bounds.x &&
        point.x <= bounds.x + bounds.width &&
        point.y >= bounds.y &&
        point.y <= bounds.y + bounds.height
      );
    }
    default:
      return false;
  }
}

export function redrawCanvas(
  canvas: HTMLCanvasElement,
  elements: BoardElement[],
  draftElement: DrawableElement | null,
  selectedElementId?: string | null,
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

  if (selectedElementId) {
    const selectedElement = elements.find((element) => element.id === selectedElementId);

    if (selectedElement) {
      drawSelectionOutline(context, canvas, selectedElement);
    }
  }
}
