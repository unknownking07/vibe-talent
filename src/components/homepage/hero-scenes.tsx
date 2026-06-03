// Animated hero scenes (CSS only, prefers-reduced-motion safe) for the homepage fork hero.
import { Flame, Search, Check } from "lucide-react";

const SCENE_CSS = `
@keyframes prvCursorBlink { 0%,49% { opacity: 1 } 50%,100% { opacity: 0 } }
@keyframes prvFlame {
  0%,100% { transform: scale(1) rotate(0deg); opacity: 1 }
  40%     { transform: scale(1.2) rotate(-5deg); opacity: .8 }
  70%     { transform: scale(.92) rotate(4deg); opacity: 1 }
}
@keyframes prvFill {
  0%,8%   { background: var(--border-subtle) }
  26%     { background: var(--accent) }
  74%     { background: var(--accent) }
  100%    { background: var(--border-subtle) }
}
@keyframes prvFloat { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-2.5px) } }
@keyframes prvScan {
  0%   { transform: translateY(-4px); opacity: 0 }
  12%  { opacity: 1 }
  88%  { opacity: 1 }
  100% { transform: translateY(78px); opacity: 0 }
}
@keyframes prvMatch {
  0%,42%   { border-color: var(--border-subtle) }
  56%,90%  { border-color: var(--accent) }
  100%     { border-color: var(--border-subtle) }
}
@keyframes prvCheck {
  0%,46%  { opacity: 0; transform: scale(.5) }
  60%,90% { opacity: 1; transform: scale(1) }
  100%    { opacity: 0; transform: scale(.5) }
}
.prvCursor   { animation: prvCursorBlink 1s steps(1) infinite }
.prvFlame    { animation: prvFlame .9s ease-in-out infinite; transform-origin: center bottom }
.prvSquare   { animation: prvFill 2.6s ease-in-out infinite }
.prvHood     { animation: prvFloat 3s ease-in-out infinite }
.prvScanLine { animation: prvScan 2.6s ease-in-out infinite }
.prvMatchRow { animation: prvMatch 2.6s ease-in-out infinite }
.prvCheck    { animation: prvCheck 2.6s ease-in-out infinite }
@media (prefers-reduced-motion: reduce) {
  .prvCursor,.prvFlame,.prvSquare,.prvHood,.prvScanLine,.prvMatchRow,.prvCheck { animation: none !important }
  .prvSquare { background: var(--accent) }
  .prvCheck  { opacity: 1; transform: none }
  .prvScanLine { opacity: 0 }
}
`;

/** Render once on the page; injects the keyframes used by both scenes. */
export function HeroSceneStyles() {
  return <style dangerouslySetInnerHTML={{ __html: SCENE_CSS }} />;
}

/** A "window" frame shared by both scenes so the two cards feel like a set. */
function SceneFrame({ label, right, children }: { label: string; right: React.ReactNode; children: React.ReactNode }) {
  return (
    <div
      className="relative w-full overflow-hidden select-none"
      style={{ height: 150, border: "2px solid var(--border-hard)", backgroundColor: "var(--bg-surface-light)" }}
      aria-hidden="true"
    >
      <div
        className="flex items-center justify-between px-3 py-1.5"
        style={{ borderBottom: "2px solid var(--border-hard)", backgroundColor: "var(--bg-inverted)" }}
      >
        <span className="font-mono text-[10px] font-extrabold uppercase tracking-wider" style={{ color: "var(--text-on-inverted)" }}>
          {label}
        </span>
        {right}
      </div>
      <div className="px-3 py-3">{children}</div>
    </div>
  );
}

/** Builder: a vibe coder shipping — hooded avatar, typing code, streak flame, contribution graph. */
export function BuilderScene() {
  return (
    <SceneFrame label="~/vibe · shipping" right={<Flame size={14} className="prvFlame" style={{ color: "var(--accent)" }} />}>
      <div className="flex items-start gap-3">
        {/* hooded coder avatar */}
        <svg width="26" height="26" viewBox="0 0 24 24" className="prvHood shrink-0" style={{ marginTop: 1 }}>
          <path d="M3 14 C3 6.5 7 3 12 3 C17 3 21 6.5 21 14 Z" fill="var(--accent)" stroke="var(--border-hard)" strokeWidth="1.5" />
          <circle cx="12" cy="11.5" r="3.2" fill="var(--bg-inverted)" />
        </svg>
        {/* "typing" code lines */}
        <div className="flex-1 space-y-2 pt-0.5">
          <div className="h-2 rounded-sm" style={{ width: "72%", backgroundColor: "var(--border-subtle)" }} />
          <div className="h-2 rounded-sm" style={{ width: "48%", backgroundColor: "var(--accent)", opacity: 0.65 }} />
          <div className="flex items-center gap-1">
            <div className="h-2 rounded-sm" style={{ width: "56%", backgroundColor: "var(--border-subtle)" }} />
            <span className="prvCursor inline-block" style={{ width: 6, height: 12, backgroundColor: "var(--accent)" }} />
          </div>
        </div>
      </div>

      {/* contribution graph filling in a wave */}
      <div className="flex gap-1 mt-3">
        {Array.from({ length: 16 }).map((_, i) => (
          <div
            key={i}
            className="prvSquare"
            style={{ width: 11, height: 11, animationDelay: `${i * 105}ms`, backgroundColor: "var(--border-subtle)", border: "1px solid var(--border-hard)" }}
          />
        ))}
      </div>
      <div className="mt-2 font-mono text-[9px] font-extrabold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
        commit · ship · repeat
      </div>
    </SceneFrame>
  );
}

/** Hirer: scanning talent — profile rows, a sweep line, and a "match" that lights up. */
export function HirerScene() {
  const rows = [
    { w: "58%", match: false },
    { w: "70%", match: true },
    { w: "50%", match: false },
  ];
  return (
    <SceneFrame label="scanning talent" right={<Search size={13} style={{ color: "var(--accent)" }} />}>
      <div className="relative space-y-2">
        {/* sweep line */}
        <div
          className="prvScanLine absolute left-0 right-0 z-10"
          style={{ top: 0, height: 2, backgroundColor: "var(--accent)", boxShadow: "0 0 8px var(--accent)" }}
        />
        {rows.map((r, i) => (
          <div
            key={i}
            className={`flex items-center gap-2 px-2 py-1.5 ${r.match ? "prvMatchRow" : ""}`}
            style={{ border: "2px solid var(--border-subtle)", backgroundColor: "var(--bg-surface)" }}
          >
            <div
              className="rounded-full shrink-0"
              style={{ width: 16, height: 16, backgroundColor: r.match ? "var(--accent)" : "var(--border-subtle)", border: "1.5px solid var(--border-hard)" }}
            />
            <div className="flex-1 space-y-1">
              <div className="h-1.5 rounded-sm" style={{ width: r.w, backgroundColor: "var(--border-subtle)" }} />
              <div className="h-1.5 rounded-sm" style={{ width: "32%", backgroundColor: "var(--accent)", opacity: 0.55 }} />
            </div>
            {r.match && (
              <span
                className="prvCheck inline-flex items-center justify-center shrink-0"
                style={{ width: 16, height: 16, backgroundColor: "var(--accent)", border: "1.5px solid var(--border-hard)" }}
              >
                <Check size={11} strokeWidth={3.5} color="#fff" />
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="mt-2 font-mono text-[9px] font-extrabold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
        ranked by proof
      </div>
    </SceneFrame>
  );
}
