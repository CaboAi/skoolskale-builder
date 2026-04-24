import { type NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { launchPackages } from '@/lib/db/schema';
import { inngest, Events } from '@/lib/inngest/client';
import { logAudit } from '@/lib/audit';
import type { ApiError } from '@/lib/validation';

/**
 * POST /api/packages/[id]/generate — enqueue the full-package generation.
 *
 * Per CLAUDE.md rule #1: no Claude calls from route handlers. We only move
 * the package into 'generating' state and hand off to Inngest.
 */

const UuidParam = z.string().uuid();

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: RouteCtx) {
  const user = await requireUser();
  const { id } = await params;

  const idResult = UuidParam.safeParse(id);
  if (!idResult.success) {
    return NextResponse.json<ApiError>(
      { error: 'Invalid package id.', code: 'invalid_id' },
      { status: 400 },
    );
  }

  const [pkg] = await db
    .select()
    .from(launchPackages)
    .where(
      and(
        eq(launchPackages.id, idResult.data),
        eq(launchPackages.createdBy, user.id),
      ),
    )
    .limit(1);
  if (!pkg) {
    return NextResponse.json<ApiError>(
      { error: 'Package not found.', code: 'not_found' },
      { status: 404 },
    );
  }

  if (pkg.status === 'generating') {
    return NextResponse.json<ApiError>(
      { error: 'Package is already generating.', code: 'already_generating' },
      { status: 409 },
    );
  }

  await db
    .update(launchPackages)
    .set({ status: 'generating', progressPct: 0 })
    .where(eq(launchPackages.id, idResult.data));

  await inngest.send({
    name: Events.PackageGenerateRequested,
    data: { packageId: idResult.data, userId: user.id },
  });

  await logAudit(user.id, 'package.generate', 'package', idResult.data, null);

  return NextResponse.json({ status: 'queued' }, { status: 202 });
}
