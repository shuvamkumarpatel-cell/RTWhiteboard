import type { Stroke, StrokePoint } from "../types";

function drawStrokePath(
  context: CanvasRenderingContext2D,
  stroke: Pick<Stroke, "points" | "color" | "width">,
) {
  if (stroke.points.length === 0) {
    return;
  }

  context.beginPath();
  context.lineCap = "round";
  context.lineJoin = "round";
  context.strokeStyle = stroke.color;
  context.lineWidth = stroke.width;

  const [firstPoint, ...restPoints] = stroke.points;
  context.moveTo(firstPoint.x, firstPoint.y);

  for (const point of restPoints) {
    context.lineTo(point.x, point.y);
  }

  if (stroke.points.length === 1) {
    context.lineTo(firstPoint.x + 0.01, firstPoint.y + 0.01);
  }

  context.stroke();
}

export function redrawCanvas(
  canvas: HTMLCanvasElement,
  strokes: Stroke[],
  draftStroke: { color: string; width: number; points: StrokePoint[] } | null,
) {
  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  context.clearRect(0, 0, canvas.width, canvas.height);

  for (const stroke of strokes) {
    drawStrokePath(context, stroke);
  }

  if (draftStroke) {
    drawStrokePath(context, draftStroke);
  }
}
