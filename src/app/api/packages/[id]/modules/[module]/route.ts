import { type NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { z, type ZodSchema } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  generatedAssets,
  launchPackages,
  type GeneratedAsset,
} from "@/lib/db/schema";
import { logAudit } from "@/lib/audit";
import { WelcomeDmSchema } from "@/prompts/welcome-dm";
import { TransformationSchema } from "@/prompts/transformation";
import { AboutUsSchema } from "@/prompts/about-us";
import { StartHereSchema } from "@/prompts/start-here";
import type { ApiError } from "@/lib/validation";

/**
 * PATCH /api/packages/[id]/modules/[module]
 *
 * VA-supplied content edit. Validates the payload against the module's
 * generation schema, increments the version, snapshots the previous version
 * into `edit_history`, and clears approval (the VA must re-approve after an
 * edit).
 *
 * For 'cover', the only allowed change is `selected_variant_index`; we
 * preserve `variants` and validate shape inline since cover doesn't have a
 * generation schema.
 */

const UuidParam = z.string().uuid();

const ModuleParam = z.enum([
  "welcome_dm",
  "transformation",
  "about_us",
  "start_here",
  "cover",
]);

type ModuleName = z.infer<typeof ModuleParam>;

const COPY_SCHEMAS: Record<Exclude<ModuleName, "cover">, ZodSchema> = {
  welcome_dm: WelcomeDmSchema,
  transformation: TransformationSchema,
  about_us: AboutUsSchema,
  start_here: StartHereSchema,
};

const CoverPatchSchema = z.object({
  selected_variant_index: z.number().int().min(0),
});

const PatchSchema = z.object({
  content: z.unknown(),
});

type CoverContent = {
  variants: { url: string; index: number }[];
  selected_variant_index?: number;
};

type EditHistoryEntry = {
  version: number;
  content: unknown;
  authorId: string;
  editedAt: string;
};

type RouteCtx = { params: Promise<{ id: string; module: string }> };

export async function PATCH(req: NextRequest, { params }: RouteCtx) {
  const user = await requireUser();
  const { id, module } = await params;

  const idR = UuidParam.safeParse(id);
  if (!idR.success) {
    return NextResponse.json<ApiError>(
      { error: "Invalid package id.", code: "invalid_id" },
      { status: 400 },
    );
  }

  const modR = ModuleParam.safeParse(module);
  if (!modR.success) {
    return NextResponse.json<ApiError>(
      { error: `Unknown module '${module}'.`, code: "invalid_module" },
      { status: 400 },
    );
  }

  const raw = await req.json().catch(() => null);
  const bodyR = PatchSchema.safeParse(raw);
  if (!bodyR.success) {
    return NextResponse.json<ApiError>(
      { error: "Body must be { content: ... }.", code: "invalid_body" },
      { status: 400 },
    );
  }

  // Own-row check.
  const [pkg] = await db
    .select({ id: launchPackages.id })
    .from(launchPackages)
    .where(
      and(
        eq(launchPackages.id, idR.data),
        eq(launchPackages.createdBy, user.id),
      ),
    )
    .limit(1);
  if (!pkg) {
    return NextResponse.json<ApiError>(
      { error: "Package not found.", code: "not_found" },
      { status: 404 },
    );
  }

  // Latest asset for this module.
  const [latest] = await db
    .select()
    .from(generatedAssets)
    .where(
      and(
        eq(generatedAssets.packageId, idR.data),
        eq(generatedAssets.module, modR.data),
      ),
    )
    .orderBy(desc(generatedAssets.version), desc(generatedAssets.createdAt))
    .limit(1);
  if (!latest) {
    return NextResponse.json<ApiError>(
      { error: `No ${modR.data} asset to edit.`, code: "not_found" },
      { status: 404 },
    );
  }

  // Validate the new content per module shape.
  let nextContent: unknown;
  if (modR.data === "cover") {
    const coverPatch = CoverPatchSchema.safeParse(bodyR.data.content);
    if (!coverPatch.success) {
      return NextResponse.json<ApiError>(
        {
          error: "Cover edit must be { selected_variant_index: number }.",
          code: "invalid_content",
        },
        { status: 400 },
      );
    }
    const current = latest.content as CoverContent;
    const idx = coverPatch.data.selected_variant_index;
    if (idx >= current.variants.length) {
      return NextResponse.json<ApiError>(
        { error: "Variant index out of range.", code: "invalid_content" },
        { status: 400 },
      );
    }
    nextContent = { ...current, selected_variant_index: idx };
  } else {
    const schema = COPY_SCHEMAS[modR.data];
    const result = schema.safeParse(bodyR.data.content);
    if (!result.success) {
      return NextResponse.json<ApiError>(
        {
          error: "Content does not match module schema.",
          code: "invalid_content",
          details: result.error.flatten(),
        } as ApiError,
        { status: 400 },
      );
    }
    nextContent = result.data;
  }

  // Snapshot the previous version into edit_history, then bump.
  const prevHistory = (latest.editHistory as EditHistoryEntry[]) ?? [];
  const historyEntry: EditHistoryEntry = {
    version: latest.version,
    content: latest.content,
    authorId: user.id,
    editedAt: new Date().toISOString(),
  };

  const [updated] = await db
    .update(generatedAssets)
    .set({
      content: nextContent as object,
      version: latest.version + 1,
      editHistory: [...prevHistory, historyEntry],
      approved: false,
      approvedBy: null,
      approvedAt: null,
    })
    .where(eq(generatedAssets.id, latest.id))
    .returning();

  await logAudit(
    user.id,
    `module.edit.${modR.data}`,
    "generated_asset",
    updated.id,
    { module: modR.data, newVersion: updated.version },
  );

  return NextResponse.json<GeneratedAsset>(updated);
}
