import { NEW_PERSON_POINTS, PEOPLE_PER_LEVEL } from "./constants";
import type { Contact, GameState, Level, ScanSuccess } from "./types";

function newId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `p-${Date.now().toString(36)}-${Math.random().toString(16).slice(2)}`;
}

export function emptyState(): GameState {
  return {
    playerId: newId(),
    name: "",
    points: 0,
    collected: [],
    lineIndex: 0,
  };
}

export function levelNumber(count: number): number {
  return 1 + Math.floor(Math.max(0, count) / PEOPLE_PER_LEVEL);
}

export function getLevel(count: number): Level {
  const number = levelNumber(count);
  return { number, name: `Level ${number}` };
}

export function levelWindow(level: number): number[] {
  const start = level <= 3 ? 1 : level - 2;
  return [0, 1, 2, 3, 4].map((offset) => start + offset);
}

export function getSquad(count: number) {
  const level = levelNumber(count);
  const bandStart = (level - 1) * PEOPLE_PER_LEVEL;
  const inBand = count - bandStart;
  return {
    level,
    nextLevel: level + 1,
    fill: inBand / PEOPLE_PER_LEVEL,
    scansLeft: PEOPLE_PER_LEVEL - inBand,
    window: levelWindow(level),
  };
}

export function applyScan(
  state: GameState,
  code: string,
  photoId: string,
  photoUrl: string,
  rankBefore: number,
  rankAfter: number,
  now = Date.now(),
): ScanSuccess {
  const existing = state.collected.find((contact) => contact.code === code);
  const fromLevel = getLevel(state.collected.length);
  if (existing) {
    return {
      ok: true,
      code,
      name: existing.name,
      company: existing.company,
      photoId: existing.photoId,
      photoUrl,
      pointsAwarded: 0,
      isNew: false,
      leveledUp: false,
      fromLevel,
      toLevel: fromLevel,
      rankBefore,
      rankAfter: rankBefore,
      state,
    };
  }

  const contact: Contact = {
    code,
    name: "",
    company: "",
    photoId,
    capturedAt: now,
    pointsAwarded: NEW_PERSON_POINTS,
  };
  const nextState: GameState = {
    ...state,
    points: state.points + NEW_PERSON_POINTS,
    collected: [contact, ...state.collected],
  };
  const toLevel = getLevel(nextState.collected.length);
  return {
    ok: true,
    code,
    name: "",
    company: "",
    photoId,
    photoUrl,
    pointsAwarded: NEW_PERSON_POINTS,
    isNew: true,
    leveledUp: toLevel.number !== fromLevel.number,
    fromLevel,
    toLevel,
    rankBefore,
    rankAfter,
    state: nextState,
  };
}
