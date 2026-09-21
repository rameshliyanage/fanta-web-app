export function FantaMark({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  return (
    <div className={`fanta-mark fanta-mark-${size}`} aria-label="Fanta">
      <span>FANTA</span>
    </div>
  );
}
