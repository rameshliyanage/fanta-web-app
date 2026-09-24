import { useEffect, useRef, useState, type PointerEvent } from "react";
import { BADGES } from "../game/constants";
import type { BadgeType } from "../game/types";
import { LockedBadge } from "./BadgeSlot";

export function Collection({
  collected,
  freshId = null,
}: {
  collected: BadgeType[];
  freshId?: BadgeType | null;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; x: number; left: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const scroller: HTMLDivElement = el;

    function onWheel(event: WheelEvent) {
      if (scroller.scrollWidth <= scroller.clientWidth + 1) return;
      const delta =
        Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      if (!delta) return;
      event.preventDefault();
      scroller.scrollLeft += delta;
    }

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    if (!freshId || !scrollerRef.current) return;
    const scroller = scrollerRef.current;
    const card = scroller.querySelector<HTMLElement>(`[data-badge="${freshId}"]`);
    if (!card) return;
    const left =
      card.getBoundingClientRect().left -
      scroller.getBoundingClientRect().left +
      scroller.scrollLeft;
    const target = left - (scroller.clientWidth - card.clientWidth) / 2;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    scroller.scrollTo({
      left: Math.max(0, target),
      behavior: reduce ? "auto" : "smooth",
    });
  }, [freshId]);

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch") return;
    const el = event.currentTarget;
    dragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      left: el.scrollLeft,
    };
    el.setPointerCapture(event.pointerId);
    setDragging(true);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.currentTarget.scrollLeft = drag.left - (event.clientX - drag.x);
  }

  function endDrag(event: PointerEvent<HTMLDivElement>) {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragging(false);
  }

  return (
    <section className="collection" aria-label="Badge collection">
      <div className="collection-head">
        <h2>Collection</h2>
        <span>
          {collected.length}/{BADGES.length} types
        </span>
      </div>
      <div
        ref={scrollerRef}
        className={dragging ? "collection-scroller is-dragging" : "collection-scroller"}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div className="collection-grid">
          {BADGES.map((badge) => {
            const got = collected.includes(badge.id);
            const justGot = got && freshId === badge.id;
            return (
              <article
                key={badge.id}
                data-badge={badge.id}
                className={justGot ? "got just-got" : got ? "got" : "locked"}
              >
                {got ? (
                  <img src={badge.image} alt={badge.label} draggable={false} />
                ) : (
                  <LockedBadge image={badge.image} />
                )}
                <span>{got ? badge.label : "???"}</span>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
