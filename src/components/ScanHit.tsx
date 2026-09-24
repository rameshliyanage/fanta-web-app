import { useEffect, useState } from "react";
import { BADGES, FIRST_OF_TYPE_POINTS } from "../game/constants";
import type { ScanSuccess } from "../game/types";
import { UnlockBadge } from "./BadgeSlot";
import { FantaMark } from "./FantaMark";

type UnlockPhase = "locked" | "opening" | "revealed";

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function ScanHit({
  hit,
  onDone,
}: {
  hit: ScanSuccess;
  onDone: () => void;
}) {
  const badge = BADGES.find((b) => b.id === hit.type);
  const playUnlock = hit.isFirst && !prefersReducedMotion();
  const [phase, setPhase] = useState<UnlockPhase>(playUnlock ? "locked" : "revealed");
  const showPayoff = phase === "revealed";

  useEffect(() => {
    if (!playUnlock) return;
    const openingTimer = window.setTimeout(() => setPhase("opening"), 520);
    const revealTimer = window.setTimeout(() => setPhase("revealed"), 1100);
    return () => {
      window.clearTimeout(openingTimer);
      window.clearTimeout(revealTimer);
    };
  }, [playUnlock]);

  return (
    <div className="overlay hit" role="dialog" aria-labelledby="hit-line">
      <div className="burst" />
      <div className="bubbles" aria-hidden="true">
        {Array.from({ length: 12 }, (_, i) => (
          <i key={i} style={{ ["--i" as string]: i }} />
        ))}
      </div>
      <FantaMark size="lg" />
      <p id="hit-line" className="hit-line">
        {hit.line}
      </p>
      {badge && playUnlock ? (
        <UnlockBadge image={badge.image} alt={badge.label} phase={phase} />
      ) : badge ? (
        <img className="hit-badge" src={badge.image} alt={badge.label} />
      ) : null}
      <p className={showPayoff ? "hit-type land" : "hit-type is-waiting"}>{badge?.label} pass</p>
      <p
        className={`hit-points ${hit.isFirst ? "bonus" : ""} ${showPayoff ? "land" : "is-waiting"}`}
      >
        +{hit.pointsAwarded}
        {hit.isFirst ? ` first ${badge?.label}` : ""}
      </p>
      {hit.isFirst ? (
        <p className={showPayoff ? "hit-note land" : "hit-note is-waiting"}>
          First of this type · +{FIRST_OF_TYPE_POINTS}
        </p>
      ) : null}
      <button type="button" className="primary" onClick={onDone}>
        Keep scanning
      </button>
    </div>
  );
}
