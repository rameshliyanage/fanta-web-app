import { useState, type FormEvent } from "react";
import { FantaMark } from "../components/FantaMark";
import { unlockCues } from "../game/cues";

export function Signup({ onStart }: { onStart: (name: string) => void }) {
  const [name, setName] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    unlockCues();
    onStart(trimmed);
  }

  return (
    <div className="screen signup">
      <div className="squad-hero" aria-hidden="true">
        <p>BUILD YOUR</p>
        <p>FANTA-STIC</p>
        <p>SQUAD</p>
      </div>
      <form onSubmit={handleSubmit}>
        <label htmlFor="player-name">What should we call you?</label>
        <input
          id="player-name"
          autoComplete="nickname"
          placeholder="YOUR NAME"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={24}
        />
        <p className="name-note">Shown on the leaderboard. Saved on this phone only.</p>
        <button type="submit" className="primary" disabled={!name.trim()}>
          LET’S GO
        </button>
      </form>
      <FantaMark size="lg" />
    </div>
  );
}
