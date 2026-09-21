import type { Level } from "../game/types";

export function LevelUp({
  from,
  to,
  onDone,
}: {
  from: Level;
  to: Level;
  onDone: () => void;
}) {
  return (
    <div className="overlay levelup" role="dialog" aria-labelledby="levelup-title">
      <p className="kicker">Level up</p>
      <h1 id="levelup-title">{to.name}</h1>
      <p className="from-to">
        {from.name} → {to.name}
      </p>
      <button type="button" className="primary" onClick={onDone}>
        Let’s go
      </button>
    </div>
  );
}
