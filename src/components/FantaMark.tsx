export function FantaMark({
  size = "md",
  align = "center",
}: {
  size?: "sm" | "md" | "lg";
  align?: "left" | "center" | "right";
}) {
  return (
    <div className={`fanta-mark fanta-mark-${size} fanta-mark-${align}`}>
      <img src="/fanta-logo.png" alt="Fanta" />
    </div>
  );
}
