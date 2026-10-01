// Fade-and-rise on first paint. Pure CSS (see .page-fade-in in globals.css),
// so content isn't held invisible until JavaScript hydrates.
export default function FadeIn({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`page-fade-in ${className}`}>{children}</div>;
}
