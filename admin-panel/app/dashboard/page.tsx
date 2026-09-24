'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import DashboardCard, { DashboardCardProps } from '@/components/DashboardCard';
import { getToken, getAdmin, saveAdmin, clearAuth, AdminUser, getPermissions } from '@/lib/auth';
import { verifyAdminAuth, getMyPermissions } from '@/lib/api';

export default function DashboardPage() {
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);

  useEffect(() => {
    let isMounted = true;

    async function checkAuth() {
      // 1. Check whether a JWT token exists in client storage
      const token = getToken();
      if (!token) {
        if (isMounted) {
          clearAuth();
          router.replace('/login');
        }
        return;
      }

      // Pre-load cached admin profile and permissions
      const cachedAdmin = getAdmin();
      if (cachedAdmin && isMounted) {
        setAdmin(cachedAdmin);
      }
      const cachedPerms = getPermissions();
      if (cachedPerms && isMounted) {
        setPermissions(cachedPerms);
      }

      // 2. Verify token and Admin authorization with the backend ACL protected endpoint
      // GET /api/admin/test (Requires: dashboard:read)
      const authResult = await verifyAdminAuth(token);

      if (!isMounted) return;

      if (authResult.success) {
        // Backend authorization succeeded (200 OK)
        if (authResult.data?.admin) {
          setAdmin(authResult.data.admin);
          saveAdmin(authResult.data.admin);
        }

        // 3. Fetch and synchronize fresh ACL permissions from backend
        const permsResult = await getMyPermissions(token);
        if (permsResult.success && permsResult.permissions && isMounted) {
          setPermissions(permsResult.permissions);
        }

        setIsLoading(false);
      } else {
        // Backend returned 401, 403, or invalid token
        clearAuth();
        router.replace('/login');
      }
    }

    checkAuth();

    return () => {
      isMounted = false;
    };
  }, [router]);

  // Loading state while verifying backend authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4 bg-white p-8 rounded-2xl shadow-xs border border-slate-200">
          <div className="w-12 h-12 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin" />
          <div className="text-center">
            <h3 className="text-sm font-semibold text-slate-800">Verifying Admin Session & ACL</h3>
            <p className="text-xs text-slate-500 mt-1">Connecting with authorization server...</p>
          </div>
        </div>
      </div>
    );
  }

  // Placeholder Metrics for Summary Cards
  const summaryCards: DashboardCardProps[] = [
    {
      title: 'Total Users',
      value: '1,280',
      description: 'Active accounts across all roles',
      change: '12% this month',
      isPositive: true,
      iconType: 'users',
    },
    {
      title: 'Customers',
      value: '1,120',
      description: 'Registered customer accounts',
      change: '8% this month',
      isPositive: true,
      iconType: 'customers',
    },
    {
      title: 'Riders',
      value: '95',
      description: 'Verified delivery riders',
      change: '4% this month',
      isPositive: true,
      iconType: 'riders',
    },
    {
      title: 'Staff',
      value: '65',
      description: 'Internal operations team',
      change: '2 new this week',
      isPositive: true,
      iconType: 'staff',
    },
  ];

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navbar Header */}
        <Header admin={admin} title="Dashboard Overview" />

        {/* Dashboard Main View */}
        <main className="flex-1 p-8 overflow-y-auto max-w-7xl w-full mx-auto space-y-8">
          {/* Welcome Banner */}
          <div className="bg-linear-to-r from-indigo-700 via-indigo-600 to-indigo-800 rounded-2xl p-6 text-white shadow-lg shadow-indigo-700/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider bg-white/20 text-white px-2.5 py-0.5 rounded-full backdrop-blur-xs">
                  Admin Workspace
                </span>
                <span className="text-xs text-indigo-200">• ACL Protected Session</span>
              </div>
              <h2 className="text-2xl font-bold tracking-tight">
                Welcome back, {admin?.name || 'Administrator'}!
              </h2>
              <p className="text-indigo-100 text-sm mt-1">
                Here is a summary of your system metrics and administration activities.
              </p>
            </div>

            <div className="shrink-0 flex items-center gap-3">
              <div className="bg-white/10 backdrop-blur-xs border border-white/20 px-4 py-2 rounded-xl text-xs text-right">
                <p className="text-indigo-200">Current Role</p>
                <p className="font-semibold text-white">{admin?.role || 'Admin'}</p>
              </div>
            </div>
          </div>

          {/* Section: Key Statistics */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-semibold text-slate-800">System Overview</h3>
                <p className="text-xs text-slate-500">Summary counts of users and ecosystem participants</p>
              </div>
              <span className="text-xs text-slate-400 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                Mock Data Placeholder
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {summaryCards.map((card) => (
                <DashboardCard key={card.title} {...card} />
              ))}
            </div>
          </section>

          {/* Section: Recent Activity & ACL Status */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Activity Feed */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
                <div>
                  <h4 className="text-sm font-semibold text-slate-800">Assigned ACL Permissions</h4>
                  <p className="text-xs text-slate-500">Permissions granted to your role ({admin?.role || 'Admin'})</p>
                </div>
                <span className="text-[11px] text-indigo-600 font-medium">{permissions.length} Active Permissions</span>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {permissions.length > 0 ? (
                  permissions.map((perm) => (
                    <span
                      key={perm}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-xs"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      {perm}
                    </span>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 italic">No permissions assigned.</p>
                )}
              </div>
            </div>

            {/* Right Column: Security & Session Status */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between">
              <div>
                <h4 className="text-sm font-semibold text-slate-800 mb-1">ACL Security Architecture</h4>
                <p className="text-xs text-slate-500 mb-4">Granular permission control</p>

                <div className="space-y-3 text-xs">
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-500">Auth Mechanism</span>
                    <span className="font-semibold text-slate-800">JWT + DB ACL</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-500">Permissions Route</span>
                    <span className="font-mono text-[11px] text-indigo-600">/api/admin/me/permissions</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-500">Enforcement Model</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                      User → Role → Permissions
                    </span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-slate-500">API Gateway</span>
                    <span className="font-mono text-[11px] text-slate-700">http://localhost:5000</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100">
                <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 text-xs text-indigo-700">
                  <p className="font-semibold mb-0.5">ACL Protection Active</p>
                  <p className="text-[11px] text-indigo-600 leading-relaxed">
                    Access to Users and Promotions modules is governed by individual permission tokens.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
