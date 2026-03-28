export function SkeletonCard() {
  return (
    <div
      className="p-5"
      style={{
        backgroundColor: "var(--bg-surface)",
        border: "2px solid var(--border-hard)",
        boxShadow: "var(--shadow-brutal)",
      }}
    >
      <div className="flex items-start gap-4">
        <div className="skeleton w-12 h-12 shrink-0" />
        <div className="flex-1 space-y-3">
          <div className="skeleton h-5 w-32" />
          <div className="skeleton h-4 w-full" />
          <div className="skeleton h-4 w-3/4" />
          <div className="flex gap-3 mt-3">
            <div className="skeleton h-4 w-20" />
            <div className="skeleton h-4 w-20" />
          </div>
        </div>
      </div>
    </div>
  );
}
