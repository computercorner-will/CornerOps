import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { NativeSelect } from '@/components/ui/native-select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { db } from '@/lib/db';
import { formatDate, humanize } from '@/lib/format';
import {
  describeIssue,
  ISSUE_STATUSES,
  ISSUE_TYPE_LABELS,
  ISSUE_TYPES,
  type IssueStatus,
} from '@/lib/issues';
import type { IssueType } from '@/lib/reconcile';
import { canEdit } from '@/lib/roles';
import { requireUser } from '@/lib/session';
import { ResolveForm } from './resolve-form';

export const metadata = { title: 'Issues' };

export default async function IssuesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; status?: string; notice?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const type = ISSUE_TYPES.includes(params.type as IssueType)
    ? (params.type as IssueType)
    : undefined;
  // Default to the open queue; "ALL" shows every status.
  const status =
    params.status === 'ALL'
      ? undefined
      : ISSUE_STATUSES.includes(params.status as IssueStatus)
        ? (params.status as IssueStatus)
        : 'OPEN';

  const issues = await db.reconciliationIssue.findMany({
    where: { type, status },
    include: {
      client: { select: { id: true, name: true } },
      resolvedBy: { select: { email: true } },
    },
    orderBy: [{ createdAt: 'desc' }],
    take: 500,
  });
  const editable = canEdit(user.role);

  return (
    <>
      <PageHeader title="Issues" description="Billing reconciliation findings to review.">
        <form className="flex flex-wrap gap-2">
          <NativeSelect name="type" defaultValue={type ?? ''} aria-label="Filter by type">
            <option value="">All types</option>
            {ISSUE_TYPES.map((value) => (
              <option key={value} value={value}>
                {ISSUE_TYPE_LABELS[value]}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect name="status" defaultValue={status ?? 'ALL'} aria-label="Filter by status">
            {ISSUE_STATUSES.map((value) => (
              <option key={value} value={value}>
                {humanize(value)}
              </option>
            ))}
            <option value="ALL">All statuses</option>
          </NativeSelect>
          <Button type="submit" variant="outline">
            Filter
          </Button>
        </form>
      </PageHeader>

      {!editable && (
        <p className="text-muted-foreground mb-4 text-sm">
          You have read-only access. A TECH or ADMIN user can resolve or ignore issues.
        </p>
      )}

      {(params.notice === 'resolved' || params.notice === 'ignored') && (
        <p
          role="status"
          className="mb-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
        >
          Issue {params.notice}. The note was saved to the audit log.
        </p>
      )}

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                {editable && <TableHead>Action</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {issues.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={editable ? 6 : 5}
                    className="text-muted-foreground py-6 text-center"
                  >
                    No issues match these filters.
                  </TableCell>
                </TableRow>
              )}
              {issues.map((issue) => (
                <TableRow key={issue.id} className="align-top">
                  <TableCell>
                    <Link
                      href={`/clients/${issue.client.id}`}
                      className="font-medium hover:underline"
                    >
                      {issue.client.name}
                    </Link>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {ISSUE_TYPE_LABELS[issue.type]}
                  </TableCell>
                  <TableCell className="max-w-md whitespace-normal">
                    {describeIssue(issue.type, issue.details)}
                    {issue.note && (
                      <p className="text-muted-foreground mt-1 text-xs">
                        Note{issue.resolvedBy ? ` (${issue.resolvedBy.email})` : ''}: {issue.note}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={issue.status === 'OPEN' ? 'warning' : 'secondary'}>
                      {humanize(issue.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{formatDate(issue.createdAt)}</TableCell>
                  {editable && (
                    <TableCell>
                      {issue.status === 'OPEN' ? (
                        <ResolveForm
                          issueId={issue.id}
                          filterType={type}
                          filterStatus={params.status === 'ALL' ? 'ALL' : status}
                        />
                      ) : null}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
