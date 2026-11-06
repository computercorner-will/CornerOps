'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { resolveIssue, type ActionState } from './actions';

const initialState: ActionState = { ok: false, message: '' };

/**
 * Resolve/ignore form for one issue. On success the action redirects back to the queue
 * (keeping the current filters) and the page shows the confirmation; errors show here.
 */
export function ResolveForm({
  issueId,
  filterType,
  filterStatus,
}: {
  issueId: string;
  filterType?: string;
  filterStatus?: string;
}) {
  const [state, formAction, pending] = useActionState(resolveIssue, initialState);

  return (
    <form action={formAction} className="flex min-w-72 flex-col gap-2">
      <input type="hidden" name="issueId" value={issueId} />
      <input type="hidden" name="filterType" value={filterType ?? ''} />
      <input type="hidden" name="filterStatus" value={filterStatus ?? ''} />
      <Input
        name="note"
        required
        minLength={3}
        maxLength={2000}
        placeholder="Note (required)"
        aria-label="Resolution note"
      />
      <div className="flex gap-2">
        <Button type="submit" name="status" value="RESOLVED" size="sm" disabled={pending}>
          Resolve
        </Button>
        <Button
          type="submit"
          name="status"
          value="IGNORED"
          size="sm"
          variant="outline"
          disabled={pending}
        >
          Ignore
        </Button>
      </div>
      {state.message && (
        <p className="text-destructive text-xs" role="alert">
          {state.message}
        </p>
      )}
    </form>
  );
}
