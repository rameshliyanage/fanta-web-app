import { Collection } from "../components/Collection";
import { FantasticBar } from "../components/FantasticBar";
import { FantaMark } from "../components/FantaMark";
import { HOURLY_CAP } from "../game/constants";
import {
  cooldownRemaining,
  formatMs,
  getBar,
  scansThisHour,
} from "../game/scoring";
import type { BadgeType, GameState } from "../game/types";
import { useNow } from "../hooks";

export function Home({
  state,
  onScan,
  onBoard,
  onReset,
  freshBadge = null,
}: {
  state: GameState;
  onScan: () => void;
  onBoard: () => void;
  onReset: () => void;
  freshBadge?: BadgeType | null;
}) {
  const wait = cooldownRemaining(state);
  const now = useNow(wait > 0);
  const remaining = cooldownRemaining(state, now);
  const hourCount = scansThisHour(state, now);
  const bar = getBar(state.points);
  const blocked = remaining > 0 || hourCount >= HOURLY_CAP;

  return (
    <div className="screen home">
      <header>
        <FantaMark size="sm" align="left" />
        <div className="home-id">
          <div>
            <p className="hello">Hey {state.name}</p>
            <h1>{bar.current.name}</h1>
          </div>
          <div className="score-chip" aria-label={`${state.points} points`}>
            <strong>{state.points}</strong>
            <span>pts</span>
          </div>
        </div>
      </header>

      <FantasticBar points={state.points} />
      <Collection collected={state.collected} freshId={freshBadge} />

      {remaining > 0 ? null : hourCount >= HOURLY_CAP ? (
        <p className="status wait">Hourly cap hit · {hourCount}/{HOURLY_CAP}</p>
      ) : (
        <p className="status">
          {hourCount}/{HOURLY_CAP} scans this hour · first of a type is +15
        </p>
      )}

      <div className="home-actions">
        <button
          type="button"
          className={remaining > 0 ? "scan-cta is-cooling" : "scan-cta"}
          onClick={onScan}
          disabled={blocked}
        >
          {remaining > 0
            ? `Cooling your next Fanta move - Wait ${formatMs(remaining)}`
            : "Scan a Participant Badge"}
        </button>
        <button type="button" className="secondary" onClick={onBoard}>
          Leaderboard
        </button>
        {/* Testing only — remove Start over in the final build. */}
        <button type="button" className="text-btn" onClick={onReset}>
          Start over
        </button>
      </div>
    </div>
  );
}
