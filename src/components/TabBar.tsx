type Tab = "home" | "board" | "profile" | "collection";

function IconHome() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" />
    </svg>
  );
}

function IconBoard() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 20V10h3v10H7Zm7 0V4h3v16h-3ZM4 20V14h3v6H4Z" />
    </svg>
  );
}

function IconScan() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 8V5a1 1 0 0 1 1-1h3v2H6v2H4Zm16 0V6h-2V4h3a1 1 0 0 1 1 1v3h-2ZM4 16h2v2h2v2H5a1 1 0 0 1-1-1v-3Zm16 0h2v3a1 1 0 0 1-1 1h-3v-2h2v-2ZM7 11h10v2H7v-2Z" />
    </svg>
  );
}

function IconProfile() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4.4 0-8 2.2-8 5v1h16v-1c0-2.8-3.6-5-8-5Z" />
    </svg>
  );
}

export function ProfileButton({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className={on ? "profile-btn is-on" : "profile-btn"}
      aria-label="Profile"
      onClick={onClick}
    >
      <IconProfile />
    </button>
  );
}

export function TabBar({
  tab,
  onHome,
  onBoard,
  onScan,
}: {
  tab: Tab;
  onHome: () => void;
  onBoard: () => void;
  onScan: () => void;
}) {
  const slot = tab === "board" ? "board" : tab === "home" ? "home" : "";
  return (
    <nav className="tab-bar" aria-label="Game">
      <div className={slot ? `tab-dock is-${slot}` : "tab-dock"}>
        <span className="tab-pill" aria-hidden="true" />
        <button type="button" className={slot === "home" ? "tab-side is-on" : "tab-side"} onClick={onHome}>
          <IconHome />
          <span>Home</span>
        </button>
        <button type="button" className="tab-scan" onClick={onScan} aria-label="Scan">
          <IconScan />
        </button>
        <button type="button" className={slot === "board" ? "tab-side is-on" : "tab-side"} onClick={onBoard}>
          <IconBoard />
          <span>Board</span>
        </button>
      </div>
    </nav>
  );
}
