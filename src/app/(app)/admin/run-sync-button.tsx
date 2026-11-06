'use client';

import { RefreshCw } from 'lucide-react';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { runSyncAction, type ActionState } from './actions';

export function RunSyncButton() {
  const [result, setResult] = useState<ActionState | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col items-end gap-2">
      <Button
        onClick={() => startTransition(async () => setResult(await runSyncAction()))}
        disabled={pending}
      >
        <RefreshCw className={pending ? 'animate-spin' : undefined} />
        {pending ? 'Syncing…' : 'Run sync'}
      </Button>
      {result && (
        <p
          role="status"
          className={`max-w-xl text-right text-sm ${result.ok ? 'text-emerald-600' : 'text-destructive'}`}
        >
          {result.message}
        </p>
      )}
    </div>
  );
}
