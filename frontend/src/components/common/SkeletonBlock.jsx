import { useEffect } from 'react';
export function SkeletonBlock({ className = "" }) {
  


return (

    <div
      className={`skeleton rounded-2xl bg-soft ${className}`}
      aria-hidden="true"
    />
  );
}

export function SkeletonLines({ lines = 3, className = "" }) {
  return (
    <div className={`space-y-3 ${className}`} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBlock
          key={i}
          className={`h-3 ${i === lines - 1 ? "w-2/3" : "w-full"}`}
        />
      ))}
    </div>
  );
}


