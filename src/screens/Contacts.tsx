import { useState } from "react";
import { createPortal } from "react-dom";
import { CardView, usePhotoUrl } from "../components/CardView";
import type { Contact, GameState } from "../game/types";

function GridCard({
  contact,
  onOpen,
}: {
  contact: Contact;
  onOpen: (contact: Contact) => void;
}) {
  const url = usePhotoUrl(contact.photoId);
  return (
    <button type="button" className="contact-tile" onClick={() => onOpen(contact)}>
      <span className="collection-photo">
        {url ? <img src={url} alt="" /> : <span className="thumb-wait" />}
      </span>
      <span className="collection-name">{contact.name || "Add a name"}</span>
      {contact.company ? <span className="collection-company">{contact.company}</span> : null}
    </button>
  );
}

export function Contacts({
  state,
  onChange,
  onBack,
}: {
  state: GameState;
  onChange: (code: string, name: string, company: string) => void;
  onBack: () => void;
}) {
  const [open, setOpen] = useState<Contact | null>(null);

  return (
    <div className="screen contacts">
      <header className="topbar">
        <button type="button" className="pill" onClick={onBack}>
          <span aria-hidden="true">‹</span> Back
        </button>
      </header>
      <h1>YOUR SQUAD</h1>
      <p className="lede">
        {state.collected.length} {state.collected.length === 1 ? "person" : "people"}
      </p>
      <div className="contact-grid">
        {state.collected.map((contact) => (
          <GridCard key={contact.code} contact={contact} onOpen={setOpen} />
        ))}
      </div>
      {open
        ? createPortal(
            <CardView contact={open} onChange={onChange} onClose={() => setOpen(null)} />,
            document.body,
          )
        : null}
    </div>
  );
}
