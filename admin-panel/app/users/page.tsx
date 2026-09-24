'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { getToken, getAdmin, clearAuth, AdminUser, hasPermission } from '@/lib/auth';
import { getCustomers, CustomerUser } from '@/lib/api';

export default function UsersPage() {
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [customers, setCustomers] = useState<CustomerUser[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'verified' | 'pending'>('all');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isAccessDenied, setIsAccessDenied] = useState(false);

  useEffect(() => {
    setMounted(true);
    let isMounted = true;

    async function loadData() {
      // 1. Check client token
      const token = getToken();
      if (!token) {
        if (isMounted) {
          clearAuth();
          router.replace('/login');
        }
        return;
      }

      // Pre-populate cached admin
      const cachedAdmin = getAdmin();
      if (cachedAdmin && isMounted) {
        setAdmin(cachedAdmin);
      }

      // Frontend permission pre-check (ACL)
      if (!hasPermission('users:read')) {
        if (isMounted) {
          setIsAccessDenied(true);
          setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      // 2. Fetch Customers from backend ACL protected endpoint
      const response = await getCustomers(token);

      if (!isMounted) return;

      if (response.success && response.users) {
        setCustomers(response.users);
        setIsLoading(false);
      } else {
        if (response.status === 401) {
          clearAuth();
          router.replace('/login');
        } else if (response.status === 403) {
          setIsAccessDenied(true);
          setIsLoading(false);
        } else {
          setErrorMessage(response.message || 'Failed to fetch customer accounts');
          setIsLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [router]);

  // Filtered customer list based on search term & status
  const filteredCustomers = useMemo(() => {
    return customers.filter((cust) => {
      const matchSearch =
        cust.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cust.email.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchSearch) return false;

      if (filterStatus === 'verified') return cust.isEmailVerified;
      if (filterStatus === 'pending') return !cust.isEmailVerified;
      return true;
    });
  }, [customers, searchTerm, filterStatus]);

  // Statistics
  const verifiedCount = useMemo(() => customers.filter((c) => c.isEmailVerified).length, [customers]);
  const pendingCount = customers.length - verifiedCount;

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header admin={admin} title="Customer Accounts" />

        <main className="flex-1 p-8 overflow-y-auto max-w-7xl w-full mx-auto space-y-6">
          {/* Header Banner */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full border border-indigo-200">
                  Customer Directory
                </span>
                <span className="text-xs text-slate-500">• ACL Permission: users:read</span>
              </div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Registered Customers</h2>
              <p className="text-xs text-slate-500 mt-1">
                Browse and manage customer accounts. Non-customer roles (Admins, Riders, Staff) are filtered out.
              </p>
            </div>

            {mounted && hasPermission('promotions:send') && (
              <div className="flex items-center gap-3">
                <Link
                  href="/promotions"
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-sm shadow-indigo-500/20 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <span>Send Promotion</span>
                </Link>
              </div>
            )}
          </div>

          {/* Access Denied View (ACL: 403 Forbidden) */}
          {isAccessDenied ? (
            <div className="bg-white rounded-2xl p-12 border border-rose-200 shadow-xs text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto text-2xl font-bold">
                🚫
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">403 Forbidden — Access Denied</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                  You do not have the required ACL permission (<code className="bg-rose-50 text-rose-700 px-1 py-0.5 rounded font-mono">users:read</code>) to view customer records.
                </p>
              </div>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors"
              >
                ← Return to Dashboard
              </Link>
            </div>
          ) : (
            <>
              {/* Quick Metrics Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Customers</p>
                    <p className="text-2xl font-bold text-slate-900 mt-0.5">{customers.length}</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm">
                    👥
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Verified Emails</p>
                    <p className="text-2xl font-bold text-emerald-600 mt-0.5">{verifiedCount}</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-sm">
                    ✓
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Pending Verification</p>
                    <p className="text-2xl font-bold text-amber-600 mt-0.5">{pendingCount}</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-sm">
                    ⏳
                  </div>
                </div>
              </div>

              {/* Error Message */}
              {errorMessage && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">Error:</span>
                    <span>{errorMessage}</span>
                  </div>
                  <button
                    onClick={() => window.location.reload()}
                    className="px-3 py-1 bg-rose-600 text-white rounded-lg text-xs font-medium hover:bg-rose-700 transition-colors"
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* Search & Filter Bar */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* Search Input */}
                <div className="relative flex-1 max-w-md">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search customers by name or email..."
                    className="block w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                {/* Status Filter Tabs */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs self-start sm:self-auto">
                  <button
                    onClick={() => setFilterStatus('all')}
                    className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                      filterStatus === 'all'
                        ? 'bg-white text-indigo-700 shadow-xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    All ({customers.length})
                  </button>
                  <button
                    onClick={() => setFilterStatus('verified')}
                    className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                      filterStatus === 'verified'
                        ? 'bg-white text-emerald-700 shadow-xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Verified ({verifiedCount})
                  </button>
                  <button
                    onClick={() => setFilterStatus('pending')}
                    className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                      filterStatus === 'pending'
                        ? 'bg-white text-amber-700 shadow-xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Pending ({pendingCount})
                  </button>
                </div>
              </div>

              {/* Customer Accounts Table */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                {isLoading ? (
                  <div className="p-12 flex flex-col items-center justify-center gap-3">
                    <div className="w-8 h-8 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin" />
                    <p className="text-xs text-slate-500 font-medium">Loading customer accounts...</p>
                  </div>
                ) : filteredCustomers.length === 0 ? (
                  <div className="p-12 text-center">
                    <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                    </div>
                    <h4 className="text-sm font-semibold text-slate-800">No Customers Found</h4>
                    <p className="text-xs text-slate-500 mt-1">
                      {searchTerm
                        ? `No registered customers match "${searchTerm}".`
                        : 'There are currently no registered customers in the database.'}
                    </p>
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm('')}
                        className="mt-3 text-xs text-indigo-600 font-semibold hover:underline"
                      >
                        Clear search query
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                          <th className="py-3 px-4">Customer Name</th>
                          <th className="py-3 px-4">Email Address</th>
                          <th className="py-3 px-4">Verification</th>
                          <th className="py-3 px-4">Assigned Role</th>
                          <th className="py-3 px-4">Registration Date</th>
                          <th className="py-3 px-4 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                        {filteredCustomers.map((customer) => (
                          <tr key={customer._id} className="hover:bg-slate-50/80 transition-colors">
                            {/* Name */}
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center shrink-0 text-xs">
                                  {customer.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <p className="font-semibold text-slate-900">{customer.name}</p>
                                  <p className="text-[10px] text-slate-400 font-mono">ID: {customer._id.slice(-6)}</p>
                                </div>
                              </div>
                            </td>

                            {/* Email */}
                            <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600">
                              {customer.email}
                            </td>

                            {/* Verification Status */}
                            <td className="py-3.5 px-4">
                              {customer.isEmailVerified ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                  Verified
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                  Pending
                                </span>
                              )}
                            </td>

                            {/* Role */}
                            <td className="py-3.5 px-4">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                {customer.role?.display || customer.role?.name || 'Customer'}
                              </span>
                            </td>

                            {/* Created At */}
                            <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                              {customer.createdAt
                                ? new Date(customer.createdAt).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : 'N/A'}
                            </td>

                            {/* Action Link */}
                            <td className="py-3.5 px-4 text-right">
                              {mounted && hasPermission('promotions:send') && (
                                <Link
                                  href={`/promotions?target=${customer._id}`}
                                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
                                >
                                  Send Promo →
                                </Link>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
