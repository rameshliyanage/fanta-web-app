import { useEffect, useState } from "react";
import { loadPhoto } from "../game/photos";
import type { Contact } from "../game/types";

export function usePhotoUrl(photoId: string) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!photoId) return;
    let active = true;
    let created = "";
    void loadPhoto(photoId).then((blob) => {
      if (!active || !blob) return;
      created = URL.createObjectURL(blob);
      setUrl(created);
    });
    return () => {
      active = false;
      if (created) URL.revokeObjectURL(created);
    };
  }, [photoId]);
  return url;
}

export function CardView({
  contact,
  onChange,
  onClose,
}: {
  contact: Contact;
  onChange: (code: string, name: string, company: string) => void;
  onClose: () => void;
}) {
  const photo = usePhotoUrl(contact.photoId);
  const [name, setName] = useState(contact.name);
  const [company, setCompany] = useState(contact.company);

  function save() {
    onChange(contact.code, name.trim(), company.trim());
    onClose();
  }

  return (
    <div className="overlay card-view" role="dialog" aria-label="Collected card">
      <div className="card-photo">
        {photo ? <img src={photo} alt="Captured card" /> : <span className="thumb-wait" />}
      </div>
      <label>
        Name
        <input value={name} onChange={(event) => setName(event.target.value)} maxLength={40} />
      </label>
      <label>
        Company
        <input value={company} onChange={(event) => setCompany(event.target.value)} maxLength={40} />
      </label>
      <button type="button" className="primary" onClick={save}>
        Save
      </button>
      <button type="button" className="text-btn" onClick={onClose}>
        Close
      </button>
    </div>
  );
}
