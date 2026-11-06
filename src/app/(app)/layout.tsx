import { LogOut } from 'lucide-react';
import { signOut } from '@/auth';
import { SidebarNav } from '@/components/sidebar-nav';
import { ThemeToggle } from '@/components/theme-toggle';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { humanize } from '@/lib/format';
import { isAdmin } from '@/lib/roles';
import { requireUser } from '@/lib/session';

// Every page in this group reads the session and live data.
export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  async function signOutAction() {
    'use server';
    await signOut({ redirectTo: '/signin' });
  }

  return (
    <div className="flex min-h-screen">
      <aside className="border-sidebar-border bg-sidebar text-sidebar-foreground sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r">
        <div className="border-sidebar-border flex h-14 items-center justify-between border-b px-4">
          <span className="font-semibold tracking-tight">CornerOps</span>
          <ThemeToggle />
        </div>
        <SidebarNav showAdmin={isAdmin(user.role)} />
        <div className="border-sidebar-border border-t p-3 text-sm">
          <p className="truncate font-medium" title={user.email}>
            {user.name ?? user.email}
          </p>
          <div className="mt-1 flex items-center justify-between">
            <Badge variant="secondary">{humanize(user.role)}</Badge>
            <form action={signOutAction}>
              <Button type="submit" variant="ghost" size="sm">
                <LogOut />
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-6 lg:p-8">{children}</main>
    </div>
  );
}
