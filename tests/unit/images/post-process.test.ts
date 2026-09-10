import { describe, expect, test } from "vitest";
import sharp from "sharp";
import { fitToTarget } from "@/lib/images/post-process";
import { estimateImageCostUsd } from "@/lib/images/usage";

/**
 * A 1536x1024 source banded to match the ACTUAL crop geometry.
 *
 * Cropping 1536x1024 (1.500) to 16:9 (1.778) keeps the middle 84% of the
 * height, so ~81px is trimmed from the top and the same from the bottom.
 * The bleed bands here are 70px — just inside that trim — so a correct
 * centre crop discards both entirely and every surviving pixel is green.
 * A drifted or attention-based crop would leave red or blue in frame.
 */
const SOURCE_WIDTH = 1536;
const SOURCE_HEIGHT = 1024;
const BLEED = 70;

async function bandedSource(): Promise<Buffer> {
  const svg = `<svg width="${SOURCE_WIDTH}" height="${SOURCE_HEIGHT}">
    <rect x="0" y="0" width="${SOURCE_WIDTH}" height="${BLEED}" fill="#FF0000"/>
    <rect x="0" y="${BLEED}" width="${SOURCE_WIDTH}" height="${SOURCE_HEIGHT - BLEED * 2}" fill="#00FF00"/>
    <rect x="0" y="${SOURCE_HEIGHT - BLEED}" width="${SOURCE_WIDTH}" height="${BLEED}" fill="#0000FF"/>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/**
 * The same frame with a magenta marker sitting just INSIDE the safe band the
 * prompt promises (10% down from the top edge). It must survive the crop —
 * otherwise `safeAreaNote` is lying to the model about where text is safe.
 */
async function markerSource(): Promise<Buffer> {
  const markerTop = Math.round(SOURCE_HEIGHT * 0.1);
  const svg = `<svg width="${SOURCE_WIDTH}" height="${SOURCE_HEIGHT}">
    <rect x="0" y="0" width="${SOURCE_WIDTH}" height="${SOURCE_HEIGHT}" fill="#00FF00"/>
    <rect x="0" y="${markerTop}" width="${SOURCE_WIDTH}" height="24" fill="#FF00FF"/>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function pixelAt(buffer: Buffer, x: number, y: number) {
  const { data, info } = await sharp(buffer)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const offset = (y * info.width + x) * info.channels;
  return { r: data[offset], g: data[offset + 1], b: data[offset + 2] };
}

describe("fitToTarget", () => {
  test("produces exactly the Skool banner spec from a 3:2 source", async () => {
    const { buffer, width, height } = await fitToTarget(await bandedSource(), {
      width: 1456,
      height: 816,
    });

    expect({ width, height }).toEqual({ width: 1456, height: 816 });
    const meta = await sharp(buffer).metadata();
    expect(meta.width).toBe(1456);
    expect(meta.height).toBe(816);
    expect(meta.format).toBe("png");
  });

  test("discards the top and bottom bleed entirely", async () => {
    const { buffer } = await fitToTarget(await bandedSource(), {
      width: 1456,
      height: 816,
    });

    // Every surviving row is the green band. Red at the top or blue at the
    // bottom would mean the crop kept bleed the prompt promised to cut.
    for (const y of [2, 408, 813]) {
      const px = await pixelAt(buffer, 728, y);
      expect(px.g).toBeGreaterThan(200);
      expect(px.r).toBeLessThan(60);
      expect(px.b).toBeLessThan(60);
    }
  });

  test("content inside the promised safe band survives the crop", async () => {
    const { buffer } = await fitToTarget(await markerSource(), {
      width: 1456,
      height: 816,
    });

    // safeAreaNote tells the model the middle 84% of height is kept, so a
    // marker 10% down from the top must still be visible afterwards.
    const rows = await Promise.all(
      Array.from({ length: 816 }, (_, y) => pixelAt(buffer, 728, y)),
    );
    const magentaRows = rows.filter((px) => px.r > 200 && px.b > 200);
    expect(magentaRows.length).toBeGreaterThan(0);
  });

  test("centre crop is symmetric — left and right edges match", async () => {
    const { buffer } = await fitToTarget(await bandedSource(), {
      width: 1456,
      height: 816,
    });

    const left = await pixelAt(buffer, 2, 408);
    const right = await pixelAt(buffer, 1453, 408);
    expect(left).toEqual(right);
  });

  test("the 16:9 thumbnail spec keeps the same band as the banner", async () => {
    const { buffer, width, height } = await fitToTarget(await bandedSource(), {
      width: 1280,
      height: 720,
    });

    expect({ width, height }).toEqual({ width: 1280, height: 720 });
    // 1280x720 is the same 16:9 as the banner, so the same band survives.
    const px = await pixelAt(buffer, 640, 4);
    expect(px.g).toBeGreaterThan(200);
    expect(px.r).toBeLessThan(60);
  });

  test("a square source downscales to the icon spec with alpha preserved", async () => {
    const source = await sharp({
      create: {
        width: 1024,
        height: 1024,
        channels: 4,
        background: { r: 20, g: 40, b: 60, alpha: 0 },
      },
    })
      .png()
      .toBuffer();

    const { buffer } = await fitToTarget(source, { width: 512, height: 512 });
    const meta = await sharp(buffer).metadata();

    expect(meta.width).toBe(512);
    expect(meta.height).toBe(512);
    expect(meta.hasAlpha).toBe(true);
  });
});

describe("estimateImageCostUsd", () => {
  test("prefers the token counts the API returns", () => {
    const cost = estimateImageCostUsd({
      model: "gpt-image-1",
      size: "1536x1024",
      tokens: { inputTokens: 200_000, imageInputTokens: 100_000, outputTokens: 50_000 },
    });

    // 0.2*5 + 0.1*10 + 0.05*40 = 1 + 1 + 2
    expect(cost).toBeCloseTo(4, 6);
  });

  test("falls back to the flat per-image rate when usage is absent", () => {
    expect(
      estimateImageCostUsd({ model: "gpt-image-1", size: "1536x1024" }),
    ).toBe(0.25);
    expect(
      estimateImageCostUsd({ model: "gpt-image-1", size: "1024x1024" }),
    ).toBe(0.167);
  });

  test("an unknown model falls back to gpt-image-1 rates, never zero", () => {
    const cost = estimateImageCostUsd({
      model: "ideogram-v3-turbo",
      size: "1536x1024",
    });

    expect(cost).toBe(0.25);
    expect(cost).toBeGreaterThan(0);
  });
});
