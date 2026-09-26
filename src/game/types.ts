export type Level = {
  number: number;
  name: string;
};

export type Contact = {
  code: string;
  name: string;
  company: string;
  photoId: string;
  capturedAt: number;
  pointsAwarded: number;
};

export type GameState = {
  playerId: string;
  name: string;
  points: number;
  collected: Contact[];
  lineIndex: number;
};

export type ScanSuccess = {
  ok: true;
  code: string;
  name: string;
  company: string;
  photoId: string;
  photoUrl: string;
  pointsAwarded: number;
  isNew: boolean;
  leveledUp: boolean;
  fromLevel: Level;
  toLevel: Level;
  rankBefore: number;
  rankAfter: number;
  state: GameState;
};

export type ScanResult = ScanSuccess;
