'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated, getRole } from '@/lib/auth';

/**
 * Guest guard — if the user already has a valid token they should never
 * see the login/signup pages. Redirect them to their dashboard instead.
 * This mirrors the auth guard in (user)/layout.tsx and (admin)/layout.tsx.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated()) {
      router.replace(getRole() === 'admin' ? '/admin/reports' : '/reports');
    }
  }, [router]);

  // If already authenticated, render nothing while the redirect happens.
  if (isAuthenticated()) return null;

  return <>{children}</>;
}
