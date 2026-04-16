'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { isAuthenticated, getRole, getUserEmail, clearToken } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { ExpenseLogo } from '@/components/expense-logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { ClipboardList, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/admin/reports', label: 'All Reports', icon: ClipboardList },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login');
      return;
    }
    if (getRole() !== 'admin') {
      router.replace('/reports');
      return;
    }
    setChecked(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!checked) return null;

  const email = getUserEmail() ?? '';

  return (
    <div className="flex h-screen bg-zinc-50 dark:bg-background">
      {/* Sidebar */}
      <aside className="flex flex-col w-64 border-r border-border bg-white dark:bg-card shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 py-4">
          <ExpenseLogo className="h-8 w-8 shrink-0" />
          <span className="font-semibold tracking-tight text-sm leading-tight">
            Expense Report
          </span>
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
                pathname.startsWith(href)
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
        {/* User + theme toggle */}
        <div className="flex items-center gap-2 px-4 py-3">
          <Avatar className="h-7 w-7 shrink-0">
            <AvatarFallback className="text-xs bg-primary/10 text-primary">
              {email.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-xs font-medium truncate">{email}</span>
            <span className="text-xs text-muted-foreground">Admin</span>
          </div>
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={() => { clearToken(); router.replace('/login'); }}
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
