export type BoardPoint = {
  x: number;
  y: number;
};

export type BoardTool =
  | "select"
  | "pen"
  | "eraser"
  | "line"
  | "arrow"
  | "rectangle"
  | "ellipse"
  | "text";

export type BoardElement = {
  id: string;
  userId: string;
  kind: BoardTool;
  color: string;
  width: number;
  points: BoardPoint[];
  text?: string | null;
  fontSize: number;
  isFilled: boolean;
  createdAt: string;
};

export type Participant = {
  userId: string;
  name: string;
  connectionId: string;
  joinedAt: string;
};

export type CodeDocument = {
  fileName: string;
  language: string;
  content: string;
  lastEditedBy?: string | null;
  updatedAt: string;
};

export type RoomState = {
  roomId: string;
  elements: BoardElement[];
  codeDocument: CodeDocument;
  participants: Participant[];
  updatedAt: string;
};
