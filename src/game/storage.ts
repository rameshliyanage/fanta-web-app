import { removeFromBoard, upsertBoard } from "./board";
import { STORAGE_KEY } from "./constants";
import { clearPhotos } from "./photos";
import { emptyState } from "./scoring";
import type { Contact, GameState } from "./types";

export function loadState(): GameState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<GameState>;
    return {
      ...emptyState(),
      ...parsed,
      playerId: parsed.playerId || emptyState().playerId,
      collected: Array.isArray(parsed.collected) ? parsed.collected.filter(isContact) : [],
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

function isContact(value: unknown): value is Contact {
  if (!value || typeof value !== "object") return false;
  const contact = value as Partial<Contact>;
  return typeof contact.code === "string" && typeof contact.photoId === "string";
}

export function clearState() {
  let playerId = "";
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) playerId = (JSON.parse(raw) as { playerId?: string }).playerId ?? "";
  } catch {
    playerId = "";
  }
  localStorage.removeItem(STORAGE_KEY);
  if (playerId) removeFromBoard(playerId);
  void clearPhotos();
}
