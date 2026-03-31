# Music Volume System

Five layers that multiply together. Each layer handles one concern. The result is a volume curve that breathes with the music and ducks around transitions.

## Setup

```typescript
import { interpolate, useVideoConfig } from "remotion";

const bpm = 115; // match the track
const { fps } = useVideoConfig();
const framesPerBeat = (fps * 60) / bpm;
const beatAnchor = scenes.hook.from; // sync beats from first scene

// Collect all transition start frames
const TRANSITION_FRAMES = [
  scenes.xfade1.from,
  scenes.xfade2.from,
  scenes.xfade3.from,
  // ... all crossfade .from values
];
```

## The 5 Layers

### Layer 1: Base Volume

Overall loudness. Quieter on phone because text competes with audio.

```typescript
const base = isMobileLandscape ? 0.46 : isPhone ? 0.34 : 0.28;
```

### Layer 2: Beat Pulse

Volume spikes on each beat. Subtle pumping feel synced to BPM.

```typescript
const beatFrame =
  (((f - beatAnchor) % framesPerBeat) + framesPerBeat) % framesPerBeat;
const beatPhase = beatFrame / framesPerBeat;
const beatPulse = interpolate(
  beatPhase,
  [0, 0.06, 0.2, 0.55, 1],
  [1.32, 1.2, 0.95, 0.84, 1],
  { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
);
```

The double-modulo `(((x % n) + n) % n)` handles negative frame values cleanly.

### Layer 3: Cut Ducking

Audio dips 6 frames before each transition, slams back 10 frames after.

```typescript
const cutMultiplier = TRANSITION_FRAMES.reduce((acc, t) => {
  const local = f - t;
  const preCutDuck = interpolate(local, [-6, 0, 4], [1, 0.5, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const postCutSlam = interpolate(local, [0, 3, 10], [1, 1.35, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return acc * preCutDuck * postCutSlam;
}, 1);
```

Pre-cut duck: volume drops to 0.5 right at the transition frame, then recovers.
Post-cut slam: volume spikes to 1.35 for 3 frames after the cut, then settles.

### Layer 4: Energy Shape

Overall volume contour across the video. Builds energy toward the CTA.

```typescript
const energyShape = interpolate(
  f,
  [0, scenes.pain.from, scenes.snap.from, scenes.scroll.from, scenes.cta.from, 750],
  [0.7, 0.85, 1.15, 1.0, 1.18, 0.84],
  { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
);
```

Adapt the keyframes to your actual scene names. The shape should:
- Start quieter (0.7) during the hook — let the text land
- Build through the middle (0.85 → 1.15)
- Peak at the climax / CTA (1.18)
- Slightly pull back at the very end (0.84) for a clean outro

### Layer 5: Intro/Outro Fade

Clean audio boundaries. No abrupt start or stop.

```typescript
const totalFrames = 750; // or use useVideoConfig().durationInFrames
const introFade = interpolate(f, [0, 20], [0, 1], {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
});
const outroFade = interpolate(f, [totalFrames - 30, totalFrames - 1], [1, 0], {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
});
```

20-frame intro fade (~0.67s). 30-frame outro fade (~1s).

## Combining All Layers

```typescript
function clamp(val: number, min: number, max: number) {
  return Math.min(Math.max(val, min), max);
}

const getMusicVolume = (f: number) => {
  const base = isMobileLandscape ? 0.46 : isPhone ? 0.34 : 0.28;

  const beatFrame =
    (((f - beatAnchor) % framesPerBeat) + framesPerBeat) % framesPerBeat;
  const beatPhase = beatFrame / framesPerBeat;
  const beatPulse = interpolate(
    beatPhase,
    [0, 0.06, 0.2, 0.55, 1],
    [1.32, 1.2, 0.95, 0.84, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const cutMultiplier = TRANSITION_FRAMES.reduce((acc, t) => {
    const local = f - t;
    const preCutDuck = interpolate(local, [-6, 0, 4], [1, 0.5, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const postCutSlam = interpolate(local, [0, 3, 10], [1, 1.35, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    return acc * preCutDuck * postCutSlam;
  }, 1);

  const energyShape = interpolate(
    f,
    [0, scenes.pain.from, scenes.snap.from, scenes.scroll.from, scenes.cta.from, 750],
    [0.7, 0.85, 1.15, 1.0, 1.18, 0.84],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const introFade = interpolate(f, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const outroFade = interpolate(f, [720, 749], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return clamp(base * beatPulse * cutMultiplier * energyShape * introFade * outroFade, 0, 1);
};
```

## Usage in Orchestrator

```typescript
import { Audio, staticFile } from "remotion";

<Audio src={staticFile("audio/music.mp3")} volume={(f) => getMusicVolume(f)} />
```

Drop the `.mp3` file into `public/audio/`. The volume function runs per-frame automatically.
