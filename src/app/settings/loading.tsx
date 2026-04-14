export default function SettingsLoading() {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-12">
      <div className="mb-8">
        <div className="skeleton h-9 w-40 mb-3" />
        <div className="skeleton h-5 w-64" />
      </div>
      <div className="flex flex-col gap-6">
        <div className="skeleton h-16 w-full rounded-xl" />
        <div className="skeleton h-16 w-full rounded-xl" />
        <div className="skeleton h-16 w-full rounded-xl" />
        <div className="skeleton h-16 w-full rounded-xl" />
        <div className="skeleton h-12 w-32 rounded-xl" />
      </div>
    </div>
  );
}
