---
name: remotion-video
description: Scaffold a complete Remotion video project — multi-format compositions, scene architecture, spring animations, beat-synced audio, and responsive sizing. All primitives included. Use when the user wants to create a product demo video, promo video, social media video, or any programmatic video with Remotion. Triggers on requests like "make a video", "create a demo video", "remotion project", "product demo", "scaffold a video", "new video", "promo video", "social video", or any mention of building a video with code.
category: workflow
tags: [remotion, video, animation, demo, product-video]
author: tushaarmehtaa
---

Scaffold a Remotion video project with multi-format compositions, spring animations, beat-synced audio, and reusable scene primitives. Outputs a project you can `npx remotion studio` immediately.

## Phase 1: Get the Brief

Before writing any code, ask for what's missing:

```
I'll scaffold a Remotion video project. Quick decisions:

1. Product name? (used for composition IDs and file names)
2. One-line pitch? (the core message of the video)
3. Scene ideas? (3-8 scenes — what story does each beat tell?)
4. Color vibe?
   a) Dark + amber accent (#d97706) — warm, editorial
   b) Dark + monochrome — clean, minimal
   c) Custom — give me bg, text, and accent hex values
5. BPM of your music track? (default: 115)
6. Font? (default: system stack — or provide .woff2 files for Geist/custom)
```

If the user already described their video in the conversation, extract answers before asking. Don't ask for what you already have.

**Defaults if user skips:** 25 seconds, 30fps, 6 scenes, dark + amber, 115 BPM, system font stack.

## Phase 2: Scaffold the Project

Create this exact file tree:

```
[name]-video/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts
│   ├── Root.tsx
│   ├── [Name]Demo.tsx        # orchestrator
│   └── [Name]Scenes.tsx      # scenes + tokens + primitives
├── public/
│   ├── audio/                # user drops .mp3 here
│   └── fonts/                # .woff2 files if custom font
└── out/
```

### package.json

```json
{
  "name": "[name]-video",
  "type": "commonjs",
  "dependencies": {
    "@remotion/cli": "^4.0.421",
    "@types/react": "^19.2.13",
    "react": "^19.2.4",
    "react-dom": "^19.2.4",
    "remotion": "^4.0.421",
    "typescript": "^5.9.3"
  }
}
```

**Add `@remotion/fonts: "^4.0.434"` only if loading local font files.** Don't include it otherwise.

**`"type": "commonjs"` is required.** ESM causes issues with Remotion's bundler.

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2018",
    "module": "commonjs",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

### src/index.ts

Always identical:

```typescript
import { registerRoot } from "remotion";
import { RemotionRoot } from "./Root";
registerRoot(RemotionRoot);
```

## Phase 3: Compositions (Root.tsx)

Register three compositions. Same component renders all three — aspect ratio detection happens inside.

```typescript
import { Composition } from "remotion";
import { Demo } from "./[Name]Demo";

export const RemotionRoot = () => (
  <>
    <Composition id="[Name]Demo" component={Demo} durationInFrames={750} fps={30} width={1920} height={1080} />
    <Composition id="[Name]DemoMobile" component={Demo} durationInFrames={750} fps={30} width={1080} height={1920} />
    <Composition id="[Name]DemoMobileLandscape" component={Demo} durationInFrames={750} fps={30} width={1334} height={750} />
  </>
);
```

**750 frames at 30fps = 25 seconds.** Adjust if user specified a different duration.

**Never build separate mobile components.** Inside the component, detect format:

```typescript
const { width, height, fps } = useVideoConfig();
const isPhone = height > width;
const isMobileLandscape = width > height && width <= 1400;
const globalScale = isPhone ? 1.14 : isMobileLandscape ? 1.08 : 1;
```

Wrap the entire scene area in a scaled `<AbsoluteFill>` using `globalScale`.

If loading custom fonts, call the font loader at module level in Root.tsx before compositions.

## Phase 4: Scene Architecture (The Orchestrator)

The orchestrator file (`[Name]Demo.tsx`) does three things: defines timing, wires audio, and lays out sequences.

### Scene Timing Object

```typescript
const scenes = {
  hook:   { from: 0,   dur: 90 },
  xfade1: { from: 86,  dur: 10 },
  pain:   { from: 90,  dur: 120 },
  xfade2: { from: 206, dur: 10 },
  // ... continue for each scene
} as const;
```

Rules:
- **Crossfades overlap** with the previous scene by 4 frames (`from = prev scene end - 4`)
- Crossfade duration: 10-16 frames
- Scene durations: 60-195 frames (2-6.5 seconds). Short. No scene should overstay.
- **`as const` is required** for TypeScript to treat values as literals

### Sequence Layout

Repeating pattern for every scene + crossfade pair:

```typescript
const frame = useCurrentFrame();

<Sequence from={scenes.hook.from} durationInFrames={scenes.hook.dur}>
  <SceneHook frame={frame - scenes.hook.from} duration={scenes.hook.dur} />
</Sequence>
<Sequence from={scenes.xfade1.from} durationInFrames={scenes.xfade1.dur}>
  <CrossfadeTransition frame={frame - scenes.xfade1.from} dur={scenes.xfade1.dur} />
</Sequence>
```

**Always pass `frame - scenes.X.from` so each scene gets local frame starting at 0.** Scenes must never reference the global frame.

### Audio

```typescript
<Audio src={staticFile("audio/music.mp3")} volume={(f) => getMusicVolume(f)} />
```

Build `getMusicVolume` using the 5-layer system in [references/audio.md](references/audio.md). Pass the scenes object and transition frame numbers.

## Phase 5: Build the Scenes

Put all scene components, design tokens, and primitives in `[Name]Scenes.tsx`.

### Design Tokens

Based on user's color choice:

**Dark + amber accent:**
```typescript
export const colors = {
  bg: "#000000", surface: "#080808", surfaceRaised: "#111111",
  border: "#191919", borderHover: "#333333", muted: "#555555",
  text: "#999999", heading: "#ffffff",
  accent: "#d97706", accentDim: "rgba(217,119,6,0.19)",
  accentGlow: "rgba(217,119,6,0.07)", accentBright: "rgba(217,119,6,0.35)",
};
```

**Dark + monochrome:**
```typescript
export const colors = {
  bg: "#09090b", surface: "#18181b", border: "#27272a",
  textPrimary: "#e4e4e7", textSecondary: "#c2c2cb",
  textMuted: "#ababb5", textDim: "#9595a0", accent: "#e4e4e7",
};
```

### Include These Primitives

Copy from [references/primitives.md](references/primitives.md):

1. **SceneWrap** — every scene uses this. Handles fade-in/fade-out with non-monotonic inputRange guard.
2. **SlamText** — word-by-word spring entrance. Used for headlines.
3. **CrossfadeTransition** — opacity spike between scenes. Must have `zIndex: 100`.
4. **TypingEffect** — terminal/input simulation with blinking cursor.
5. **GrainOverlay** — SVG noise texture (amber vibe only). `opacity: 0.035`, `zIndex: 50`.
6. **StageLight + AmbientGlow** — drifting radial gradients (amber vibe only).

### Scene Playbook

Pick scenes from this menu based on the user's brief:

| Scene Type | Duration | Purpose |
|---|---|---|
| Hook | 2-4.5s | SlamText headline + spring subtext. Grabs attention. |
| Pain/Problem | 4-5s | Terminal typing showing the old way. "New session" flash resets. |
| Snap/Solution | 2-3s | One command typed, result appears, "done." with glow pulse. |
| Cooking/Loading | 1.5-2s | Emoji + shake + progress bar. Anticipation. |
| Results/Cards | 4-6.5s | Items fly in from different directions. Shows output quality. |
| Feature Grid | 2-3s | 2x3 or 3x2 grid, staggered spring entrances. |
| Feedback/Chat | 3-4s | Chat bubbles: user asks (slides right), AI responds (slides left). |
| Scroll/Carousel | 5-6.5s | Items cycle through center with enter/exit transitions. |
| Install | 3s | Headline + typing animation of install command + "done." |
| CTA | 3s | SlamText + pulsing button + URL. `fadeOut: 0` (no fade, video ends). |

Common patterns inside scenes:
- Every text element uses `spring()` for entrance, never raw `interpolate()` for motion
- Staggered entrances: delay each item by 3-6 frames
- Glow pulse on completion: `interpolate(Math.sin(frame * 0.1), [-1, 1], [0.03, 0.12])`
- Subtle zoom drift: `interpolate(frame, [0, duration], [1, 1.03])`

### Responsive Sizing

Every size constant branches on `isPhone`:

```typescript
const fontSize = isPhone ? 148 : 88;      // headlines
const subSize = isPhone ? 72 : 46;        // subtext
const cmdSize = isPhone ? 72 : 48;        // terminal commands
const panelW = isPhone ? 920 : 800;       // UI panels
const borderRadius = isPhone ? 20 : 14;   // card corners
```

Phone sizes are roughly 1.4-2x desktop. Not a linear scale.

See [references/cheatsheet.md](references/cheatsheet.md) for the full spring config table, responsive values, and render commands.

## Phase 6: Gotchas

These will silently break your video if ignored:

1. **Always clamp extrapolation.** Every `interpolate()` call needs `{ extrapolateLeft: "clamp", extrapolateRight: "clamp" }`. Without it, values explode past 0/1.
2. **Non-monotonic inputRange crash.** If `fadeOut=0` in SceneWrap, the inputRange gets duplicate values. The `safeEnd = Math.max(duration - fadeOut, fadeIn + 1)` guard in the primitive fixes this.
3. **Font timeout on render.** `delayRender()` for font loading can timeout on frames >700. Use `--timeout=60000`.
4. **zIndex on crossfades.** Crossfade overlays must have `zIndex: 100` to sit above scene content.
5. **Local frame vs global frame.** Always pass `frame - scenes.X.from` to scene components.
6. **`as const` on scenes object.** Required for TypeScript to treat values as literals.
7. **No remotion.config.ts needed.** CLI defaults work fine.
8. **`type: "commonjs"` in package.json.** Required. ESM breaks Remotion's bundler.
9. **Background color on SceneWrap.** Set `backgroundColor: colors.bg` on the AbsoluteFill. Transparent backgrounds reveal previous scenes during crossfades.
10. **Cursor blink rate.** `Math.sin(frame * 0.25)` with asymmetric thresholds `[-1, -0.2, 0.2, 1] → [0, 0, 1, 1]` gives realistic 60% visibility.

## Verify

```
[ ] npm install completes without errors
[ ] npx remotion studio opens and shows all 3 compositions
[ ] Desktop composition (1920x1080) renders without crashes
[ ] Mobile portrait composition (1080x1920) renders — text is readable
[ ] Mobile landscape composition (1334x750) renders
[ ] No interpolate() calls without extrapolation clamping
[ ] SceneWrap has the safeEnd/safeDur guard for fadeOut=0
[ ] Every scene component receives local frame (frame - scenes.X.from)
[ ] Crossfade overlays have zIndex: 100
[ ] Audio plays with volume changes across transitions
[ ] Full render completes: npx remotion render [Id] out/video.mp4 --timeout=60000
```
