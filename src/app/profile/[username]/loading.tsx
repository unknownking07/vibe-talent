export default function ProfileLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12">
      <div className="grid lg:grid-cols-[320px_1fr] gap-8">
        <div
          className="p-6 space-y-6"
          style={{
            backgroundColor: "#FFFFFF",
            border: "2px solid #0F0F0F",
            boxShadow: "var(--shadow-brutal)",
          }}
        >
          <div className="flex flex-col items-center gap-4">
            <div className="skeleton w-[120px] h-[120px]" />
            <div className="skeleton h-6 w-40" />
            <div className="skeleton h-4 w-24" />
          </div>
          <div className="skeleton h-12 w-full" />
        </div>
        <div className="space-y-6">
          <div className="skeleton h-20 w-full" />
          <div className="skeleton h-48 w-full" />
          <div className="grid sm:grid-cols-2 gap-6">
            <div className="skeleton h-40 w-full" />
            <div className="skeleton h-40 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
