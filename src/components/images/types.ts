import type { SlotPlanResult } from "@/lib/images/slots";
import type { ImageStyleSpec } from "@/lib/images/style-spec";

/** Shape of GET /api/packages/[id]/images. */
export type ImagesRunSummary = {
  id: string;
  status: "queued" | "running" | "done" | "failed" | "cancelled";
  plannedSlotKeys: string[];
  error: string | null;
  usage: {
    imageCount: number;
    doneCount: number;
    failedCount: number;
    costUsd: number;
    durationMs: number;
  } | null;
  createdAt: string;
  completedAt: string | null;
};

export type ImageAssetSummary = {
  id: string;
  slotKey: string;
  slotKind: string;
  slotIndex: number;
  slotTitle: string | null;
  status: "queued" | "running" | "done" | "failed" | "cancelled";
  version: number;
  width: number | null;
  height: number | null;
  error: string | null;
  createdAt: string;
  url: string | null;
};

export type ImageReferenceSummary = {
  kind: "headshot" | "brand_kit";
  path: string;
  url: string | null;
};

export type PinnedStyleSpecSummary = {
  id: string;
  version: number;
  source: string;
  spec: ImageStyleSpec;
};

export type ImagesResponse = {
  providerConfigured: boolean;
  run: ImagesRunSummary | null;
  styleSpec: PinnedStyleSpecSummary | null;
  plan: SlotPlanResult;
  assets: ImageAssetSummary[];
  references: ImageReferenceSummary[];
};
