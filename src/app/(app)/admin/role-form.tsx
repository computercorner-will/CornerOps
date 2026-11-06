'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { setUserRole, type ActionState } from './actions';

const initialState: ActionState = { ok: false, message: '' };

export function RoleForm({ userId, role }: { userId: string; role: string }) {
  const [state, formAction, pending] = useActionState(setUserRole, initialState);
  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="userId" value={userId} />
      <NativeSelect name="role" defaultValue={role} aria-label="Role">
        <option value="ADMIN">Admin</option>
        <option value="TECH">Tech</option>
        <option value="READONLY">Read-only</option>
      </NativeSelect>
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        Save
      </Button>
      {state.message && (
        <span
          className={`text-xs ${state.ok ? 'text-emerald-600' : 'text-destructive'}`}
          role="status"
        >
          {state.message}
        </span>
      )}
    </form>
  );
}
