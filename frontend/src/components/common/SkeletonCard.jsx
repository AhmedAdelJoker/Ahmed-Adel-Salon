import { useEffect } from 'react';
import { SkeletonBlock, SkeletonLines } from "./SkeletonBlock";

export default function SkeletonCard({ className = "" }) {
  


return (

    <div
      className={`card rounded-3xl border border-border bg-card p-5 shadow-soft ${className}`}
      aria-hidden="true"
    >
      <div className="flex items-start gap-4">
        <SkeletonBlock className="h-12 w-12 shrink-0 rounded-2xl" />
        <div className="min-w-0 flex-1 space-y-4">
          <SkeletonBlock className="h-4 w-1/2" />
          <SkeletonLines lines={3} />
        </div>
      </div>
    </div>
  );
}


