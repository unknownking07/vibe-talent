import { Plus } from "lucide-react";

export function EmptySlotCard({ onClaim }: { onClaim: () => void }) {
  return (
    <button
      type="button"
      onClick={onClaim}
      className="relative flex flex-col items-center justify-center gap-3 p-6 md:min-h-[420px] text-left
                 transition-colors hover:bg-[color-mix(in_srgb,var(--accent)_8%,transparent)]
                 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-[var(--accent)]"
      style={{
        border: "2px dashed var(--accent)",
        backgroundColor: "color-mix(in srgb, var(--accent) 3%, var(--bg-surface))",
        boxShadow: "inset 0 0 32px rgba(255, 58, 0, 0.08)",
      }}
      aria-label="Claim this featured project slot"
    >
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center"
        style={{
          border: "2px solid var(--accent)",
          backgroundColor: "var(--bg-surface-light)",
        }}
      >
        <Plus size={24} style={{ color: "var(--accent)" }} />
      </div>
      <h3 className="text-base font-extrabold uppercase text-[var(--foreground)] text-center">
        Slot Available
      </h3>
      <p className="text-xs text-[var(--text-secondary)] text-center max-w-[220px] leading-relaxed">
        Get seen by founders scouting VibeTalent for builders to hire.
      </p>
      <span
        className="mt-2 text-xs font-bold uppercase underline underline-offset-4"
        style={{ color: "var(--accent)" }}
      >
        Claim This Spot →
      </span>
    </button>
  );
}
