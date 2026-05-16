export default function UserProjectsLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 sm:py-12">
      <div className="skeleton h-4 w-32 mb-6" />
      <div className="skeleton h-9 w-72 mb-3" />
      <div className="skeleton h-4 w-40 mb-8" />
      <div className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton h-64 w-full" />
        ))}
      </div>
    </div>
  );
}
