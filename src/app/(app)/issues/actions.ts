'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { writeAudit } from '@/lib/audit';
import { db } from '@/lib/db';
import { ISSUE_STATUSES, ISSUE_TYPES } from '@/lib/issues';
import { ForbiddenError, requireRole } from '@/lib/session';

export interface ActionState {
  ok: boolean;
  message: string;
}

const resolveSchema = z.object({
  issueId: z.string().min(1),
  status: z.enum(['RESOLVED', 'IGNORED']),
  note: z.string().trim().min(3, 'A note of at least 3 characters is required.').max(2000),
  // The queue filters to return to; only known values are accepted (no open redirect).
  filterType: z.enum(ISSUE_TYPES).optional().catch(undefined),
  filterStatus: z
    .enum([...ISSUE_STATUSES, 'ALL'])
    .optional()
    .catch(undefined),
});

/**
 * TECH/ADMIN only: resolve or ignore an open issue with a required note (audited).
 * On success, redirects back to the queue with a confirmation notice.
 */
export async function resolveIssue(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let user;
  try {
    user = await requireRole(['ADMIN', 'TECH']);
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, message: error.message };
    throw error;
  }

  const parsed = resolveSchema.safeParse({
    issueId: formData.get('issueId'),
    status: formData.get('status'),
    note: formData.get('note'),
    filterType: formData.get('filterType') || undefined,
    filterStatus: formData.get('filterStatus') || undefined,
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Invalid input.' };
  }
  const { issueId, status, note, filterType, filterStatus } = parsed.data;

  const result = await db.$transaction(async (tx) => {
    const issue = await tx.reconciliationIssue.findUnique({ where: { id: issueId } });
    if (!issue || issue.status !== 'OPEN') return null;
    const updated = await tx.reconciliationIssue.update({
      where: { id: issueId },
      data: { status, note, resolvedById: user.id, resolvedAt: new Date() },
    });
    await writeAudit(
      {
        userId: user.id,
        action: status === 'RESOLVED' ? 'issue.resolve' : 'issue.ignore',
        entity: 'ReconciliationIssue',
        entityId: issueId,
        before: { status: issue.status, note: issue.note },
        after: { status: updated.status, note: updated.note },
      },
      tx,
    );
    return updated;
  });

  if (!result) return { ok: false, message: 'This issue is no longer open.' };
  revalidatePath('/issues');
  revalidatePath('/');

  // The issue leaves the open queue (and this form unmounts), so confirm on the page itself.
  const query = new URLSearchParams({ notice: status === 'RESOLVED' ? 'resolved' : 'ignored' });
  if (filterType) query.set('type', filterType);
  if (filterStatus) query.set('status', filterStatus);
  redirect(`/issues?${query.toString()}`);
}
