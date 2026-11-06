import { db } from '@/lib/db';
import type { Prisma } from '@/generated/prisma/client';

type Tx = Prisma.TransactionClient | typeof db;

export interface AuditEntry {
  /** Null for system jobs (e.g. `pnpm sync` from the command line). */
  userId: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  before?: Prisma.InputJsonValue | null;
  after?: Prisma.InputJsonValue | null;
}

/**
 * Records a write action. Pass the transaction client when the write itself runs in a
 * transaction so the change and its audit entry succeed or fail together.
 * Never put secrets in `before`/`after`.
 */
export async function writeAudit(entry: AuditEntry, tx: Tx = db) {
  await tx.auditLog.create({
    data: {
      userId: entry.userId,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId ?? null,
      before: entry.before ?? undefined,
      after: entry.after ?? undefined,
    },
  });
}
