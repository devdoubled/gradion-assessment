'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { isAuthenticated, getRole, getUserEmail, clearToken } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { FileText, Plus, LogOut, LayoutDashboard } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/reports', label: 'My Reports', icon: FileText },
  { href: '/reports/new', label: 'New Report', icon: Plus },
];

export default function UserLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login');
      return;
    }
    if (getRole() === 'admin') router.replace('/admin/reports');
  }, [router]);

  if (!isAuthenticated()) return null;

  const email = getUserEmail() ?? '';

  return (
    <div className="flex h-screen bg-zinc-50">
      {/* Sidebar */}
      <aside className="flex flex-col w-64 border-r border-border bg-white shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-2 px-6 py-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <LayoutDashboard className="h-4 w-4" />
          </div>
          <span className="font-semibold tracking-tight">ExpenseFlow</span>
        </div>
        <Separator />
        {/* Nav */}
        <nav className="flex flex-col gap-1 p-3 flex-1">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                pathname === href ||
                  (href !== '/reports/new' && pathname.startsWith(href))
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
        <Separator />
        {/* User */}
        <div className="flex items-center gap-3 px-4 py-4">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs bg-primary/10 text-primary">
              {email.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-medium truncate">{email}</span>
            <span className="text-xs text-muted-foreground">User</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={() => {
              clearToken();
              router.replace('/login');
            }}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex flex-col flex-1 overflow-auto">{children}</main>
    </div>
  );
}
