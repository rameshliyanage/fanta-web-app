import { FantaMark } from "../components/FantaMark";
import { getSquad } from "../game/scoring";
import type { GameState } from "../game/types";

function ScanMark() {
  return (
    <svg className="scan-mark" viewBox="0 0 48 48" aria-hidden="true">
      <path d="M8 18V10h8M40 18V10h-8M8 30v8h8M40 30v8h-8M14 24h20" />
    </svg>
  );
}

export function Home({
  state,
  rank,
  rankPunch,
  onScan,
  onHowTo,
  onBoard,
  onSquad,
  onProfile,
}: {
  state: GameState;
  rank: number;
  rankPunch: boolean;
  onScan: () => void;
  onHowTo: () => void;
  onBoard: () => void;
  onSquad: () => void;
  onProfile: () => void;
}) {
  const count = state.collected.length;
  const squad = getSquad(count);
  const empty = count === 0;

  return (
    <div className="screen home">
      <header className="topbar">
        <button type="button" className="mark-btn" onClick={onProfile} aria-label="Profile">
          <FantaMark size="sm" align="left" />
        </button>
        <button type="button" className="pill" onClick={onHowTo}>
          <span aria-hidden="true">?</span> How to play
        </button>
      </header>

      {empty ? (
        <div className="empty-copy">
          <p>Hey {state.name},</p>
          <h1>YOUR SQUAD IS EMPTY</h1>
        </div>
      ) : (
        <section className="stats-card" aria-label="Squad progress">
          <div className="stats-top">
            <div>
              <p>Total points</p>
              <strong className="points">{state.points}</strong>
            </div>
            <button type="button" className="squad-count" onClick={onSquad}>
              <span>Squad</span>
              <strong>{count} {count === 1 ? "person" : "people"}</strong>
            </button>
          </div>
          <div className="level-labels">
            <span>LEVEL {squad.level}</span>
            <span>LEVEL {squad.nextLevel}</span>
          </div>
          <div className="level-track" aria-hidden="true">
            <div className="level-fill" style={{ width: `${squad.fill * 100}%` }} />
          </div>
          <div className="level-meta">
            <span>{state.points} pts</span>
            <span>
              {squad.scansLeft} more {squad.scansLeft === 1 ? "scan" : "scans"} to Level {squad.nextLevel}
            </span>
          </div>
          <div className="level-chips" aria-label={`Level ${squad.level}`}>
            {squad.window.map((n) => (
              <span key={n} className={n === squad.level ? "chip is-on" : "chip"}>
                {n}
              </span>
            ))}
          </div>
        </section>
      )}

      <button type="button" className="scan-card" onClick={onScan}>
        <ScanMark />
        <strong>SCAN A BADGE</strong>
        <span>
          {empty ? "to add the first member to your squad!" : "+10 pts for every new person"}
        </span>
      </button>

      {empty ? (
        <section className="lvl-card">
          <p>
            <span>LVL</span>
            <strong>1</strong>
          </p>
          <span>Scan 5 people to reach Level 2. Top of the leaderboard wins prizes.</span>
        </section>
      ) : (
        <button
          type="button"
          className={rankPunch ? "rank-banner is-punch" : "rank-banner"}
          onClick={onBoard}
        >
          You’re #{rank} on the leaderboard <span aria-hidden="true">→</span>
        </button>
      )}
    </div>
  );
}
