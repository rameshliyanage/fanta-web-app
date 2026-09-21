export type BadgeType = "guest" | "delegate" | "crew" | "speaker" | "official";

export type Level = {
  name: string;
  min: number;
};

export type GameState = {
  playerId: string;
  name: string;
  points: number;
  collected: BadgeType[];
  lastScanAt: number | null;
  scanTimestamps: number[];
  lineIndex: number;
};

export type ScanFailure = {
  ok: false;
  reason: "cooldown" | "cap";
  waitMs: number;
};

export type ScanSuccess = {
  ok: true;
  type: BadgeType;
  pointsAwarded: number;
  isFirst: boolean;
  line: string;
  leveledUp: boolean;
  fromLevel: Level;
  toLevel: Level;
  state: GameState;
};

export type ScanResult = ScanFailure | ScanSuccess;
