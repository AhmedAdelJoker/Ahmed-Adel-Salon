export default function CardShell({
  children,
  className = "",
  strong = false,
  interactive = false,
  gold = false,
  as: Component = "section",
  ...props
}) {
  const classes = [
    "card premium-card rounded-3xl bg-card border border-border shadow-soft",
    strong ? "glass-panel shadow-lg" : "",
    interactive ? "card-interactive" : "",
    gold ? "card-gold" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

return (
    <Component className={classes} {...props}>
      {children}
    </Component>
  );
}


