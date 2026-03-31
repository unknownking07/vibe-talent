# Primitives

Tested components. Copy these into `[Name]Scenes.tsx`.

## SceneWrap

Every scene uses this. Handles fade-in/fade-out lifecycle with a guard against non-monotonic inputRange when `fadeOut=0`.

```typescript
import { AbsoluteFill, interpolate } from "remotion";

interface SceneWrapProps {
  children: React.ReactNode;
  frame: number;
  duration: number;
  fadeIn?: number;
  fadeOut?: number;
}

function SceneWrap({ children, frame, duration, fadeIn = 8, fadeOut = 8 }: SceneWrapProps) {
  const safeEnd = Math.max(duration - fadeOut, fadeIn + 1);
  const safeDur = Math.max(duration, safeEnd + 1);
  const opacity = interpolate(
    frame,
    [0, fadeIn, safeEnd, safeDur],
    [0, 1, 1, fadeOut === 0 ? 1 : 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  return (
    <AbsoluteFill
      style={{
        opacity,
        backgroundColor: colors.bg,
        justifyContent: "center",
        alignItems: "center",
        fontFamily: FONT,
      }}
    >
      {children}
    </AbsoluteFill>
  );
}
```

**The `safeEnd` / `safeDur` guards are critical.** Without them, `interpolate()` throws when `fadeOut=0` creates duplicate values in the inputRange.

**Set `backgroundColor: colors.bg`** on the AbsoluteFill. Transparent backgrounds reveal previous scenes underneath during crossfades.

---

## SlamText

Word-by-word spring entrance. The signature headline animation.

```typescript
import { spring, interpolate, useVideoConfig } from "remotion";

interface SlamTextProps {
  text: string;
  frame: number;
  fps: number;
  fontSize?: number;
  delay?: number;
  color?: string;
  stagger?: number;
  damping?: number;
  stiffness?: number;
}

function SlamText({
  text,
  frame,
  fps,
  fontSize = 72,
  delay = 0,
  color = colors.heading,
  stagger = 5,
  damping = 13,
  stiffness = 130,
}: SlamTextProps) {
  const words = text.split(" ");
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: fontSize * 0.22,
        justifyContent: "center",
        alignItems: "baseline",
      }}
    >
      {words.map((word, i) => {
        const wordDelay = delay + i * stagger;
        const prog = spring({
          frame: frame - wordDelay,
          fps,
          config: { damping, stiffness, mass: 0.8 },
        });
        const scale = interpolate(prog, [0, 1], [1.5, 1]);
        const y = interpolate(prog, [0, 1], [24, 0]);
        return (
          <span
            key={i}
            style={{
              fontSize,
              fontWeight: 900,
              color,
              letterSpacing: "-0.045em",
              opacity: prog,
              transform: `scale(${scale}) translateY(${y}px)`,
              display: "inline-block",
              lineHeight: 1.1,
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
}
```

Tuning knobs:
- `stagger: 4-5` — frames between each word entrance
- `damping: 13-14` — lower = more bounce
- `stiffness: 130-140` — higher = snappier
- `scale: [1.5-1.6, 1]` — how big words start before slamming down

---

## CrossfadeTransition

Opacity spike between scenes. Two variants — use parameterized for flexibility.

### Parameterized (recommended)

```typescript
import { AbsoluteFill, interpolate, Easing } from "remotion";

interface CrossfadeProps {
  frame: number;
  dur: number;
}

function CrossfadeTransition({ frame, dur }: CrossfadeProps) {
  const mid = dur / 2;
  const opacity = interpolate(frame, [0, mid, dur], [0, 0.55, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.4, 0, 0.2, 1),
  });
  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg, opacity, zIndex: 100 }} />
  );
}
```

### Simple (fixed 8-frame)

```typescript
function CrossfadeTransition({ frame }: { frame: number }) {
  const opacity = interpolate(frame, [0, 4, 8], [0, 0.6, 0], {
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.25, 0.1, 0.25, 1),
  });
  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg, opacity, zIndex: 100 }} />
  );
}
```

**`zIndex: 100` is required.** Without it, the crossfade renders behind scene content.

---

## TypingEffect

Terminal/input simulation with blinking cursor. Inline this pattern inside scene components.

```typescript
// Setup
const text = "your command here";
const typingProgress = interpolate(frame, [startFrame, endFrame], [0, 1], {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
  easing: Easing.bezier(0.1, 0, 0.2, 1),
});
const charsTyped = Math.floor(typingProgress * text.length);
const displayText = text.slice(0, charsTyped);
const doneTyping = charsTyped >= text.length;

// Blinking cursor — asymmetric timing, visible ~60% of the time
const cursorOpacity = interpolate(
  Math.sin(frame * 0.25),
  [-1, -0.2, 0.2, 1],
  [0, 0, 1, 1]
);
```

Cursor element:

```tsx
<span
  style={{
    display: "inline-block",
    width: isPhone ? 4 : 3,
    height: isPhone ? 44 : 28,
    backgroundColor: colors.accent,
    marginLeft: 3,
    verticalAlign: "text-bottom",
    opacity: doneTyping ? cursorOpacity : 1,
  }}
/>
```

Show cursor as solid while typing, blink only after typing completes.

---

## GrainOverlay

Subtle SVG noise texture. Amber vibe only. Apply once at the top level of the orchestrator.

```typescript
function GrainOverlay() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 50,
        pointerEvents: "none",
        opacity: 0.035,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.5'/%3E%3C/svg%3E")`,
        backgroundRepeat: "repeat",
        backgroundSize: "256px 256px",
      }}
    />
  );
}
```

`opacity: 0.035` — barely visible, adds texture without noise. `zIndex: 50` so it sits above scenes but below crossfades.

---

## StageLight + AmbientGlow

Drifting radial gradients that breathe over time. Amber vibe only.

### StageLight (top-right)

```typescript
function StageLight({ frame }: { frame: number }) {
  const drift = Math.sin(frame * 0.008) * 40;
  const breathe = interpolate(Math.sin(frame * 0.012), [-1, 1], [0.04, 0.08]);
  return (
    <div
      style={{
        position: "absolute",
        top: -200 + drift,
        right: -100 - drift * 0.5,
        width: 900,
        height: 900,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${colors.accent} 0%, transparent 70%)`,
        opacity: breathe,
        filter: "blur(140px)",
        pointerEvents: "none",
        zIndex: 1,
      }}
    />
  );
}
```

### AmbientGlow (bottom-left)

```typescript
function AmbientGlow({ frame }: { frame: number }) {
  const drift = Math.cos(frame * 0.006) * 30;
  const breathe = interpolate(Math.cos(frame * 0.01), [-1, 1], [0.02, 0.05]);
  return (
    <div
      style={{
        position: "absolute",
        bottom: -150 + drift,
        left: -100 - drift * 0.5,
        width: 700,
        height: 700,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${colors.accent} 0%, transparent 70%)`,
        opacity: breathe,
        filter: "blur(160px)",
        pointerEvents: "none",
        zIndex: 1,
      }}
    />
  );
}
```

Both use `sin`/`cos` at different frequencies so they drift independently. The `breathe` values are subtle — the effect should feel ambient, not pulsing.
