import { describe, expect, test, vi, beforeEach } from "vitest";

type SignedItem = {
  path: string;
  signedUrl?: string;
  error?: string | null;
};

const { createSignedUrlsMock } = vi.hoisted(() => ({
  createSignedUrlsMock: vi.fn<
    (
      paths: string[],
      ttl: number,
    ) => Promise<{
      data: SignedItem[] | null;
      error: { message: string } | null;
    }>
  >(),
}));

const fromMock = vi.fn(() => ({
  createSignedUrls: createSignedUrlsMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => ({
    storage: { from: fromMock },
  }),
}));

import { resolveAssetUrls } from "@/lib/storage/resolve-variants";
import type { GeneratedAsset } from "@/lib/db/schema";

const baseAsset: Omit<GeneratedAsset, "module" | "content" | "id"> = {
  packageId: "11111111-1111-1111-1111-111111111111",
  version: 1,
  approved: false,
  approvedBy: null,
  approvedAt: null,
  editHistory: [],
  vaNotes: null,
  qualityScore: null,
  createdBy: "22222222-2222-2222-2222-222222222222",
  createdAt: new Date("2026-05-01T00:00:00Z"),
};

function makeCover(id: string, paths: string[]): GeneratedAsset {
  return {
    ...baseAsset,
    id,
    module: "cover",
    content: {
      variants: paths.map((p, i) => ({
        url: `https://public.example/${p}`,
        storagePath: p,
        index: i,
      })),
      selected_variant_index: 0,
    },
  } as GeneratedAsset;
}

function makeIcon(id: string, paths: string[]): GeneratedAsset {
  return {
    ...baseAsset,
    id,
    module: "icon",
    content: {
      variants: paths.map((p, i) => ({
        url: `https://public.example/${p}`,
        storagePath: p,
        index: i,
      })),
    },
  } as GeneratedAsset;
}

function makeTextAsset(id: string): GeneratedAsset {
  return {
    ...baseAsset,
    id,
    module: "welcome_dm",
    content: { content: "Hello!" },
  } as GeneratedAsset;
}

beforeEach(() => {
  createSignedUrlsMock.mockReset();
  fromMock.mockClear();
});

describe("resolveAssetUrls", () => {
  test("rewrites variant.url to signed URLs and leaves storagePath intact", async () => {
    createSignedUrlsMock.mockImplementation(async (paths) => ({
      data: paths.map((p) => ({
        path: p,
        signedUrl: `https://signed.example/${p}?token=xyz`,
        error: null,
      })),
      error: null,
    }));

    const asset = makeCover("a1", ["pkg/variant-1.png", "pkg/variant-2.png"]);
    const [out] = await resolveAssetUrls([asset]);

    const content = out.content as {
      variants: { url: string; storagePath: string; index: number }[];
    };
    expect(content.variants[0].url).toBe(
      "https://signed.example/pkg/variant-1.png?token=xyz",
    );
    expect(content.variants[1].url).toBe(
      "https://signed.example/pkg/variant-2.png?token=xyz",
    );
    expect(content.variants[0].storagePath).toBe("pkg/variant-1.png");
    expect(content.variants[1].storagePath).toBe("pkg/variant-2.png");
  });

  test("does not mutate the input asset array", async () => {
    createSignedUrlsMock.mockImplementation(async (paths) => ({
      data: paths.map((p) => ({
        path: p,
        signedUrl: `https://signed.example/${p}?token=t`,
        error: null,
      })),
      error: null,
    }));

    const asset = makeCover("a1", ["pkg/v.png"]);
    const inputContent = asset.content as { variants: { url: string }[] };
    const beforeUrl = inputContent.variants[0].url;

    await resolveAssetUrls([asset]);

    expect(inputContent.variants[0].url).toBe(beforeUrl);
  });

  test("batches per bucket — one createSignedUrls call per distinct bucket", async () => {
    createSignedUrlsMock.mockImplementation(async (paths) => ({
      data: paths.map((p) => ({
        path: p,
        signedUrl: `https://signed.example/${p}?token=z`,
        error: null,
      })),
      error: null,
    }));

    const cover = makeCover("c1", ["pkg/variant-1.png", "pkg/variant-2.png"]);
    const icon = makeIcon("i1", ["pkg/icon/variant-1.png"]);

    await resolveAssetUrls([cover, icon]);

    // Two buckets touched, exactly one batch call per bucket.
    expect(fromMock).toHaveBeenCalledTimes(2);
    expect(fromMock).toHaveBeenCalledWith("cover-variants");
    expect(fromMock).toHaveBeenCalledWith("image-variants");
    expect(createSignedUrlsMock).toHaveBeenCalledTimes(2);
    expect(createSignedUrlsMock).toHaveBeenCalledWith(
      ["pkg/variant-1.png", "pkg/variant-2.png"],
      3600,
    );
    expect(createSignedUrlsMock).toHaveBeenCalledWith(
      ["pkg/icon/variant-1.png"],
      3600,
    );
  });

  test("skips signing entirely for text-only modules", async () => {
    const text = makeTextAsset("t1");
    const [out] = await resolveAssetUrls([text]);

    expect(out).toBe(text);
    expect(createSignedUrlsMock).not.toHaveBeenCalled();
  });

  test("falls back to existing url when a variant has no storagePath", async () => {
    // Build a row where one variant is missing storagePath; the other has it.
    const half = {
      ...baseAsset,
      id: "h1",
      module: "cover",
      content: {
        variants: [
          {
            url: "https://public.example/legacy.png",
            index: 0,
            // storagePath intentionally absent
          },
          {
            url: "https://public.example/pkg/v2.png",
            storagePath: "pkg/v2.png",
            index: 1,
          },
        ],
      },
    } as GeneratedAsset;

    createSignedUrlsMock.mockResolvedValue({
      data: [
        {
          path: "pkg/v2.png",
          signedUrl: "https://signed.example/pkg/v2.png?token=t",
          error: null,
        },
      ],
      error: null,
    });

    const [out] = await resolveAssetUrls([half]);
    const variants = (
      out.content as { variants: { url: string; index: number }[] }
    ).variants;

    expect(variants[0].url).toBe("https://public.example/legacy.png");
    expect(variants[1].url).toBe(
      "https://signed.example/pkg/v2.png?token=t",
    );
    // Only the path-bearing variant gets signed.
    expect(createSignedUrlsMock).toHaveBeenCalledWith(["pkg/v2.png"], 3600);
  });

  test("keeps the existing url when a per-item error comes back from Supabase", async () => {
    createSignedUrlsMock.mockResolvedValue({
      data: [
        {
          path: "pkg/v1.png",
          error: "object not found",
        },
      ],
      error: null,
    });

    const asset = makeCover("e1", ["pkg/v1.png"]);
    const inputUrl = (
      asset.content as { variants: { url: string }[] }
    ).variants[0].url;

    const [out] = await resolveAssetUrls([asset]);
    expect((out.content as { variants: { url: string }[] }).variants[0].url).toBe(
      inputUrl,
    );
  });

  test("returns input unchanged when no image assets are present", async () => {
    const input: GeneratedAsset[] = [makeTextAsset("t1"), makeTextAsset("t2")];
    const out = await resolveAssetUrls(input);
    expect(out).toBe(input);
    expect(createSignedUrlsMock).not.toHaveBeenCalled();
  });
});
