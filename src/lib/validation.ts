import 'server-only';
import type { NextRequest } from 'next/server';
import type { ZodType } from 'zod';

export type ApiError = {
  error: string;
  code: string;
  details?: unknown;
};

/**
 * Parse + validate a JSON request body. Throws a tagged error the route
 * handler turns into a 400 response.
 */
export class ValidationError extends Error {
  readonly payload: ApiError;
  constructor(payload: ApiError) {
    super(payload.error);
    this.payload = payload;
  }
}

export async function validateBody<T>(
  req: NextRequest,
  schema: ZodType<T>,
): Promise<T> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new ValidationError({
      error: 'Request body must be valid JSON.',
      code: 'invalid_json',
    });
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new ValidationError({
      error: 'Invalid request body.',
      code: 'validation_failed',
      details: parsed.error.flatten().fieldErrors,
    });
  }
  return parsed.data;
}
