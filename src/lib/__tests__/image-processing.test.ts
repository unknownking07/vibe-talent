import { describe, it, expect } from "vitest";
import {
  computeContainBox,
  computeCoverBox,
  TARGET_WIDTH,
  TARGET_HEIGHT,
} from "@/lib/image-processing";

describe("computeContainBox", () => {
  it("centers a 16:9 source at full target size", () => {
    const box = computeContainBox(1920, 1080);
    expect(box.width).toBe(TARGET_WIDTH);
    expect(box.height).toBe(TARGET_HEIGHT);
    expect(box.x).toBe(0);
    expect(box.y).toBe(0);
  });

  it("letterboxes a portrait source with pillar bars", () => {
    const box = computeContainBox(800, 1200);
    expect(box.height).toBe(TARGET_HEIGHT);
    expect(box.width).toBeLessThan(TARGET_WIDTH);
    expect(box.x).toBeGreaterThan(0);
    expect(box.y).toBe(0);
  });

  it("letterboxes a wide source with top/bottom bars", () => {
    const box = computeContainBox(2400, 800);
    expect(box.width).toBe(TARGET_WIDTH);
    expect(box.height).toBeLessThan(TARGET_HEIGHT);
    expect(box.y).toBeGreaterThan(0);
    expect(box.x).toBe(0);
  });

  it("never upscales — small thumbnails stay native size", () => {
    const box = computeContainBox(400, 300);
    expect(box.width).toBe(400);
    expect(box.height).toBe(300);
    expect(box.x).toBe((TARGET_WIDTH - 400) / 2);
    expect(box.y).toBe((TARGET_HEIGHT - 300) / 2);
  });

  it("returns an empty box for zero dimensions", () => {
    expect(computeContainBox(0, 0)).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });
});

describe("computeCoverBox", () => {
  it("upscales a small source to fill the canvas (backdrop)", () => {
    const box = computeCoverBox(400, 300);
    expect(box.width).toBeGreaterThanOrEqual(TARGET_WIDTH);
    expect(box.height).toBeGreaterThanOrEqual(TARGET_HEIGHT);
  });

  it("centers an exact-aspect source with no offset", () => {
    const box = computeCoverBox(1920, 1080);
    expect(box.width).toBe(TARGET_WIDTH);
    expect(box.height).toBe(TARGET_HEIGHT);
    expect(box.x).toBe(0);
    expect(box.y).toBe(0);
  });

  it("overflows symmetrically for portrait sources", () => {
    const box = computeCoverBox(900, 1600);
    expect(box.width).toBe(TARGET_WIDTH);
    expect(box.height).toBeGreaterThan(TARGET_HEIGHT);
    expect(box.x).toBe(0);
    expect(box.y).toBeLessThan(0);
  });
});
