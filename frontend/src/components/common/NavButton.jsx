import { useEffect } from 'react';
export default function NavButton({
  active,
  icon,
  children,
  className = "",
  ...props
}) {
  


return (

    <button
      type="button"
      {...props}
      className={`btn btn-md rounded-2xl border font-black ${
        active
          ? "bg-accent text-white border-accent shadow-soft"
          : "bg-card text-muted border-border hover:bg-accent-subtle hover:text-accent hover:border-border-accent"
      } ${className}`}
      aria-pressed={active ? "true" : "false"}
    >
      {icon ? <span className="shrink-0">{icon}</span> : null}
      {children}
    </button>
  );
}


