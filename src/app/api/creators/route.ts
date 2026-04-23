import { type NextRequest, NextResponse } from 'next/server';
import { eq, desc } from 'drizzle-orm';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { creators } from '@/lib/db/schema';
import { CreatorIntakeSchema } from '@/types/schemas';
import { validateBody, ValidationError, type ApiError } from '@/lib/validation';
import { logAudit } from '@/lib/audit';

/**
 * POST /api/creators — create a new creator record.
 * GET  /api/creators — list the current user's creators (newest first).
 *
 * Both require an authed session (enforced by requireUser()).
 */

export async function POST(req: NextRequest) {
  const user = await requireUser();

  let body;
  try {
    body = await validateBody(req, CreatorIntakeSchema);
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json<ApiError>(err.payload, { status: 400 });
    }
    throw err;
  }

  const [row] = await db
    .insert(creators)
    .values({
      name: body.name,
      communityName: body.community_name,
      niche: body.niche,
      audience: body.audience,
      transformation: body.transformation,
      tone: body.tone,
      offerBreakdown: body.offer_breakdown,
      pricing: body.pricing,
      trialTerms: body.trial_terms,
      refundPolicy: body.refund_policy,
      supportContact: body.support_contact,
      brandPrefs: body.brand_prefs,
      creatorPhotoUrl: body.creator_photo_url,
      createdBy: user.id,
    })
    .returning();

  await logAudit(user.id, 'creator.create', 'creator', row.id, body);

  return NextResponse.json(row, { status: 201 });
}

export async function GET() {
  const user = await requireUser();

  const rows = await db
    .select()
    .from(creators)
    .where(eq(creators.createdBy, user.id))
    .orderBy(desc(creators.createdAt));

  return NextResponse.json({ creators: rows });
}
