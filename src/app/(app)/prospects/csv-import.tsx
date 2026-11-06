'use client';

import { Upload } from 'lucide-react';
import { useRef, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { PROSPECT_CSV_COLUMNS } from '@/lib/prospect-csv';
import { importProspects, type ActionState } from './actions';

/** Reads a CSV file in the browser and sends its text to the importProspects server action. */
export function CsvImport() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<ActionState | null>(null);
  const [pending, startTransition] = useTransition();

  function onFile(file: File | undefined) {
    if (!file) return;
    startTransition(async () => {
      const text = await file.text();
      setResult(await importProspects(text));
      if (inputRef.current) inputRef.current.value = '';
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      <Button variant="outline" onClick={() => inputRef.current?.click()} disabled={pending}>
        <Upload />
        {pending ? 'Importing…' : 'Import CSV'}
      </Button>
      <p className="text-muted-foreground max-w-md text-right text-xs">
        Columns: {PROSPECT_CSV_COLUMNS.join(', ')}
      </p>
      {result && (
        <div
          role="status"
          className={`max-w-md text-sm ${result.ok ? 'text-emerald-600' : 'text-destructive'}`}
        >
          <p>{result.message}</p>
          {result.errors && (
            <ul className="mt-1 list-disc pl-5 text-xs">
              {result.errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
