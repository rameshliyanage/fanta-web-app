import { FantaMark } from "../components/FantaMark";
import { PRIZE_LOCATION, PRIZE_TIME } from "../game/constants";

const STEPS = [
  {
    title: "SCAN A BADGE",
    body: "Tap Scan a badge and point your camera at the QR code on another visitor’s event badge.",
  },
  {
    title: "THEY JOIN YOUR SQUAD",
    body: "Every new person you scan is added to your Fanta-stic squad.",
  },
  {
    title: "COLLECT POINTS",
    body: "Each unique person = +10 pts. Scanning the same person twice doesn’t count.",
  },
  {
    title: "LEVEL UP",
    body: "Every 5 new squad members moves you up a level: 1, 2, 3, 4...",
  },
  {
    title: "TOP THE LEADERBOARD",
    body: `The top players win prizes. Collect yours at ${PRIZE_LOCATION} by ${PRIZE_TIME}.`,
  },
];

export function HowTo({ onBack }: { onBack: () => void }) {
  return (
    <div className="screen howto">
      <header className="topbar">
        <FantaMark size="sm" align="left" />
        <button type="button" className="pill" onClick={onBack}>
          <span aria-hidden="true">‹</span> Back
        </button>
      </header>
      <h1>HOW TO PLAY</h1>
      <ol className="howto-list">
        {STEPS.map((step, index) => (
          <li key={step.title}>
            <span>{index + 1}</span>
            <div>
              <strong>{step.title}</strong>
              <p>{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
