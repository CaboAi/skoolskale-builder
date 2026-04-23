import 'server-only';
import { db } from '@/lib/db';
import { auditLog } from '@/lib/db/schema';

/**
 * Write an audit row. Entity type/id identify what was acted upon;
 * payload is a free-form JSON snapshot of the change or request body.
 * Never throws — audit failures must not break the user's request.
 */
export async function logAudit(
  userId: string,
  action: string,
  entityType: string,
  entityId: string | null,
  payload: unknown,
): Promise<void> {
  try {
    await db.insert(auditLog).values({
      userId,
      action,
      entityType,
      entityId,
      payload: payload as object,
    });
  } catch (err) {
    console.error('[audit] failed to log:', action, entityType, entityId, err);
  }
}
