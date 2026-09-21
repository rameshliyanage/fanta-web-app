import { getLevel } from "./scoring";
import type { GameState } from "./types";

export const BOARD_KEY = "fanta-poc-board-v1";

export type BoardRow = {
  id: string;
  name: string;
  points: number;
  level: string;
  updatedAt: number;
};

export function loadBoard(): BoardRow[] {
  try {
    const raw = localStorage.getItem(BOARD_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as BoardRow[];
    return parsed.sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

export function upsertBoard(state: GameState) {
  if (!state.name || !state.playerId) return;
  try {
    const rows = loadBoard().filter((row) => row.id !== state.playerId);
    rows.push({
      id: state.playerId,
      name: state.name,
      points: state.points,
      level: getLevel(state.points).name,
      updatedAt: Date.now(),
    });
    localStorage.setItem(BOARD_KEY, JSON.stringify(rows));
  } catch {
    // ignore
  }
}

export function removeFromBoard(playerId: string) {
  const rows = loadBoard().filter((row) => row.id !== playerId);
  localStorage.setItem(BOARD_KEY, JSON.stringify(rows));
}

export function rankOf(rows: BoardRow[], playerId: string): number {
  const index = rows.findIndex((row) => row.id === playerId);
  return index === -1 ? rows.length + 1 : index + 1;
}
