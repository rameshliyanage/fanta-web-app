import { useState, type FormEvent } from "react";
import { FantaMark } from "../components/FantaMark";

export function Signup({ onStart }: { onStart: (name: string) => void }) {
  const [name, setName] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onStart(trimmed);
  }

  return (
    <div className="screen signup">
      <FantaMark size="lg" />
      <h1>Fantastic</h1>
      <p className="lede">
        Scan Digital Summit Asia participant badges and fill the Fanta-istic bar!
      </p>
      <form onSubmit={handleSubmit}>
        <label htmlFor="player-name">Your name</label>
        <input
          id="player-name"
          autoComplete="nickname"
          placeholder="What should we call you?"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={24}
        />
        <button type="submit" className="primary" disabled={!name.trim()}>
          Let’s fizz
        </button>
      </form>
      <p className="fine">PoC · no email, no verification</p>
    </div>
  );
}
