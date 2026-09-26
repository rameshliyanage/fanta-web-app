import { loadBoard, rankOf } from "../game/board";
import type { GameState } from "../game/types";

export function Leaderboard({
  state,
  onBack,
}: {
  state: GameState;
  onBack: () => void;
}) {
  const rows = loadBoard().slice(0, 20);
  const rank = rankOf(loadBoard(), state.playerId);

  return (
    <div className="screen board">
      <header className="topbar">
        <button type="button" className="pill" onClick={onBack}>
          <span aria-hidden="true">‹</span> Back
        </button>
      </header>
      <h1>LEADERBOARD</h1>
      <p className="lede">
        You’re #{rank} with {state.points} pts · {state.name}
      </p>
      <p className="fine">Saved on this phone only.</p>
      <ol className="board-list">
        {rows.length === 0 ? <li className="empty">No scans yet</li> : null}
        {rows.map((row, index) => (
          <li key={row.id} className={row.id === state.playerId ? "you" : ""}>
            <span className="rank">{index + 1}</span>
            <span className="who">
              {row.name}
              <em>{row.level}</em>
            </span>
            <strong>{row.points}</strong>
          </li>
        ))}
      </ol>
    </div>
  );
}
