/**
 * Streamed instantly while page.tsx awaits Supabase, so navigating from the
 * bell paints a real shell in one frame instead of a blank screen.
 *
 * Geometry mirrors notifications-view.tsx (720px column, 46px chips, same
 * paddings) so the swap to real rows doesn't shift anything.
 */
export default function NotificationsLoading() {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 16px 80px" }}>
      {/* Header: bell + title block */}
      <div
        className="rounded-2xl"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "20px 22px",
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          marginBottom: 18,
        }}
      >
        <div className="skeleton" style={{ width: 46, height: 46, borderRadius: 999, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="skeleton" style={{ width: 168, height: 22, borderRadius: 8 }} />
          <div className="skeleton" style={{ width: 104, height: 11, borderRadius: 6, marginTop: 8 }} />
        </div>
      </div>

      {/* Filter pills */}
      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        {[62, 78, 66, 74].map((w) => (
          <div key={w} className="skeleton" style={{ width: w, height: 32, borderRadius: 999 }} />
        ))}
      </div>

      {/* Rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-2xl"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "16px 18px",
              background: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <div className="skeleton" style={{ width: 46, height: 46, borderRadius: 999, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="skeleton" style={{ width: `${72 - i * 7}%`, height: 13, borderRadius: 6 }} />
              <div className="skeleton" style={{ width: "38%", height: 11, borderRadius: 6, marginTop: 8 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
