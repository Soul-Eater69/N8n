'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const token = api.getToken();
    if (token) {
      router.push('/dashboard');
    } else {
      router.push('/login');
    }
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-pulse-slow">
        <div className="text-2xl font-bold text-brand-600">FlowForge</div>
        <div className="text-sm text-[var(--color-text-muted)] mt-1">Loading...</div>
      </div>
    </div>
  );
}
