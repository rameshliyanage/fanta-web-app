import { useEffect, useRef, useState, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import type { Contact } from "../game/types";
import { CardView, usePhotoUrl } from "./CardView";

function CardThumb({
  contact,
  fresh,
  onOpen,
}: {
  contact: Contact;
  fresh: boolean;
  onOpen: (contact: Contact) => void;
}) {
  const url = usePhotoUrl(contact.photoId);
  return (
    <button
      type="button"
      data-code={contact.code}
      className={fresh ? "collection-card just-got" : "collection-card"}
      onClick={() => onOpen(contact)}
    >
      <span className="collection-photo">
        {url ? <img src={url} alt="" draggable={false} /> : <span className="thumb-wait" />}
      </span>
      <span className="collection-name">{contact.name || "Add a name"}</span>
      {contact.company ? <span className="collection-company">{contact.company}</span> : null}
    </button>
  );
}

export function Collection({
  collected,
  freshCode = null,
  onSeeAll,
  onChange,
}: {
  collected: Contact[];
  freshCode?: string | null;
  onSeeAll: () => void;
  onChange: (code: string, name: string, company: string) => void;
}) {
  const [open, setOpen] = useState<Contact | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; x: number; left: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const newest = collected.slice(0, 12);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const box: HTMLDivElement = scroller;
    function onWheel(event: WheelEvent) {
      if (box.scrollWidth <= box.clientWidth + 1) return;
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      if (!delta) return;
      event.preventDefault();
      box.scrollLeft += delta;
    }
    box.addEventListener("wheel", onWheel, { passive: false });
    return () => box.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    if (!freshCode || !scrollerRef.current) return;
    const scroller = scrollerRef.current;
    const card = scroller.querySelector<HTMLElement>(`[data-code="${freshCode}"]`);
    if (!card) return;
    const left =
      card.getBoundingClientRect().left - scroller.getBoundingClientRect().left + scroller.scrollLeft;
    const target = left - (scroller.clientWidth - card.clientWidth) / 2;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    scroller.scrollTo({ left: Math.max(0, target), behavior: reduce ? "auto" : "smooth" });
  }, [freshCode]);

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch") return;
    const el = event.currentTarget;
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, left: el.scrollLeft };
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
    <section className="collection" aria-label="People collected">
      <div className="collection-head">
        <h2>Collection</h2>
        {collected.length > 0 ? (
          <button type="button" className="text-btn" onClick={onSeeAll}>
            See all
          </button>
        ) : (
          <span>0 people</span>
        )}
      </div>
      {collected.length === 0 ? (
        <p className="lede">Your first Fantastic person is out there</p>
      ) : (
        <div
          ref={scrollerRef}
          className={dragging ? "collection-scroller is-dragging" : "collection-scroller"}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <div className="collection-grid">
            {newest.map((contact) => (
              <CardThumb
                key={contact.code}
                contact={contact}
                fresh={freshCode === contact.code}
                onOpen={setOpen}
              />
            ))}
          </div>
        </div>
      )}
      {open
        ? createPortal(
            <CardView contact={open} onChange={onChange} onClose={() => setOpen(null)} />,
            document.body,
          )
        : null}
    </section>
  );
}
