import { StrictMode, useCallback, useEffect, useState } from "react";
import { Payoff, type PayoffKind } from "./components/Payoff";
import { loadBoard, previewRank, rankOf } from "./game/board";
import { buzz, playLevel, playMiss, playPlus, playRank, unlockCues } from "./game/cues";
import { canvasJpeg } from "./game/detect";
import { savePhoto } from "./game/photos";
import { applyScan, emptyState } from "./game/scoring";
import { clearState, loadState, saveState } from "./game/storage";
import type { GameState, ScanSuccess } from "./game/types";
import { Contacts } from "./screens/Contacts";
import { Home } from "./screens/Home";
import { HowTo } from "./screens/HowTo";
import { Leaderboard } from "./screens/Leaderboard";
import { Profile } from "./screens/Profile";
import { requestCamera, Scanner } from "./screens/Scanner";
import { Signup } from "./screens/Signup";

type Screen = "signup" | "home" | "scan" | "board" | "profile" | "collection" | "howto";

type Pending = {
  kind: PayoffKind;
  level: number;
  thenLevel: boolean;
  rankUp: boolean;
};

function newPhotoId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `c-${Date.now().toString(36)}-${Math.random().toString(16).slice(2)}`;
}

export default function App() {
  const [state, setState] = useState<GameState>(() => loadState());
  const [screen, setScreen] = useState<Screen>(() => (loadState().name ? "home" : "signup"));
  const [payoff, setPayoff] = useState<Pending | null>(null);
  const [rankPunch, setRankPunch] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraRequest, setCameraRequest] = useState<Promise<MediaStream> | null>(null);
  const [effectsTick, setEffectsTick] = useState(0);

  useEffect(() => {
    saveState(state);
  }, [state]);

  useEffect(() => {
    if (!rankPunch) return;
    const timer = window.setTimeout(() => setRankPunch(false), 900);
    return () => window.clearTimeout(timer);
  }, [rankPunch]);

  function start(name: string) {
    setState({ ...emptyState(), name });
    setScreen("home");
  }

  function reset() {
    clearState();
    setState(loadState());
    setPayoff(null);
    setRankPunch(false);
    setError(null);
    setScreen("signup");
  }

  function openScan() {
    unlockCues();
    const request = requestCamera();
    request.catch(() => {});
    setCameraRequest(request);
    setError(null);
    setScreen("scan");
  }

  function showResult(draft: ScanSuccess, rankAfter: number) {
    const rankUp = draft.isNew && rankAfter < draft.rankBefore;
    if (draft.isNew) {
      playPlus();
      buzz(40);
      setPayoff({ kind: "plus", level: draft.toLevel.number, thenLevel: draft.leveledUp, rankUp });
      return;
    }
    playMiss();
    buzz(12);
    setPayoff({ kind: "miss", level: draft.fromLevel.number, thenLevel: false, rankUp: false });
  }

  async function accept(canvas: HTMLCanvasElement, code: string) {
    const rankBefore = rankOf(loadBoard(), state.playerId);
    const existing = state.collected.find((contact) => contact.code === code);
    if (existing) {
      showResult(applyScan(state, code, existing.photoId, "", rankBefore, rankBefore), rankBefore);
      return;
    }
    const blob = await canvasJpeg(canvas);
    const photoId = newPhotoId();
    await savePhoto(photoId, blob);
    const draft = applyScan(state, code, photoId, "", rankBefore, rankBefore);
    const rankAfter = previewRank(draft.state);
    setState(draft.state);
    showResult(draft, rankAfter);
  }

  const finishPayoff = useCallback(() => {
    if (!payoff) return;
    if (payoff.kind === "plus" && payoff.thenLevel) {
      playLevel();
      buzz([30, 40, 30, 40, 80]);
      setPayoff({ ...payoff, kind: "level", thenLevel: false });
      return;
    }
    if (payoff.rankUp) {
      playRank();
      buzz(25);
      setRankPunch(true);
    }
    setScreen("home");
    setPayoff(null);
  }, [payoff]);

  const editContact = useCallback((code: string, name: string, company: string) => {
    setState((current) => ({
      ...current,
      collected: current.collected.map((contact) =>
        contact.code === code ? { ...contact, name, company } : contact,
      ),
    }));
  }, []);

  const rank = previewRank(state);

  return (
    <div className="shell">
      <div key={screen} className="stage">
        {screen === "signup" ? <Signup onStart={start} /> : null}
        {screen === "home" ? (
          <Home
            state={state}
            rank={rank}
            rankPunch={rankPunch}
            onScan={openScan}
            onHowTo={() => setScreen("howto")}
            onBoard={() => setScreen("board")}
            onSquad={() => setScreen("collection")}
            onProfile={() => setScreen("profile")}
          />
        ) : null}
        {screen === "howto" ? <HowTo onBack={() => setScreen("home")} /> : null}
        {screen === "board" ? <Leaderboard state={state} onBack={() => setScreen("home")} /> : null}
        {screen === "profile" ? (
          <Profile
            state={state}
            effectsTick={effectsTick}
            onEffects={() => setEffectsTick((n) => n + 1)}
            onBack={() => setScreen("home")}
            onReset={reset}
          />
        ) : null}
        {screen === "collection" ? (
          <Contacts state={state} onChange={editContact} onBack={() => setScreen("home")} />
        ) : null}
        {screen === "scan" ? (
          <Scanner
            onAccept={(canvas, code) => void accept(canvas, code)}
            onBack={() => setScreen("home")}
            error={error}
            cameraRequest={cameraRequest}
          />
        ) : null}
      </div>
      {payoff ? <Payoff kind={payoff.kind} level={payoff.level} onDone={finishPayoff} /> : null}
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
