'use client';

import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { useMemo, useState, useTransition } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { humanize } from '@/lib/format';
import {
  PROSPECT_PRIORITIES,
  PROSPECT_STATUSES,
  type ProspectPriority,
  type ProspectStatus,
} from '@/lib/prospect-csv';
import { updateProspect } from './actions';

export interface ProspectView {
  id: string;
  company: string;
  segment: string | null;
  area: string | null;
  phone: string | null;
  website: string | null;
  priority: ProspectPriority;
  status: ProspectStatus;
  owner: string | null;
  /** YYYY-MM-DD or '' */
  lastContact: string;
  nextStep: string | null;
  notes: string | null;
}

type SortKey = 'company' | 'segment' | 'area' | 'priority' | 'status' | 'owner' | 'lastContact';

const sortable: { key: SortKey; label: string }[] = [
  { key: 'company', label: 'Company' },
  { key: 'segment', label: 'Segment' },
  { key: 'area', label: 'Area' },
  { key: 'priority', label: 'Priority' },
  { key: 'status', label: 'Status' },
  { key: 'owner', label: 'Owner' },
  { key: 'lastContact', label: 'Last contact' },
];

export function ProspectsTable({
  prospects,
  editable,
}: {
  prospects: ProspectView[];
  editable: boolean;
}) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('priority');
  const [descending, setDescending] = useState(false);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    const rows = prospects.filter(
      (p) =>
        (!status || p.status === status) &&
        (!priority || p.priority === priority) &&
        (!query ||
          [p.company, p.segment, p.area, p.owner, p.notes]
            .filter(Boolean)
            .some((value) => value!.toLowerCase().includes(query))),
    );
    rows.sort((a, b) => {
      const left = (a[sortKey] ?? '') as string;
      const right = (b[sortKey] ?? '') as string;
      const result =
        sortKey === 'status'
          ? PROSPECT_STATUSES.indexOf(a.status) - PROSPECT_STATUSES.indexOf(b.status)
          : left.localeCompare(right);
      return descending ? -result : result;
    });
    return rows;
  }, [prospects, search, status, priority, sortKey, descending]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) setDescending(!descending);
    else {
      setSortKey(key);
      setDescending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search company, segment, area, owner…"
          aria-label="Search prospects"
          className="w-72"
        />
        <NativeSelect
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Status"
        >
          <option value="">All statuses</option>
          {PROSPECT_STATUSES.map((value) => (
            <option key={value} value={value}>
              {humanize(value)}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          aria-label="Priority"
        >
          <option value="">All priorities</option>
          {PROSPECT_PRIORITIES.map((value) => (
            <option key={value} value={value}>
              Priority {value}
            </option>
          ))}
        </NativeSelect>
        <span className="text-muted-foreground self-center text-sm">
          {visible.length} of {prospects.length}
        </span>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            {sortable.map((column) => (
              <TableHead key={column.key}>
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
            <TableHead>Next step</TableHead>
            {editable && <TableHead />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {visible.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={editable ? 9 : 8}
                className="text-muted-foreground py-6 text-center"
              >
                No prospects match these filters.
              </TableCell>
            </TableRow>
          )}
          {visible.map((prospect) =>
            editable ? (
              <EditableRow key={prospect.id} prospect={prospect} />
            ) : (
              <TableRow key={prospect.id}>
                <CompanyCells prospect={prospect} />
                <TableCell>{humanize(prospect.status)}</TableCell>
                <TableCell>{prospect.owner ?? '—'}</TableCell>
                <TableCell>{prospect.lastContact || '—'}</TableCell>
                <TableCell>{prospect.nextStep ?? '—'}</TableCell>
              </TableRow>
            ),
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function CompanyCells({ prospect }: { prospect: ProspectView }) {
  return (
    <>
      <TableCell>
        <div className="font-medium">{prospect.company}</div>
        <div className="text-muted-foreground text-xs">
          {[prospect.phone, prospect.website].filter(Boolean).join(' · ')}
        </div>
      </TableCell>
      <TableCell>{prospect.segment ?? '—'}</TableCell>
      <TableCell>{prospect.area ?? '—'}</TableCell>
      <TableCell>
        <Badge variant={prospect.priority === 'A' ? 'default' : 'secondary'}>
          {prospect.priority}
        </Badge>
      </TableCell>
    </>
  );
}

/** Inline editing of status, owner, last contact and next step. */
function EditableRow({ prospect }: { prospect: ProspectView }) {
  const [status, setStatus] = useState(prospect.status);
  const [owner, setOwner] = useState(prospect.owner ?? '');
  const [lastContact, setLastContact] = useState(prospect.lastContact);
  const [nextStep, setNextStep] = useState(prospect.nextStep ?? '');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const dirty =
    status !== prospect.status ||
    owner !== (prospect.owner ?? '') ||
    lastContact !== prospect.lastContact ||
    nextStep !== (prospect.nextStep ?? '');

  function save() {
    startTransition(async () => {
      const result = await updateProspect({
        id: prospect.id,
        status,
        owner,
        lastContact,
        nextStep,
      });
      setMessage({ ok: result.ok, text: result.message });
    });
  }

  return (
    <TableRow>
      <CompanyCells prospect={prospect} />
      <TableCell>
        <NativeSelect
          value={status}
          onChange={(e) => setStatus(e.target.value as ProspectStatus)}
          aria-label={`Status for ${prospect.company}`}
        >
          {PROSPECT_STATUSES.map((value) => (
            <option key={value} value={value}>
              {humanize(value)}
            </option>
          ))}
        </NativeSelect>
      </TableCell>
      <TableCell>
        <Input
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
          maxLength={100}
          className="w-28"
          aria-label={`Owner for ${prospect.company}`}
        />
      </TableCell>
      <TableCell>
        <Input
          type="date"
          value={lastContact}
          onChange={(e) => setLastContact(e.target.value)}
          className="w-36"
          aria-label={`Last contact for ${prospect.company}`}
        />
      </TableCell>
      <TableCell>
        <Input
          value={nextStep}
          onChange={(e) => setNextStep(e.target.value)}
          maxLength={500}
          className="min-w-48"
          aria-label={`Next step for ${prospect.company}`}
        />
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <Button size="sm" onClick={save} disabled={!dirty || pending}>
          {pending ? 'Saving…' : 'Save'}
        </Button>
        {message && (
          <span
            className={`ml-2 text-xs ${message.ok ? 'text-emerald-600' : 'text-destructive'}`}
            role="status"
          >
            {message.text}
          </span>
        )}
      </TableCell>
    </TableRow>
  );
}
