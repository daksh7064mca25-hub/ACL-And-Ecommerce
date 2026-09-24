'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { hasToken } from '@/lib/auth';

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    if (hasToken()) {
      router.replace('/dashboard');
    } else {
      router.replace('/login');
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin" />
        <p className="text-xs text-slate-500 font-medium">Redirecting...</p>
      </div>
    </div>
  );
}
