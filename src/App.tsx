import { StrictMode, useEffect, useState } from "react";
import { LevelUp } from "./components/LevelUp";
import { ScanHit } from "./components/ScanHit";
import { applyScan, emptyState } from "./game/scoring";
import { clearState, loadState, saveState } from "./game/storage";
import type { BadgeType, GameState, ScanSuccess } from "./game/types";
import { Home } from "./screens/Home";
import { Leaderboard } from "./screens/Leaderboard";
import { Scanner } from "./screens/Scanner";
import { Signup } from "./screens/Signup";

type Screen = "signup" | "home" | "scan" | "board";

export default function App() {
  const [state, setState] = useState<GameState>(() => loadState());
  const [screen, setScreen] = useState<Screen>(() =>
    loadState().name ? "home" : "signup",
  );
  const [hit, setHit] = useState<ScanSuccess | null>(null);
  const [pendingLevelUp, setPendingLevelUp] = useState<ScanSuccess | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    saveState(state);
  }, [state]);

  function start(name: string) {
    setState({ ...emptyState(), name });
    setScreen("home");
  }

  function reset() {
    clearState();
    const fresh = loadState();
    setState(fresh);
    setHit(null);
    setPendingLevelUp(null);
    setError(null);
    setScreen("signup");
  }

  function pick(type: BadgeType) {
    const result = applyScan(state, type);
    if (!result.ok) {
      setError(
        result.reason === "cooldown"
          ? "Too soon — wait out the cooldown."
          : "Hourly cap reached. Take a sip, then scan again.",
      );
      return;
    }
    setError(null);
    setState(result.state);
    setHit(result);
  }

  function finishHit() {
    if (hit?.leveledUp) setPendingLevelUp(hit);
    setHit(null);
    setScreen("home");
  }

  return (
    <div className="shell">
      {screen === "signup" ? <Signup onStart={start} /> : null}
      {screen === "home" ? (
        <Home
          state={state}
          onScan={() => setScreen("scan")}
          onBoard={() => setScreen("board")}
          onReset={reset}
        />
      ) : null}
      {screen === "board" ? (
        <Leaderboard state={state} onBack={() => setScreen("home")} />
      ) : null}
      {screen === "scan" ? (
        <Scanner
          state={state}
          onPick={pick}
          onBack={() => setScreen("home")}
          error={error}
        />
      ) : null}
      {hit ? <ScanHit hit={hit} onDone={finishHit} /> : null}
      {pendingLevelUp && !hit ? (
        <LevelUp
          from={pendingLevelUp.fromLevel}
          to={pendingLevelUp.toLevel}
          onDone={() => setPendingLevelUp(null)}
        />
      ) : null}
    </div>
  );
}

export function Root() {
  return (
    <StrictMode>
      <App />
    </StrictMode>
  );
}
