'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { useUIStore, useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';
import { connectSocket } from '@/lib/socket';
import { cn } from '@/lib/utils';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const setUser = useAuthStore((s) => s.setUser);

  useEffect(() => {
    const token = api.getToken();
    if (!token) {
      router.push('/login');
      return;
    }

    // Fetch current user
    api.get<any>('/auth/me')
      .then((res) => {
        if (res.success && res.data) {
          setUser(res.data, { id: '', name: '', slug: '' });
          connectSocket(token);
        }
      })
      .catch(() => {
        router.push('/login');
      });
  }, [router, setUser]);

  return (
    <div className="min-h-screen bg-[var(--color-bg-secondary)]">
      <Sidebar />
      <main
        className={cn(
          'transition-all duration-300 min-h-screen',
          sidebarOpen ? 'ml-64' : 'ml-16'
        )}
      >
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
