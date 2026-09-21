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
      <button type="button" className="text-btn back" onClick={onBack}>
        ← Home
      </button>
      <h1>Leaderboard</h1>
      <p className="lede">
        You’re #{rank} with {state.points} pts · {state.name}
      </p>
      <p className="fine">This device only until we plug in the live board.</p>
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
