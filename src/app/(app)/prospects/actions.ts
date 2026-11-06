'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { writeAudit } from '@/lib/audit';
import { db } from '@/lib/db';
import { parseDate, parseProspectCsv, PROSPECT_STATUSES } from '@/lib/prospect-csv';
import { ForbiddenError, requireRole } from '@/lib/session';

export interface ActionState {
  ok: boolean;
  message: string;
  errors?: string[];
}

async function requireEditor() {
  try {
    return { user: await requireRole(['ADMIN', 'TECH']) };
  } catch (error) {
    if (error instanceof ForbiddenError) return { error: error.message };
    throw error;
  }
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === '' ? null : value));

const updateSchema = z.object({
  id: z.string().min(1),
  status: z.enum(PROSPECT_STATUSES),
  owner: optionalText(100),
  lastContact: z.string().trim(),
  nextStep: optionalText(500),
});

export type ProspectUpdate = z.input<typeof updateSchema>;

/** Inline edit of status, owner, last contact and next step (TECH/ADMIN, audited). */
export async function updateProspect(input: ProspectUpdate): Promise<ActionState> {
  const auth = await requireEditor();
  if (!auth.user) return { ok: false, message: auth.error };

  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Invalid input.' };
  }
  const { id, status, owner, nextStep } = parsed.data;
  const lastContactAt = parseDate(parsed.data.lastContact);
  if (lastContactAt === undefined) return { ok: false, message: 'Invalid last contact date.' };

  const before = await db.prospect.findUnique({ where: { id } });
  if (!before) return { ok: false, message: 'Prospect not found.' };

  await db.$transaction(async (tx) => {
    const after = await tx.prospect.update({
      where: { id },
      data: { status, owner, lastContactAt, nextStep },
    });
    await writeAudit(
      {
        userId: auth.user.id,
        action: 'prospect.update',
        entity: 'Prospect',
        entityId: id,
        before: {
          status: before.status,
          owner: before.owner,
          lastContactAt: before.lastContactAt?.toISOString() ?? null,
          nextStep: before.nextStep,
        },
        after: {
          status: after.status,
          owner: after.owner,
          lastContactAt: after.lastContactAt?.toISOString() ?? null,
          nextStep: after.nextStep,
        },
      },
      tx,
    );
  });

  revalidatePath('/prospects');
  return { ok: true, message: 'Saved.' };
}

const MAX_CSV_CHARS = 1_000_000;

/**
 * Imports prospects from CSV text. All-or-nothing: if any row is invalid, nothing is
 * imported. Rows whose company already exists (case-insensitive) are skipped.
 */
export async function importProspects(csvText: string): Promise<ActionState> {
  const auth = await requireEditor();
  if (!auth.user) return { ok: false, message: auth.error };

  if (typeof csvText !== 'string' || csvText.trim() === '') {
    return { ok: false, message: 'The file is empty.' };
  }
  if (csvText.length > MAX_CSV_CHARS)
    return { ok: false, message: 'The file is larger than 1 MB.' };

  const { rows, errors } = parseProspectCsv(csvText);
  if (errors.length > 0) {
    return {
      ok: false,
      message: `Nothing imported: ${errors.length} problem(s) found.`,
      errors: errors.slice(0, 20).map((e) => `Line ${e.line}: ${e.message}`),
    };
  }

  const existing = await db.prospect.findMany({ select: { company: true } });
  const seen = new Set(existing.map((p) => p.company.toLowerCase()));
  const toCreate = rows.filter((row) => {
    const key = row.company.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const skipped = rows.length - toCreate.length;

  await db.$transaction(async (tx) => {
    if (toCreate.length > 0) await tx.prospect.createMany({ data: toCreate });
    await writeAudit(
      {
        userId: auth.user.id,
        action: 'prospect.import',
        entity: 'Prospect',
        after: { imported: toCreate.length, skippedDuplicates: skipped },
      },
      tx,
    );
  });

  revalidatePath('/prospects');
  return {
    ok: true,
    message: `Imported ${toCreate.length} prospect(s)${skipped ? `, skipped ${skipped} duplicate(s)` : ''}.`,
  };
}
