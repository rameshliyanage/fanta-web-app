import { upsertBoard } from "./board";
import { STORAGE_KEY } from "./constants";
import { emptyState } from "./scoring";
import type { GameState } from "./types";

export function loadState(): GameState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<GameState>;
    return {
      ...emptyState(),
      ...parsed,
      playerId: parsed.playerId || emptyState().playerId,
      collected: Array.isArray(parsed.collected) ? parsed.collected : [],
      scanTimestamps: Array.isArray(parsed.scanTimestamps) ? parsed.scanTimestamps : [],
    };
  } catch {
    return emptyState();
  }
}

export function saveState(state: GameState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    upsertBoard(state);
  } catch {
    // Private Safari / full storage should not blank the game.
  }
}

export function clearState() {
  localStorage.removeItem(STORAGE_KEY);
}
