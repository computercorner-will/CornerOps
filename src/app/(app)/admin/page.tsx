import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { env } from '@/env';
import { db } from '@/lib/db';
import { formatDate, formatDateTime, humanize } from '@/lib/format';
import { isAdmin } from '@/lib/roles';
import { requireUser } from '@/lib/session';
import { RoleForm } from './role-form';
import { RunSyncButton } from './run-sync-button';

export const metadata = { title: 'Admin' };

export default async function AdminPage() {
  const user = await requireUser();
  if (!isAdmin(user.role)) {
    return (
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Admins only</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            You need the ADMIN role to view this page.
          </p>
        </CardContent>
      </Card>
    );
  }

  const [users, runs] = await Promise.all([
    db.user.findMany({ orderBy: { email: 'asc' } }),
    db.syncRun.findMany({ orderBy: { startedAt: 'desc' }, take: 25 }),
  ]);

  return (
    <>
      <PageHeader
        title="Admin"
        description={`Integrations mode: ${env.INTEGRATIONS_MODE}. Syncs are read-only towards Syncro and Pax8.`}
      >
        <RunSyncButton />
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-3 text-sm">
            New users sign in as Read-only. Emails listed in ADMIN_EMAILS are always admins.
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Role</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.email}</TableCell>
                  <TableCell>{u.name ?? '—'}</TableCell>
                  <TableCell>{formatDate(u.createdAt)}</TableCell>
                  <TableCell>
                    <RoleForm userId={u.id} role={u.role} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Sync history</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Finished</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Records</TableHead>
                <TableHead>Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground py-6 text-center">
                    No syncs yet.
                  </TableCell>
                </TableRow>
              )}
              {runs.map((run) => (
                <TableRow key={run.id}>
                  <TableCell>{humanize(run.source)}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatDateTime(run.startedAt)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatDateTime(run.finishedAt)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        run.status === 'SUCCESS'
                          ? 'success'
                          : run.status === 'FAILED'
                            ? 'destructive'
                            : 'secondary'
                      }
                    >
                      {humanize(run.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{run.recordsRead}</TableCell>
                  <TableCell className="text-destructive max-w-sm text-xs whitespace-normal">
                    {run.error ?? ''}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
