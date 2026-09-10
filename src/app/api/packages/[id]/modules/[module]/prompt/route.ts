import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { buildPromptFor } from "@/lib/prompts/dispatch";
import { type ApiError } from "@/lib/validation";
import { MODULE_KEYS } from "@/lib/modules/registry";

/**
 * GET /api/packages/[id]/modules/[module]/prompt?note=...
 *
 * Returns the constructed prompt string the Inngest function would send
 * for `module` given the current creator state, optionally with the
 * regenerate-note suffix appended. Powers the "Show prompt" expander on
 * each module card (PR Phase 2). Read-only, idempotent.
 *
 *   200 -> { prompt: string }
 *   400 -> invalid id / unknown module / oversized note
 *   404 -> package not found / not owned by user
 */

const UuidParam = z.string().uuid();
const ModuleParam = z.enum(MODULE_KEYS);

// 1000 chars matches the regenerate POST validation. Notes longer than
// this are rejected at the same boundary in both places.
const NoteParam = z.string().max(1000).optional();

type RouteCtx = { params: Promise<{ id: string; module: string }> };

export async function GET(req: NextRequest, { params }: RouteCtx) {
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

  const noteR = NoteParam.safeParse(
    req.nextUrl.searchParams.get("note") ?? undefined,
  );
  if (!noteR.success) {
    return NextResponse.json<ApiError>(
      { error: "Note exceeds 1000 chars.", code: "invalid_note" },
      { status: 400 },
    );
  }

  try {
    const prompt = await buildPromptFor({
      packageId: idR.data,
      userId: user.id,
      module: modR.data,
      regenerateNote: noteR.data,
    });
    return NextResponse.json({ prompt }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Build failed";
    if (message.includes("not found")) {
      return NextResponse.json<ApiError>(
        { error: "Package not found.", code: "not_found" },
        { status: 404 },
      );
    }
    throw err;
  }
}
