import { useEffect } from "react";
import { levelWindow } from "../game/scoring";

export type PayoffKind = "plus" | "miss" | "level";

export function Payoff({
  kind,
  level,
  onDone,
}: {
  kind: PayoffKind;
  level: number;
  onDone: () => void;
}) {
  useEffect(() => {
    const timer = window.setTimeout(onDone, kind === "level" ? 1700 : 1100);
    return () => window.clearTimeout(timer);
  }, [kind, onDone]);

  if (kind === "miss") {
    return (
      <div className="payoff payoff-miss" role="status">
        <p>Already in your squad</p>
      </div>
    );
  }

  if (kind === "level") {
    const chips = levelWindow(level);
    return (
      <div className="payoff payoff-level" role="status">
        <p>LEVEL UP</p>
        <h1>LEVEL {level}</h1>
        <div className="level-chips">
          {chips.map((n, index) => (
            <span key={n} className={n === level ? "chip is-on" : "chip"} style={{ animationDelay: `${index * 80}ms` }}>
              {n}
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="payoff payoff-plus" role="status">
      <p>+10</p>
      <span>NEW SQUAD MEMBER</span>
    </div>
  );
}
