import { SkeletonCard } from "@/components/ui/skeleton-card";

export default function ExploreLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12">
      <div className="mb-8">
        <div className="skeleton h-9 w-64 mb-3" />
        <div className="skeleton h-5 w-96" />
      </div>
      <div className="skeleton h-12 w-full mb-8" />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 stagger-children">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
}
