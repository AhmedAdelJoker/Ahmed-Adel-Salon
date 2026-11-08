export default function AttendanceLoading() {
  return (
    <div className="space-y-4">
      <div className="h-24 animate-pulse rounded-2xl border border-border bg-card" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl border border-border bg-card" />
        ))}
      </div>
      <div className="h-14 animate-pulse rounded-2xl border border-border bg-card" />
      <div className="h-80 animate-pulse rounded-2xl border border-border bg-card" />
    </div>
  );
}
