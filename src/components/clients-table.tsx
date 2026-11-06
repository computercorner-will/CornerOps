'use client';

import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ClientSummary } from '@/lib/client-summaries';
import { formatUsd } from '@/lib/format';

type SortKey = 'name' | 'mrrCents' | 'deviceCount' | 'mrrPerDeviceCents' | 'openIssues';

const columns: { key: SortKey; label: string; numeric: boolean }[] = [
  { key: 'name', label: 'Client', numeric: false },
  { key: 'mrrCents', label: 'MRR', numeric: true },
  { key: 'deviceCount', label: 'Devices', numeric: true },
  { key: 'mrrPerDeviceCents', label: 'MRR / device', numeric: true },
  { key: 'openIssues', label: 'Open issues', numeric: true },
];

/** Sortable client table. Click a column header to sort; click again to reverse. */
export function ClientsTable({
  clients,
  showStatus = false,
}: {
  clients: ClientSummary[];
  showStatus?: boolean;
}) {
  const [sortKey, setSortKey] = useState<SortKey>('mrrCents');
  const [descending, setDescending] = useState(true);

  const sorted = useMemo(() => {
    const rows = [...clients];
    rows.sort((a, b) => {
      const left = a[sortKey];
      const right = b[sortKey];
      let result: number;
      if (typeof left === 'string' && typeof right === 'string') result = left.localeCompare(right);
      else result = (Number(left) || 0) - (Number(right) || 0);
      return descending ? -result : result;
    });
    return rows;
  }, [clients, sortKey, descending]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) setDescending(!descending);
    else {
      setSortKey(key);
      setDescending(key !== 'name');
    }
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((column) => (
            <TableHead
              key={column.key}
              className={column.numeric ? 'text-right' : undefined}
              aria-sort={
                sortKey === column.key ? (descending ? 'descending' : 'ascending') : 'none'
              }
            >
              <button
                type="button"
                onClick={() => toggleSort(column.key)}
                className="hover:text-foreground inline-flex items-center gap-1"
              >
                {column.label}
                {sortKey !== column.key ? (
                  <ArrowUpDown className="size-3 opacity-50" />
                ) : descending ? (
                  <ArrowDown className="size-3" />
                ) : (
                  <ArrowUp className="size-3" />
                )}
              </button>
            </TableHead>
          ))}
          {showStatus && <TableHead>Status</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.length === 0 && (
          <TableRow>
            <TableCell
              colSpan={showStatus ? 6 : 5}
              className="text-muted-foreground py-6 text-center"
            >
              No clients found.
            </TableCell>
          </TableRow>
        )}
        {sorted.map((client) => (
          <TableRow key={client.id}>
            <TableCell>
              <Link href={`/clients/${client.id}`} className="font-medium hover:underline">
                {client.name}
              </Link>
            </TableCell>
            <TableCell className="text-right tabular-nums">{formatUsd(client.mrrCents)}</TableCell>
            <TableCell className="text-right tabular-nums">{client.deviceCount}</TableCell>
            <TableCell className="text-right tabular-nums">
              {client.mrrPerDeviceCents === null ? '—' : formatUsd(client.mrrPerDeviceCents)}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {client.openIssues > 0 ? (
                <Badge variant="warning">{client.openIssues}</Badge>
              ) : (
                <span className="text-muted-foreground">0</span>
              )}
            </TableCell>
            {showStatus && (
              <TableCell>
                <Badge variant={client.status === 'ACTIVE' ? 'success' : 'secondary'}>
                  {client.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                </Badge>
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
