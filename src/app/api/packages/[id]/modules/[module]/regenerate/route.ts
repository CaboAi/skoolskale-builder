import { type NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { launchPackages } from '@/lib/db/schema';
import { inngest } from '@/lib/inngest/client';
import { validateBody, ValidationError, type ApiError } from '@/lib/validation';
import { logAudit } from '@/lib/audit';

/**
 * POST /api/packages/[id]/modules/[module]/regenerate
 *
 * Queues a single-module regeneration. The event name matches the
 * per-module Inngest function (generate.<module>.requested), so this
 * path reuses the same handler as the orchestrator's fan-out.
 */

const UuidParam = z.string().uuid();

const ModuleParam = z.enum([
  'welcome_dm',
  'transformation',
  'about_us',
  'start_here',
]);

const RegenerateSchema = z
  .object({
    note: z.string().max(1000).optional(),
  })
  .default({});

type RouteCtx = { params: Promise<{ id: string; module: string }> };

export async function POST(req: NextRequest, { params }: RouteCtx) {
  const user = await requireUser();
  const { id, module } = await params;

  const idR = UuidParam.safeParse(id);
  if (!idR.success) {
    return NextResponse.json<ApiError>(
      { error: 'Invalid package id.', code: 'invalid_id' },
      { status: 400 },
    );
  }

  const modR = ModuleParam.safeParse(module);
  if (!modR.success) {
    return NextResponse.json<ApiError>(
      {
        error: `Unknown module '${module}'.`,
        code: 'invalid_module',
      },
      { status: 400 },
    );
  }

  let body;
  try {
    body = await validateBody(req, RegenerateSchema);
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json<ApiError>(err.payload, { status: 400 });
    }
    throw err;
  }

  // Own-row check — superuser DB connection bypasses RLS, so enforce here.
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
      { error: 'Package not found.', code: 'not_found' },
      { status: 404 },
    );
  }

  await inngest.send({
    name: `generate.${modR.data}.requested`,
    data: {
      packageId: idR.data,
      userId: user.id,
      regenerateNote: body.note,
    },
  });

  await logAudit(
    user.id,
    `module.regenerate.${modR.data}`,
    'package',
    idR.data,
    { module: modR.data, note: body.note },
  );

  return NextResponse.json({ status: 'queued', module: modR.data }, { status: 202 });
}
