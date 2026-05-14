import { type NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { creators } from '@/lib/db/schema';
import { CreatorPatchSchema } from '@/types/schemas';
import { validateBody, ValidationError, type ApiError } from '@/lib/validation';
import { logAudit } from '@/lib/audit';
import { parsePublicStorageUrl } from '@/lib/storage/parse-public-url';

/**
 * GET    /api/creators/[id] — fetch one creator.
 * PATCH  /api/creators/[id] — partial update (draft autosave).
 *
 * Workspace-wide: any authenticated VA can read/edit any creator so package
 * handoffs work cleanly.
 */

const UuidParam = z.string().uuid();

type RouteCtx = { params: Promise<{ id: string }> };

async function findCreator(id: string) {
  const [row] = await db
    .select()
    .from(creators)
    .where(eq(creators.id, id))
    .limit(1);
  return row;
}

export async function GET(_req: NextRequest, { params }: RouteCtx) {
  await requireUser();
  const { id } = await params;

  const idResult = UuidParam.safeParse(id);
  if (!idResult.success) {
    return NextResponse.json<ApiError>(
      { error: 'Invalid creator id.', code: 'invalid_id' },
      { status: 400 },
    );
  }

  const row = await findCreator(idResult.data);
  if (!row) {
    return NextResponse.json<ApiError>(
      { error: 'Creator not found.', code: 'not_found' },
      { status: 404 },
    );
  }
  return NextResponse.json(row);
}

export async function PATCH(req: NextRequest, { params }: RouteCtx) {
  const user = await requireUser();
  const { id } = await params;

  const idResult = UuidParam.safeParse(id);
  if (!idResult.success) {
    return NextResponse.json<ApiError>(
      { error: 'Invalid creator id.', code: 'invalid_id' },
      { status: 400 },
    );
  }

  let body;
  try {
    body = await validateBody(req, CreatorPatchSchema);
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json<ApiError>(err.payload, { status: 400 });
    }
    throw err;
  }

  const existing = await findCreator(idResult.data);
  if (!existing) {
    return NextResponse.json<ApiError>(
      { error: 'Creator not found.', code: 'not_found' },
      { status: 404 },
    );
  }

  // Build camelCase update object only from provided snake_case fields.
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (body.name !== undefined) updates.name = body.name;
  if (body.community_name !== undefined) updates.communityName = body.community_name;
  if (body.niche !== undefined) updates.niche = body.niche;
  if (body.audience !== undefined) updates.audience = body.audience;
  if (body.transformation !== undefined) updates.transformation = body.transformation;
  if (body.tone !== undefined) updates.tone = body.tone;
  if (body.offer_breakdown !== undefined) updates.offerBreakdown = body.offer_breakdown;
  if (body.pricing !== undefined) updates.pricing = body.pricing;
  if (body.trial_terms !== undefined) updates.trialTerms = body.trial_terms;
  if (body.refund_policy !== undefined) updates.refundPolicy = body.refund_policy;
  if (body.support_contact !== undefined) updates.supportContact = body.support_contact;
  if (body.brand_prefs !== undefined) updates.brandPrefs = body.brand_prefs;
  if (body.creator_photo_url !== undefined) {
    updates.creatorPhotoUrl = body.creator_photo_url;
    // Keep creatorPhotoPath in sync with the URL (signed-URLs migration
    // stage 2). Explicit null clears both; a non-null URL that fails the
    // public-storage shape check leaves the path untouched so we don't
    // wipe a valid backfilled path on a malformed update.
    if (body.creator_photo_url === null) {
      updates.creatorPhotoPath = null;
    } else {
      const parsed = parsePublicStorageUrl(body.creator_photo_url);
      if (parsed) {
        updates.creatorPhotoPath = parsed.path;
      } else {
        console.warn(
          `creator_photo_url did not match public-storage shape; leaving path unchanged: ${body.creator_photo_url}`,
        );
      }
    }
  }
  if (body.classroom_titles !== undefined) updates.classroomIntake = body.classroom_titles;
  if (body.calendar_intake !== undefined) updates.calendarIntake = body.calendar_intake;
  if (body.leaderboard_levels !== undefined) updates.leaderboardLevels = body.leaderboard_levels;
  if (body.categories !== undefined) updates.categories = body.categories;
  if (body.discovery_keywords !== undefined) updates.discoveryKeywords = body.discovery_keywords;

  const [row] = await db
    .update(creators)
    .set(updates)
    .where(eq(creators.id, idResult.data))
    .returning();

  await logAudit(user.id, 'creator.update', 'creator', row.id, body);

  return NextResponse.json(row);
}
