import { getBar } from "../game/scoring";

export function FantasticBar({ points }: { points: number }) {
  const bar = getBar(points);

  return (
    <section className="fantastic-bar" aria-label="Fantastic bar">
      <div className="bar-meta">
        <strong>Fantastic bar</strong>
        {bar.isMax ? (
          <span>MAX</span>
        ) : (
          <span>
            {bar.inBand} / {bar.need} to {bar.next?.name}
          </span>
        )}
      </div>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${bar.fill * 100}%` }} />
        <div className="bar-bubbles" />
      </div>
    </section>
  );
}
