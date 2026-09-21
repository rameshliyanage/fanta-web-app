import {
  COOLDOWN_MS,
  FIRST_OF_TYPE_POINTS,
  HOUR_MS,
  HOURLY_CAP,
  LEVELS,
  REPEAT_POINTS,
  SCAN_LINES,
} from "./constants";
import type {
  BadgeType,
  GameState,
  Level,
  ScanResult,
} from "./types";

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
    lastScanAt: null,
    scanTimestamps: [],
    lineIndex: 0,
  };
}

export function getLevel(points: number): Level {
  let current = LEVELS[0];
  for (const level of LEVELS) {
    if (points >= level.min) current = level;
  }
  return current;
}

export function getLevelIndex(points: number): number {
  let index = 0;
  for (let i = 0; i < LEVELS.length; i += 1) {
    if (points >= LEVELS[i].min) index = i;
  }
  return index;
}

export function getBar(points: number) {
  const index = getLevelIndex(points);
  const current = LEVELS[index];
  const next = LEVELS[index + 1];
  if (!next) {
    return {
      current,
      next: null,
      inBand: 0,
      need: 0,
      fill: 1,
      isMax: true,
    };
  }
  const need = next.min - current.min;
  const inBand = points - current.min;
  return {
    current,
    next,
    inBand,
    need,
    fill: Math.min(1, inBand / need),
    isMax: false,
  };
}

export function scansThisHour(state: GameState, now = Date.now()): number {
  return state.scanTimestamps.filter((t) => now - t < HOUR_MS).length;
}

export function cooldownRemaining(state: GameState, now = Date.now()): number {
  if (state.lastScanAt == null) return 0;
  return Math.max(0, COOLDOWN_MS - (now - state.lastScanAt));
}

export function applyScan(state: GameState, type: BadgeType, now = Date.now()): ScanResult {
  const waitMs = cooldownRemaining(state, now);
  if (waitMs > 0) {
    return { ok: false, reason: "cooldown", waitMs };
  }

  const recent = state.scanTimestamps.filter((t) => now - t < HOUR_MS);
  if (recent.length >= HOURLY_CAP) {
    const oldest = recent[0];
    return { ok: false, reason: "cap", waitMs: Math.max(0, HOUR_MS - (now - oldest)) };
  }

  const isFirst = !state.collected.includes(type);
  const pointsAwarded = isFirst ? FIRST_OF_TYPE_POINTS : REPEAT_POINTS;
  const fromLevel = getLevel(state.points);
  const nextState: GameState = {
    ...state,
    points: state.points + pointsAwarded,
    collected: isFirst ? [...state.collected, type] : state.collected,
    lastScanAt: now,
    scanTimestamps: [...recent, now],
    lineIndex: (state.lineIndex + 1) % SCAN_LINES.length,
  };
  const toLevel = getLevel(nextState.points);

  return {
    ok: true,
    type,
    pointsAwarded,
    isFirst,
    line: SCAN_LINES[state.lineIndex],
    leveledUp: toLevel.name !== fromLevel.name,
    fromLevel,
    toLevel,
    state: nextState,
  };
}

export function formatMs(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
