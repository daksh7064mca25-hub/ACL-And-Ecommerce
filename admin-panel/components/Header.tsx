'use client';

import React from 'react';
import { AdminUser, clearAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';

interface HeaderProps {
  admin: AdminUser | null;
  title?: string;
}

export default function Header({ admin, title = 'Dashboard Overview' }: HeaderProps) {
  const router = useRouter();

  const handleLogout = () => {
    // 1. Clear JWT and Admin profile from localStorage
    clearAuth();
    // 2. Redirect to /login
    router.replace('/login');
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-10 shadow-xs">
      {/* Title / Breadcrumb */}
      <div>
        <h1 className="text-lg font-semibold text-slate-800">{title}</h1>
        <p className="text-xs text-slate-500">Welcome to your management dashboard</p>
      </div>

      {/* Admin Profile & Logout */}
      <div className="flex items-center gap-4">
        {/* Admin Info Pill */}
        <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-full py-1.5 px-3">
          <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-semibold text-xs flex items-center justify-center border border-indigo-200">
            {admin?.name ? admin.name.charAt(0).toUpperCase() : 'A'}
          </div>
          <div className="flex flex-col text-left pr-1">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-800 leading-tight">
                {admin?.name || 'Administrator'}
              </span>
              <span className="text-[10px] bg-indigo-50 text-indigo-700 font-medium px-1.5 py-0.2 rounded border border-indigo-200">
                {admin?.role || 'Admin'}
              </span>
            </div>
            <span className="text-[11px] text-slate-500 leading-tight">
              {admin?.email || 'admin@example.com'}
            </span>
          </div>
        </div>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          id="logout-btn"
          className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors cursor-pointer"
          title="Sign out of Admin Panel"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span>Logout</span>
        </button>
      </div>
    </header>
  );
}
