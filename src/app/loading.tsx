export default function HomeLoading() {
  return (
    <div>
      {/* Hero skeleton */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 pt-24 pb-20 text-center">
        <div className="skeleton h-8 w-80 mx-auto mb-8" />
        <div className="skeleton h-16 w-full max-w-2xl mx-auto mb-4" />
        <div className="skeleton h-16 w-full max-w-xl mx-auto mb-6" />
        <div className="skeleton h-6 w-96 mx-auto mb-10" />
        <div className="flex justify-center gap-4 mb-16">
          <div className="skeleton h-12 w-48" />
          <div className="skeleton h-12 w-36" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mx-auto">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton h-24" />
          ))}
        </div>
      </section>
    </div>
  );
}
