# Cheatsheet

## Spring Configs

| Use case | damping | stiffness | mass |
|---|---|---|---|
| SlamText words | 13-14 | 130-140 | 0.8 |
| Subtitle fade-in | 16-18 | 80-100 | 1.0 |
| Button bounce | 8-12 | 120-200 | 0.6-0.8 |
| Card entrance | 14-16 | 100-120 | 0.8-0.9 |
| Label slide-up | 16-20 | 80 | 1.0 |
| "done." slam | 10-11 | 150-160 | 0.7-0.9 |
| Feature grid items | 14 | 110 | 0.8 |

Lower damping = more bounce. Higher stiffness = snappier. Lower mass = faster.

## Responsive Sizes

| Element | Desktop | Phone (portrait) |
|---|---|---|
| Headlines | 88px | 148px |
| Subtext | 46px | 72px |
| Terminal commands | 48px | 72px |
| UI panels width | 800px | 920px |
| Padding | 0 40px | 0 56px |
| Gap | 8px | 14px |
| Border radius | 14px | 20px |
| Cursor width | 3px | 4px |
| Cursor height | 28px | 44px |

Phone sizes are roughly 1.4-2x desktop. Visually calibrated, not a linear scale.

## Font Loading

If using custom fonts (Geist, Inter, etc.) with local `.woff2` files:

```typescript
// src/fonts.ts
import { staticFile } from "remotion";
import { loadFont } from "@remotion/fonts";

export const loadGeist = () => {
  const weights = [
    { file: "Geist-Regular.woff2", weight: "400" as const },
    { file: "Geist-Medium.woff2", weight: "500" as const },
    { file: "Geist-SemiBold.woff2", weight: "600" as const },
    { file: "Geist-Bold.woff2", weight: "700" as const },
    { file: "Geist-Black.woff2", weight: "900" as const },
  ];
  for (const w of weights) {
    loadFont({
      family: "Geist",
      url: staticFile(`fonts/${w.file}`),
      weight: w.weight,
    });
  }
};
```

Call at module level in `Root.tsx`:

```typescript
import { loadGeist } from "./fonts";
loadGeist();
```

Place `.woff2` files in `public/fonts/`.

Add `@remotion/fonts: "^4.0.434"` to package.json when using local fonts.

## Render Commands

```bash
# Preview with live scrubber
npx remotion studio

# Render desktop (default composition)
npx remotion render [Name]Demo out/video.mp4

# Render mobile portrait
npx remotion render [Name]DemoMobile out/mobile.mp4

# Render mobile landscape
npx remotion render [Name]DemoMobileLandscape out/landscape.mp4

# If font loading times out (frames >700)
npx remotion render [Name]Demo out/video.mp4 --timeout=60000
```

25 seconds at 1080p renders in ~40-60 seconds locally.

## Common Animation Patterns

### Staggered Entrance
```typescript
items.map((item, i) => {
  const prog = spring({
    frame: frame - (delay + i * 5),  // 5 frames between each item
    fps,
    config: { damping: 14, stiffness: 110, mass: 0.8 },
  });
  // use prog for opacity + transform
});
```

### Glow Pulse (completion states)
```typescript
const glowOpacity = interpolate(
  Math.sin(frame * 0.1),
  [-1, 1],
  [0.03, 0.12]
);
```

### Subtle Zoom Drift
```typescript
const zoom = interpolate(frame, [0, duration], [1, 1.03], {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
});
// Apply as transform: `scale(${zoom})`
```

### Shake Effect
```typescript
const shakeX = Math.sin(frame * 0.5) * intensity;
const shakeY = Math.cos(frame * 0.5) * intensity * 0.6;
// Apply as transform: `translate(${shakeX}px, ${shakeY}px)`
```

### "done." Payoff Moment
```typescript
const doneProg = spring({
  frame: frame - doneAppearFrame,
  fps,
  config: { damping: 10, stiffness: 155, mass: 0.8 },
});
const doneScale = interpolate(doneProg, [0, 1], [1.6, 1]);
// Render with accent color + glow pulse behind it
```
