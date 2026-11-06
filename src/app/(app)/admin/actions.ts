'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { writeAudit } from '@/lib/audit';
import { db } from '@/lib/db';
import { ForbiddenError, requireRole } from '@/lib/session';
import { runSync, SyncAlreadyRunningError } from '@/sync/run-sync';

export interface ActionState {
  ok: boolean;
  message: string;
}

async function requireAdmin() {
  try {
    return { user: await requireRole(['ADMIN']) };
  } catch (error) {
    if (error instanceof ForbiddenError) return { error: error.message };
    throw error;
  }
}

const roleSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(['ADMIN', 'TECH', 'READONLY']),
});

/** ADMIN only: change a user's role (audited). The last admin cannot be demoted. */
export async function setUserRole(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await requireAdmin();
  if (!auth.user) return { ok: false, message: auth.error };

  const parsed = roleSchema.safeParse({
    userId: formData.get('userId'),
    role: formData.get('role'),
  });
  if (!parsed.success) return { ok: false, message: 'Invalid input.' };
  const { userId, role } = parsed.data;

  const target = await db.user.findUnique({ where: { id: userId } });
  if (!target) return { ok: false, message: 'User not found.' };
  if (target.role === role) return { ok: true, message: 'No change.' };

  if (target.role === 'ADMIN') {
    const admins = await db.user.count({ where: { role: 'ADMIN' } });
    if (admins <= 1) return { ok: false, message: 'You cannot demote the last admin.' };
  }

  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { role } });
    await writeAudit(
      {
        userId: auth.user.id,
        action: 'user.role.update',
        entity: 'User',
        entityId: userId,
        before: { role: target.role },
        after: { role },
      },
      tx,
    );
  });

  revalidatePath('/admin');
  return { ok: true, message: `${target.email} is now ${role}.` };
}

/** ADMIN only: run the Syncro + Pax8 sync and reconciliation now. */
export async function runSyncAction(): Promise<ActionState> {
  const auth = await requireAdmin();
  if (!auth.user) return { ok: false, message: auth.error };

  try {
    const result = await runSync(auth.user.id);
    revalidatePath('/', 'layout');
    const parts = result.sources.map(
      (s) =>
        `${s.source}: ${s.status === 'SUCCESS' ? `${s.recordsRead} records` : `failed (${s.error})`}`,
    );
    if (result.reconciliation) {
      const r = result.reconciliation;
      parts.push(`issues: ${r.created} new, ${r.updated} updated, ${r.autoResolved} auto-resolved`);
    }
    const ok = result.sources.every((s) => s.status === 'SUCCESS');
    return { ok, message: `Sync (${result.mode}) finished. ${parts.join('; ')}.` };
  } catch (error) {
    if (error instanceof SyncAlreadyRunningError) return { ok: false, message: error.message };
    throw error;
  }
}
