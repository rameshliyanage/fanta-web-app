import { BADGES } from "../game/constants";
import type { BadgeType } from "../game/types";

export function Collection({ collected }: { collected: BadgeType[] }) {
  return (
    <section className="collection" aria-label="Badge collection">
      <div className="collection-head">
        <h2>Collection</h2>
        <span>
          {collected.length}/{BADGES.length} types
        </span>
      </div>
      <div className="collection-grid">
        {BADGES.map((badge) => {
          const got = collected.includes(badge.id);
          return (
            <article key={badge.id} className={got ? "got" : "locked"}>
              <img src={badge.image} alt={badge.label} />
              <span>{got ? badge.label : "???"}</span>
            </article>
          );
        })}
      </div>
    </section>
  );
}
