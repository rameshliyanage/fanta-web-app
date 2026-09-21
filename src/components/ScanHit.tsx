import { BADGES, FIRST_OF_TYPE_POINTS } from "../game/constants";
import type { ScanSuccess } from "../game/types";
import { FantaMark } from "./FantaMark";

export function ScanHit({
  hit,
  onDone,
}: {
  hit: ScanSuccess;
  onDone: () => void;
}) {
  const badge = BADGES.find((b) => b.id === hit.type);

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
      {badge ? <img className="hit-badge" src={badge.image} alt={badge.label} /> : null}
      <p className="hit-type">{badge?.label} pass</p>
      <p className={`hit-points ${hit.isFirst ? "bonus" : ""}`}>
        +{hit.pointsAwarded}
        {hit.isFirst ? ` first ${badge?.label}` : ""}
      </p>
      {hit.isFirst ? (
        <p className="hit-note">First of this type · +{FIRST_OF_TYPE_POINTS}</p>
      ) : null}
      <button type="button" className="primary" onClick={onDone}>
        Keep scanning
      </button>
    </div>
  );
}
