import type { RoomState } from "../types";

const apiBaseUrl =
  import.meta.env.VITE_API_URL?.replace(/\/$/, "") ?? "http://localhost:5240";

export const endpoints = {
  apiBaseUrl,
  hubUrl: `${apiBaseUrl}/hubs/whiteboard`,
};

export async function createRoom() {
  const response = await fetch(`${apiBaseUrl}/api/rooms`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Unable to create a room.");
  }

  return (await response.json()) as { roomId: string; createdAt: string };
}

export async function fetchRoom(roomId: string) {
  const response = await fetch(`${apiBaseUrl}/api/rooms/${roomId}`);

  if (!response.ok) {
    throw new Error("Unable to load the room.");
  }

  return (await response.json()) as RoomState;
}
