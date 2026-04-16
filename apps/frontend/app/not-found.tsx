import Link from 'next/link';
import { Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 dark:bg-background px-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative z-10 flex flex-col items-center text-center max-w-md gap-8">
        {/* 404 number */}
        <div className="relative">
          <p className="text-[9rem] font-black leading-none tracking-tighter text-primary/10 select-none">
            404
          </p>
        </div>

        {/* Text */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Page not found</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
            <br />
            Let&apos;s get you back on track.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center">
          <Link
            href="/reports"
            className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary/90"
          >
            <Home className="h-4 w-4" />
            Dashboard
          </Link>
        </div>
      </div>

      {/* Footer */}
      <p className="absolute bottom-6 text-xs text-muted-foreground/50 select-none">
        Expense Report — Gradion
      </p>
    </div>
  );
}
