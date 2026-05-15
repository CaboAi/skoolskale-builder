import { type NextRequest, NextResponse } from 'next/server';
import { desc } from 'drizzle-orm';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { creators } from '@/lib/db/schema';
import { CreatorDraftSchema } from '@/types/schemas';
import { validateBody, ValidationError, type ApiError } from '@/lib/validation';
import { logAudit } from '@/lib/audit';
import { parsePublicStorageUrl } from '@/lib/storage/parse-public-url';

/**
 * POST /api/creators — create a draft creator record from the Step 1
 * intake fields. NOT NULL columns the wizard hasn't filled yet get empty
 * defaults; later steps PATCH the real values in.
 *
 * GET /api/creators — list every creator in the workspace, newest first.
 * Workspace-wide so VAs can pick up handoffs.
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

  // Derive the storage path from the public URL so newly-created rows
  // already carry both fields (signed-URLs migration stage 2). If the URL
  // doesn't match the Supabase public-storage shape (e.g. hand-pasted or
  // external), persist URL only and warn — never block the create.
  let creatorPhotoPath: string | null | undefined = undefined;
  if (body.creator_photo_url) {
    const parsed = parsePublicStorageUrl(body.creator_photo_url);
    if (parsed) {
      creatorPhotoPath = parsed.path;
    } else {
      console.warn(
        `creator_photo_url did not match public-storage shape; storing url only: ${body.creator_photo_url}`,
      );
    }
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
      tone: 'warm',
      offerBreakdown: {
        perks: [],
        guest_sessions: false,
      },
      pricing: { additional_tiers: [] },
      trialTerms: { has_trial: false, duration_days: 7 },
      refundPolicy: '',
      supportContact: body.support_contact,
      brandPrefs: '',
      creatorPhotoUrl: body.creator_photo_url,
      creatorPhotoPath,
      createdBy: user.id,
    })
    .returning();

  await logAudit(user.id, 'creator.create', 'creator', row.id, body);

  return NextResponse.json(row, { status: 201 });
}

export async function GET() {
  await requireUser();

  const rows = await db
    .select()
    .from(creators)
    .orderBy(desc(creators.createdAt));

  return NextResponse.json({ creators: rows });
}
