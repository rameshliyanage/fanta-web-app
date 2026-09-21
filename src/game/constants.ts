import type { BadgeType, Level } from "./types";

export const FIRST_OF_TYPE_POINTS = 15;
export const REPEAT_POINTS = 5;
export const COOLDOWN_MS = 60_000;
export const HOURLY_CAP = 10;
export const HOUR_MS = 60 * 60 * 1000;
export const STORAGE_KEY = "fanta-poc-v1";

export const LEVELS: Level[] = [
  { name: "Fresh", min: 0 },
  { name: "Zesty", min: 15 },
  { name: "Fizzy", min: 40 },
  { name: "Bold", min: 80 },
  { name: "Iconic", min: 140 },
  { name: "Legendary", min: 220 },
  { name: "Fantastic", min: 320 },
];

export const SCAN_LINES = [
  "Fanta-stic person detected",
  "Orange you glad we met?",
  "Flavor found",
  "New Fanta-stic connection",
  "That's the Fanta spirit",
];

export const BADGES: { id: BadgeType; label: string; image: string }[] = [
  { id: "guest", label: "Guest", image: "/badges/guest.png" },
  { id: "delegate", label: "Delegate", image: "/badges/delegate.png" },
  { id: "speaker", label: "Speaker", image: "/badges/speaker.png" },
  { id: "crew", label: "Crew", image: "/badges/crew.png" },
  { id: "official", label: "Official", image: "/badges/official.png" },
];
