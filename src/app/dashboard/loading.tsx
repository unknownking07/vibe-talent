export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12">
      <div className="mb-8">
        <div className="skeleton h-9 w-48 mb-3" />
        <div className="skeleton h-5 w-72" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
        {/* Sidebar skeleton */}
        <div className="flex flex-col gap-4">
          <div className="skeleton h-40 w-full rounded-xl" />
          <div className="skeleton h-24 w-full rounded-xl" />
        </div>
        {/* Content skeleton */}
        <div className="flex flex-col gap-4">
          <div className="skeleton h-20 w-full rounded-xl" />
          <div className="skeleton h-64 w-full rounded-xl" />
          <div className="skeleton h-48 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
