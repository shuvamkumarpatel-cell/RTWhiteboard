export type StrokePoint = {
  x: number;
  y: number;
};

export type Stroke = {
  id: string;
  userId: string;
  color: string;
  width: number;
  points: StrokePoint[];
  createdAt: string;
};

export type Participant = {
  userId: string;
  name: string;
  connectionId: string;
  joinedAt: string;
};

export type RoomState = {
  roomId: string;
  strokes: Stroke[];
  participants: Participant[];
  updatedAt: string;
};
