'use client';

import {
  AlertTriangle,
  BookOpen,
  Building2,
  HeartPulse,
  LayoutDashboard,
  Settings,
  Target,
  UserPlus,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const mainItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/clients', label: 'Clients', icon: Building2 },
  { href: '/issues', label: 'Issues', icon: AlertTriangle },
  { href: '/prospects', label: 'Prospects', icon: Target },
];

const comingSoonItems = [
  { href: '/health', label: 'Client Health', icon: HeartPulse },
  { href: '/onboarding', label: 'Onboarding', icon: UserPlus },
  { href: '/sops', label: 'SOP Library', icon: BookOpen },
];

export function SidebarNav({ showAdmin }: { showAdmin: boolean }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);

  const linkClass = (href: string) =>
    cn(
      'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
      isActive(href)
        ? 'bg-accent font-medium text-accent-foreground'
        : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
    );

  return (
    <nav className="flex flex-1 flex-col gap-6 p-3" aria-label="Main">
      <div className="flex flex-col gap-1">
        {mainItems.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className={linkClass(href)}>
            <Icon className="size-4" />
            {label}
          </Link>
        ))}
        {showAdmin && (
          <Link href="/admin" className={linkClass('/admin')}>
            <Settings className="size-4" />
            Admin
          </Link>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-muted-foreground px-3 text-xs font-medium tracking-wide uppercase">
          Coming soon
        </p>
        {comingSoonItems.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className={linkClass(href)}>
            <Icon className="size-4" />
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
