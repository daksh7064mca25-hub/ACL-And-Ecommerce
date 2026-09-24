'use client';

import React, { useEffect, useState, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { getToken, getAdmin, clearAuth, AdminUser, hasPermission } from '@/lib/auth';
import { getCustomers, sendPromotion, CustomerUser } from '@/lib/api';

const DEFAULT_SAMPLE_HTML = `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; }
    .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; }
    .hero { background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 36px 24px; text-align: center; color: #ffffff; }
    .hero h1 { margin: 0; font-size: 26px; font-weight: bold; }
    .hero p { margin: 8px 0 0; font-size: 15px; opacity: 0.9; }
    .content { padding: 32px 24px; color: #334155; line-height: 1.6; }
    .badge { display: inline-block; background: #ecfdf5; color: #047857; font-weight: bold; padding: 6px 14px; border-radius: 9999px; font-size: 13px; margin-bottom: 16px; border: 1px solid #a7f3d0; }
    .cta-btn { display: inline-block; background: #4f46e5; color: #ffffff !important; font-weight: bold; padding: 12px 28px; border-radius: 8px; text-decoration: none; margin: 20px 0; }
    .footer { background: #f1f5f9; padding: 16px 24px; text-align: center; font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div class="card">
    <div class="hero">
      <h1>Special Customer Offer! 🎉</h1>
      <p>Enjoy exclusive savings on your next order</p>
    </div>
    <div class="content">
      <div class="badge">PROMO CODE: SAVE20</div>
      <p>Hello Valued Customer,</p>
      <p>As a valued member of our community, we are delighted to offer you an exclusive <strong>20% discount</strong> on all our premium services.</p>
      <div style="text-align: center;">
        <a href="https://example.com" class="cta-btn">Claim Your 20% Discount</a>
      </div>
      <p style="font-size: 13px; color: #64748b;">Offer valid for a limited time only. Terms and conditions apply.</p>
    </div>
    <div class="footer">
      <p>© 2026 Admin Portal Inc. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;

function PromotionsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const targetId = searchParams.get('target');

  const [mounted, setMounted] = useState(false);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(true);
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [customers, setCustomers] = useState<CustomerUser[]>([]);
  const [isAccessDenied, setIsAccessDenied] = useState(false);

  // Email form state
  const [subject, setSubject] = useState('Exclusive Customer Promotion 🎁');
  const [htmlContent, setHtmlContent] = useState(DEFAULT_SAMPLE_HTML);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [previewMode, setPreviewMode] = useState(false);

  // Submission feedback
  const [isSending, setIsSending] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
    sentCount?: number;
    simulated?: boolean;
  } | null>(null);

  useEffect(() => {
    setMounted(true);
    let isMounted = true;

    async function loadData() {
      const token = getToken();
      if (!token) {
        if (isMounted) {
          clearAuth();
          router.replace('/login');
        }
        return;
      }

      const cachedAdmin = getAdmin();
      if (cachedAdmin && isMounted) {
        setAdmin(cachedAdmin);
      }

      // Check ACL permission for promotions:read
      if (!hasPermission('promotions:read')) {
        if (isMounted) {
          setIsAccessDenied(true);
          setIsLoadingCustomers(false);
        }
        return;
      }

      setIsLoadingCustomers(true);
      const res = await getCustomers(token);

      if (!isMounted) return;

      if (res.success && res.users) {
        setCustomers(res.users);
        if (targetId) {
          const exists = res.users.some((u) => u._id === targetId);
          if (exists) {
            setSelectedCustomerIds([targetId]);
          }
        }
      } else {
        if (res.status === 401) {
          clearAuth();
          router.replace('/login');
          return;
        } else if (res.status === 403) {
          // If user lacks permission to list customers
          setFeedback({
            type: 'error',
            message: 'You do not have permission (users:read) to view the recipient list.',
          });
        }
      }
      setIsLoadingCustomers(false);
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [router, targetId]);

  // Filtered customer list for recipient selection
  const filteredCustomers = useMemo(() => {
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.email.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [customers, searchTerm]);

  // Select all / Deselect all
  const handleToggleSelectAll = () => {
    if (selectedCustomerIds.length === customers.length) {
      setSelectedCustomerIds([]);
    } else {
      setSelectedCustomerIds(customers.map((c) => c._id));
    }
  };

  // Toggle single customer
  const handleToggleCustomer = (id: string) => {
    setSelectedCustomerIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Send Promotion Submission
  const handleSendPromotion = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    // Permission check for promotions:send
    if (!hasPermission('promotions:send')) {
      setFeedback({
        type: 'error',
        message: 'Access Denied: You do not possess the required ACL permission (promotions:send) to dispatch campaigns.',
      });
      return;
    }

    // 1. Validate HTML content
    if (!htmlContent.trim()) {
      setFeedback({
        type: 'error',
        message: 'Please enter promotional HTML email content.',
      });
      return;
    }

    // 2. Validate at least 1 customer is selected
    if (selectedCustomerIds.length === 0) {
      setFeedback({
        type: 'error',
        message: 'Please select at least one customer recipient from the list below.',
      });
      return;
    }

    setIsSending(true);

    try {
      const response = await sendPromotion({
        subject: subject.trim(),
        html: htmlContent.trim(),
        customerIds: selectedCustomerIds,
      });

      if (response.success) {
        setFeedback({
          type: 'success',
          message: response.message || 'Promotion successfully dispatched!',
          sentCount: response.sentCount,
          simulated: response.simulated,
        });
      } else {
        setFeedback({
          type: 'error',
          message: response.message || 'Failed to send promotion.',
        });
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        message: 'An unexpected network error occurred while sending the email.',
      });
    } finally {
      setIsSending(false);
    }
  };

  const isAllSelected = customers.length > 0 && selectedCustomerIds.length === customers.length;
  const canSendPromotions = mounted && hasPermission('promotions:send');

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header admin={admin} title="Promotional Campaigns" />

        <main className="flex-1 p-8 overflow-y-auto max-w-7xl w-full mx-auto space-y-6">
          {/* Header Banner */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider bg-purple-50 text-purple-700 px-2.5 py-0.5 rounded-full border border-purple-200">
                  Email Marketing
                </span>
                <span className="text-xs text-slate-500">• ACL Permission: promotions:read / send</span>
              </div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Create & Dispatch Promotion</h2>
              <p className="text-xs text-slate-500 mt-1">
                Compose custom HTML emails, choose target customer recipients, and send instantly via the backend service.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-xl text-xs">
                <span className="text-slate-500 block">Selected Recipients</span>
                <span className="text-indigo-700 font-bold text-base">
                  {selectedCustomerIds.length}{' '}
                  <span className="text-xs font-normal text-slate-500">/ {customers.length}</span>
                </span>
              </div>
            </div>
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
                  You do not possess the required ACL permission (<code className="bg-rose-50 text-rose-700 px-1 py-0.5 rounded font-mono">promotions:read</code>) to access the promotions module.
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
              {/* Feedback Alert Banners */}
              {feedback && (
                <div
                  className={`p-4 rounded-xl border flex items-start gap-3 transition-all ${
                    feedback.type === 'success'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                      feedback.type === 'success' ? 'bg-emerald-200 text-emerald-900' : 'bg-rose-200 text-rose-900'
                    }`}
                  >
                    {feedback.type === 'success' ? '✓' : '!'}
                  </div>
                  <div className="flex-1 text-xs">
                    <p className="font-semibold text-sm">
                      {feedback.type === 'success' ? 'Campaign Dispatched Successfully!' : 'Campaign Notice'}
                    </p>
                    <p className="mt-0.5">{feedback.message}</p>
                    {feedback.simulated && (
                      <p className="mt-1 text-[11px] text-emerald-700 opacity-90">
                        ℹ️ Note: SMTP credentials not set in .env — email logged to backend console for local development.
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setFeedback(null)}
                    className="text-slate-400 hover:text-slate-700 text-xs font-bold"
                  >
                    ✕
                  </button>
                </div>
              )}

              <form onSubmit={handleSendPromotion} className="space-y-6">
                {/* Section A: Email Editor */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">
                        1
                      </span>
                      <h3 className="text-sm font-bold text-slate-900">Email Campaign Content</h3>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Template Presets */}
                      <button
                        type="button"
                        onClick={() => setHtmlContent(DEFAULT_SAMPLE_HTML)}
                        className="text-xs px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors font-medium"
                      >
                        Reset Template
                      </button>

                      {/* Toggle Preview Button */}
                      <button
                        type="button"
                        onClick={() => setPreviewMode(!previewMode)}
                        className={`text-xs px-3 py-1 rounded-lg transition-colors font-medium flex items-center gap-1 ${
                          previewMode
                            ? 'bg-indigo-600 text-white'
                            : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
                        }`}
                      >
                        <span>{previewMode ? '📝 Edit HTML' : '👁️ Preview Render'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Subject Field */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Email Subject Line
                    </label>
                    <input
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="e.g. Exclusive Weekend Offer: 20% Off"
                      disabled={isSending}
                      className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>

                  {/* HTML Editor / Preview Area */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      HTML Email Template Content
                    </label>

                    {previewMode ? (
                      <div className="border border-slate-300 rounded-xl overflow-hidden bg-slate-100 p-4">
                        <div className="text-[11px] text-slate-500 font-medium mb-2 flex items-center justify-between">
                          <span>Live Render Preview</span>
                          <span className="text-[10px] bg-white px-2 py-0.5 rounded border border-slate-200">
                            Subject: {subject || '(No Subject)'}
                          </span>
                        </div>
                        <div
                          className="bg-white rounded-lg p-4 border border-slate-200 min-h-[300px] overflow-auto"
                          dangerouslySetInnerHTML={{ __html: htmlContent }}
                        />
                      </div>
                    ) : (
                      <div className="relative">
                        <textarea
                          id="promo-html-editor"
                          value={htmlContent}
                          onChange={(e) => setHtmlContent(e.target.value)}
                          rows={12}
                          disabled={isSending}
                          placeholder="<h1>Special Offer</h1><p>Enter your email HTML here...</p>"
                          className="block w-full p-4 font-mono text-xs text-slate-800 bg-slate-900 text-slate-100 rounded-xl border border-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 leading-relaxed disabled:opacity-60"
                          spellCheck={false}
                        />
                        <div className="text-[10px] text-slate-400 mt-1 flex justify-between">
                          <span>HTML, CSS inline styles, and responsive email tags are supported.</span>
                          <span>{htmlContent.length} characters</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Section B: Customer Selection */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">
                        2
                      </span>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">Select Customer Recipients</h3>
                        <p className="text-[11px] text-slate-500">
                          Choose which customers will receive this promotion.
                        </p>
                      </div>
                    </div>

                    {/* Quick Selection Controls */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleToggleSelectAll}
                        disabled={isSending || customers.length === 0}
                        className="text-xs px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold rounded-lg border border-indigo-200 transition-colors disabled:opacity-50"
                      >
                        {isAllSelected ? 'Deselect All' : 'Select All (' + customers.length + ')'}
                      </button>
                      {selectedCustomerIds.length > 0 && !isAllSelected && (
                        <button
                          type="button"
                          onClick={() => setSelectedCustomerIds([])}
                          disabled={isSending}
                          className="text-xs px-2.5 py-1.5 text-slate-500 hover:text-slate-800 font-medium transition-colors"
                        >
                          Clear ({selectedCustomerIds.length})
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Search Filter for Customers */}
                  <div className="relative max-w-md">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Filter recipients by name or email..."
                      className="block w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>

                  {/* Customers Table / Checkbox List */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
                    {isLoadingCustomers ? (
                      <div className="p-8 text-center text-xs text-slate-500">
                        <div className="w-6 h-6 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin mx-auto mb-2" />
                        Loading customers...
                      </div>
                    ) : filteredCustomers.length === 0 ? (
                      <div className="p-8 text-center text-xs text-slate-500">
                        No customers found matching your filter.
                      </div>
                    ) : (
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                          <tr>
                            <th className="py-2.5 px-4 w-12 text-center">
                              <input
                                type="checkbox"
                                checked={isAllSelected}
                                onChange={handleToggleSelectAll}
                                disabled={isSending}
                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                              />
                            </th>
                            <th className="py-2.5 px-4">Customer</th>
                            <th className="py-2.5 px-4">Email</th>
                            <th className="py-2.5 px-4">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                          {filteredCustomers.map((cust) => {
                            const isChecked = selectedCustomerIds.includes(cust._id);
                            return (
                              <tr
                                key={cust._id}
                                onClick={() => !isSending && handleToggleCustomer(cust._id)}
                                className={`cursor-pointer transition-colors ${
                                  isChecked ? 'bg-indigo-50/60 font-medium' : 'hover:bg-slate-50'
                                }`}
                              >
                                <td className="py-2.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => handleToggleCustomer(cust._id)}
                                    disabled={isSending}
                                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                  />
                                </td>
                                <td className="py-2.5 px-4 font-semibold text-slate-900">{cust.name}</td>
                                <td className="py-2.5 px-4 font-mono text-[11px] text-slate-600">{cust.email}</td>
                                <td className="py-2.5 px-4">
                                  {cust.isEmailVerified ? (
                                    <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200">
                                      Verified
                                    </span>
                                  ) : (
                                    <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">
                                      Pending
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>

                {/* Section C: Action Dispatch Bar */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="text-xs text-slate-600">
                    <p className="font-semibold text-slate-800">Ready to dispatch campaign?</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      The email will be sent immediately to all{' '}
                      <strong className="text-indigo-600 font-bold">{selectedCustomerIds.length}</strong> selected customer(s).
                    </p>
                    {!canSendPromotions && (
                      <p className="text-[11px] text-rose-600 mt-1 font-semibold">
                        ⚠️ Note: Your account does not possess the <code>promotions:send</code> permission.
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="submit"
                      id="send-promotion-btn"
                      disabled={isSending || selectedCustomerIds.length === 0 || !canSendPromotions}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-600/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {isSending ? (
                        <>
                          <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                          <span>Dispatching Promotion...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                          </svg>
                          <span>Send Promotion ({selectedCustomerIds.length})</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default function PromotionsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin" />
        </div>
      }
    >
      <PromotionsContent />
    </Suspense>
  );
}
