import { type NextRequest, NextResponse } from 'next/server';
import { eq, desc } from 'drizzle-orm';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { creators } from '@/lib/db/schema';
import { CreatorDraftSchema } from '@/types/schemas';
import { validateBody, ValidationError, type ApiError } from '@/lib/validation';
import { logAudit } from '@/lib/audit';

/**
 * POST /api/creators — create a draft creator record from the Step 1
 * intake fields. NOT NULL columns the wizard hasn't filled yet get empty
 * defaults; later steps PATCH the real values in.
 *
 * GET /api/creators — list the current user's creators (newest first).
 */

export async function POST(req: NextRequest) {
  const user = await requireUser();

  let body;
  try {
    body = await validateBody(req, CreatorDraftSchema);
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
      // Step 2-4 defaults — PATCH fills in real values.
      audience: '',
      transformation: '',
      tone: 'loving',
      offerBreakdown: {
        courses: [],
        perks: [],
        events: [],
        guest_sessions: false,
      },
      pricing: { tiers: [] },
      trialTerms: { has_trial: false },
      refundPolicy: '',
      supportContact: body.support_contact,
      brandPrefs: '',
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
