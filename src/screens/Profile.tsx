import { useState } from "react";
import { effectsOn, setEffectsOn, unlockCues } from "../game/cues";
import { getLevel } from "../game/scoring";
import type { GameState } from "../game/types";

export function Profile({
  state,
  effectsTick,
  onEffects,
  onBack,
  onReset,
}: {
  state: GameState;
  effectsTick: number;
  onEffects: () => void;
  onBack: () => void;
  onReset: () => void;
}) {
  const [on, setOn] = useState(() => effectsOn());
  const level = getLevel(state.collected.length);
  void effectsTick;

  function toggle() {
    const next = !on;
    setOn(next);
    setEffectsOn(next);
    if (next) unlockCues();
    onEffects();
  }

  return (
    <div className="screen profile">
      <header className="topbar">
        <button type="button" className="pill" onClick={onBack}>
          <span aria-hidden="true">‹</span> Back
        </button>
      </header>
      <h1>{state.name}</h1>
      <p className="lede">{level.name}</p>
      <dl className="profile-stats">
        <div>
          <dt>Points</dt>
          <dd>{state.points}</dd>
        </div>
        <div>
          <dt>Squad</dt>
          <dd>{state.collected.length}</dd>
        </div>
      </dl>
      <button type="button" className="primary" onClick={toggle}>
        Sound and vibrate {on ? "on" : "off"}
      </button>
      <button type="button" className="text-btn" onClick={onReset}>
        Start over
      </button>
    </div>
  );
}
