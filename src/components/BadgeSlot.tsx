import type { CSSProperties } from "react";

function LockIcon() {
  return (
    <svg className="lock-icon" viewBox="0 0 64 80" aria-hidden="true">
      <g className="lock-shackle">
        <path
          d="M20 38 V26 a12 12 0 0 1 24 0 V38"
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinecap="round"
        />
      </g>
      <rect x="10" y="36" width="44" height="34" rx="8" fill="currentColor" />
      <circle cx="32" cy="49" r="4.2" className="lock-key" />
      <rect x="29.6" y="50" width="4.8" height="8" rx="1.6" className="lock-key" />
    </svg>
  );
}

export function LockedBadge({ image }: { image: string }) {
  return (
    <div className="badge-frame is-locked">
      <img src={image} alt="" draggable={false} />
      <div className="slot-lock" aria-hidden="true">
        <LockIcon />
      </div>
    </div>
  );
}

export function UnlockBadge({
  image,
  alt,
  phase,
}: {
  image: string;
  alt: string;
  phase: "locked" | "opening" | "revealed";
}) {
  return (
    <div className={`badge-reveal phase-${phase}`}>
      <div className="badge-frame">
        <img src={image} alt={phase === "revealed" ? alt : ""} draggable={false} />
        <div className="slot-shine" aria-hidden="true" />
        <div className="slot-flash" aria-hidden="true" />
        <div className="slot-lock" aria-hidden="true">
          <LockIcon />
        </div>
      </div>
      <div className="slot-ring" aria-hidden="true" />
      <div className="slot-sparks" aria-hidden="true">
        {Array.from({ length: 10 }, (_, i) => (
          <i key={i} style={{ ["--i" as string]: i } as CSSProperties} />
        ))}
      </div>
    </div>
  );
}
