import { type NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { creators, launchPackages } from '@/lib/db/schema';
import { validateBody, ValidationError, type ApiError } from '@/lib/validation';
import { logAudit } from '@/lib/audit';

/**
 * POST /api/packages — create a launch_package from a creator the user owns.
 *
 * Keeps launch_packages decoupled from the intake wizard: the wizard creates
 * the creator; the dashboard (or the wizard's final step) creates the
 * package when it's ready to generate.
 */

const PackageCreateSchema = z.object({
  creator_id: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  const user = await requireUser();

  let body;
  try {
    body = await validateBody(req, PackageCreateSchema);
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json<ApiError>(err.payload, { status: 400 });
    }
    throw err;
  }

  // Workspace-wide: any VA can attach a package to any creator. The creator
  // just needs to exist.
  const [creator] = await db
    .select({ id: creators.id })
    .from(creators)
    .where(eq(creators.id, body.creator_id))
    .limit(1);
  if (!creator) {
    return NextResponse.json<ApiError>(
      { error: 'Creator not found.', code: 'not_found' },
      { status: 404 },
    );
  }

  const [row] = await db
    .insert(launchPackages)
    .values({
      creatorId: body.creator_id,
      status: 'draft',
      createdBy: user.id,
    })
    .returning();

  await logAudit(user.id, 'package.create', 'package', row.id, body);

  return NextResponse.json(row, { status: 201 });
}
