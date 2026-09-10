export default function AttendanceLoading() {
  return (
    <div className="min-h-screen pb-12" dir="rtl">
      <div className="mx-auto max-w-7xl space-y-5 px-3 pt-4 sm:px-4 lg:px-6">
        <div className="h-20 rounded-2xl bg-card border border-border animate-pulse" />
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-24 rounded-2xl bg-card border border-border animate-pulse"
            />
          ))}
        </div>
        <div className="h-64 rounded-2xl bg-card border border-border animate-pulse" />
      </div>
    </div>
  );
}
