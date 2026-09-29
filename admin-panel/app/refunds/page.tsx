'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { getToken, getAdmin, clearAuth, AdminUser, hasPermission } from '@/lib/auth';
import {
  getRefundRequests,
  approveRefundRequest,
  rejectRefundRequest,
  AdminRefundRequest,
} from '@/lib/api';

export default function RefundsPage() {
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [refundRequests, setRefundRequests] = useState<AdminRefundRequest[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isAccessDenied, setIsAccessDenied] = useState(false);

  // Detail / Action Modal State
  const [selectedRequest, setSelectedRequest] = useState<AdminRefundRequest | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function loadData() {
    const token = getToken();
    if (!token) {
      clearAuth();
      router.replace('/login');
      return;
    }

    const cachedAdmin = getAdmin();
    if (cachedAdmin) {
      setAdmin(cachedAdmin);
    }

    // Frontend ACL check
    if (!hasPermission('refunds:read')) {
      setIsAccessDenied(true);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage(null);

      const response = await getRefundRequests(undefined, token);

      if (response.success && response.refundRequests) {
        setRefundRequests(response.refundRequests);
      } else {
        if (response.status === 401) {
          clearAuth();
          router.replace('/login');
        } else if (response.status === 403) {
          setIsAccessDenied(true);
        } else {
          setErrorMessage(response.message || 'Failed to fetch refund requests');
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error fetching refund requests');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    setMounted(true);
    loadData();
  }, [router]);

  // Filtered requests based on search and status
  const filteredRequests = useMemo(() => {
    return refundRequests.filter((req) => {
      const customerName = req.customer?.name || (typeof req.order?.customer === 'object' ? req.order?.customer?.name : '') || req.order?.customerName || '';
      const customerEmail = req.customer?.email || (typeof req.order?.customer === 'object' ? req.order?.customer?.email : '') || req.order?.customerEmail || '';
      const orderId = req.order?._id || '';
      const requestId = req._id || '';

      const matchSearch =
        customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customerEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
        orderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        requestId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.reason.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchSearch) return false;

      if (filterStatus !== 'all' && req.status !== filterStatus) {
        return false;
      }

      return true;
    });
  }, [refundRequests, searchTerm, filterStatus]);

  // Statistics
  const stats = useMemo(() => {
    const total = refundRequests.length;
    const pending = refundRequests.filter((r) => r.status === 'pending' || r.status === 'processing').length;
    const refunded = refundRequests.filter((r) => r.status === 'refunded').length;
    const rejected = refundRequests.filter((r) => r.status === 'rejected').length;
    const totalRefundedAmount = refundRequests
      .filter((r) => r.status === 'refunded')
      .reduce((sum, r) => sum + (r.approvedAmount || r.requestedAmount || 0), 0);

    return { total, pending, refunded, rejected, totalRefundedAmount };
  }, [refundRequests]);

  const openDetailsModal = (req: AdminRefundRequest) => {
    setSelectedRequest(req);
    setAdminNote(req.adminNote || '');
    setActionError(null);
  };

  const closeDetailsModal = () => {
    if (isProcessingAction) return;
    setSelectedRequest(null);
    setAdminNote('');
    setActionError(null);
  };

  const handleApproveRefund = async () => {
    if (!selectedRequest) return;
    const token = getToken();
    if (!token) return;

    try {
      setIsProcessingAction(true);
      setActionError(null);

      const response = await approveRefundRequest(
        selectedRequest._id,
        { adminNote: adminNote.trim() },
        token
      );

      if (response.success) {
        setSuccessMessage(`Refund of ₹${(selectedRequest.requestedAmount || 0).toFixed(2)} processed successfully via Stripe!`);
        await loadData();
        closeDetailsModal();
        setTimeout(() => setSuccessMessage(null), 5000);
      } else {
        setActionError(response.message || 'Failed to approve and process refund.');
      }
    } catch (err: any) {
      setActionError(err.message || 'Error processing refund via Stripe.');
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleRejectRefund = async () => {
    if (!selectedRequest) return;
    const token = getToken();
    if (!token) return;

    if (!adminNote.trim()) {
      setActionError('Please provide a reason / note for rejecting the refund request.');
      return;
    }

    try {
      setIsProcessingAction(true);
      setActionError(null);

      const response = await rejectRefundRequest(
        selectedRequest._id,
        { adminNote: adminNote.trim() },
        token
      );

      if (response.success) {
        setSuccessMessage('Refund request rejected and customer notified.');
        await loadData();
        closeDetailsModal();
        setTimeout(() => setSuccessMessage(null), 5000);
      } else {
        setActionError(response.message || 'Failed to reject refund request.');
      }
    } catch (err: any) {
      setActionError(err.message || 'Error rejecting refund request.');
    } finally {
      setIsProcessingAction(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header admin={admin} />

        <main className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
          {/* Title and Top Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-white">Refund Requests</h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-950/80 text-indigo-400 border border-indigo-700/50">
                  Stripe Enabled
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Review customer refund claims and execute automated refunds directly through Stripe.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={loadData}
                disabled={isLoading}
                className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-300 transition-colors flex items-center gap-1.5"
              >
                <span>🔄</span>
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Access Denied Banner */}
          {isAccessDenied ? (
            <div className="p-8 rounded-2xl bg-red-950/40 border border-red-800/60 text-center max-w-md mx-auto space-y-3">
              <div className="w-12 h-12 rounded-full bg-red-900/50 text-red-300 flex items-center justify-center mx-auto text-xl font-bold">
                ✕
              </div>
              <h3 className="text-base font-bold text-white">Access Denied</h3>
              <p className="text-xs text-slate-400">
                You do not possess the required ACL permission (<code className="text-red-300">refunds:read</code>) to view refund requests.
              </p>
            </div>
          ) : (
            <>
              {/* Alert Toasts */}
              {successMessage && (
                <div className="p-4 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-xs font-semibold flex items-center justify-between animate-in fade-in">
                  <span>✓ {successMessage}</span>
                  <button onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-white">✕</button>
                </div>
              )}
              {errorMessage && (
                <div className="p-4 rounded-xl bg-red-950/80 border border-red-500/50 text-red-300 text-xs font-semibold flex items-center justify-between">
                  <span>✕ {errorMessage}</span>
                  <button onClick={() => setErrorMessage(null)} className="text-red-400 hover:text-white">✕</button>
                </div>
              )}

              {/* Metric Stat Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 shadow-md space-y-1">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Requests</span>
                  <div className="text-2xl font-black text-white">{stats.total}</div>
                  <div className="text-[11px] text-slate-500">All recorded claims</div>
                </div>

                <div className="bg-slate-900/70 border border-amber-900/40 rounded-2xl p-4 shadow-md space-y-1">
                  <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">Pending Review</span>
                  <div className="text-2xl font-black text-amber-300">{stats.pending}</div>
                  <div className="text-[11px] text-amber-500/80">Requires Admin decision</div>
                </div>

                <div className="bg-slate-900/70 border border-emerald-900/40 rounded-2xl p-4 shadow-md space-y-1">
                  <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">Refunded via Stripe</span>
                  <div className="text-2xl font-black text-emerald-300">{stats.refunded}</div>
                  <div className="text-[11px] text-emerald-500/80">₹{stats.totalRefundedAmount.toFixed(2)} refunded</div>
                </div>

                <div className="bg-slate-900/70 border border-rose-900/40 rounded-2xl p-4 shadow-md space-y-1">
                  <span className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider">Rejected Requests</span>
                  <div className="text-2xl font-black text-rose-300">{stats.rejected}</div>
                  <div className="text-[11px] text-rose-500/80">Declined by Admin</div>
                </div>
              </div>

              {/* Filter Tabs & Search Controls */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
                {/* Status Tabs */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {['all', 'pending', 'refunded', 'rejected', 'processing', 'failed'].map((st) => (
                    <button
                      key={st}
                      onClick={() => setFilterStatus(st)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all ${
                        filterStatus === st
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                          : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>

                {/* Search Input */}
                <div className="w-full sm:w-72">
                  <input
                    type="text"
                    placeholder="Search order, customer, reason..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
              </div>

              {/* Data Table */}
              <div className="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                {isLoading ? (
                  <div className="p-8 space-y-3 animate-pulse">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="h-12 bg-slate-800/60 rounded-xl" />
                    ))}
                  </div>
                ) : filteredRequests.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 space-y-2">
                    <div className="text-3xl">📭</div>
                    <p className="text-sm font-semibold text-white">No Refund Requests Found</p>
                    <p className="text-xs text-slate-500">
                      {searchTerm || filterStatus !== 'all'
                        ? 'Try modifying your filter or search query.'
                        : 'Customer refund requests will appear here once submitted.'}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                          <th className="py-3.5 px-4">Request / Order</th>
                          <th className="py-3.5 px-4">Customer</th>
                          <th className="py-3.5 px-4">Amount</th>
                          <th className="py-3.5 px-4">Reason</th>
                          <th className="py-3.5 px-4">Status</th>
                          <th className="py-3.5 px-4">Date</th>
                          <th className="py-3.5 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {filteredRequests.map((req) => {
                          const customerName =
                            req.customer?.name ||
                            (typeof req.order?.customer === 'object' ? req.order?.customer?.name : '') ||
                            req.order?.customerName ||
                            'Customer';
                          const customerEmail =
                            req.customer?.email ||
                            (typeof req.order?.customer === 'object' ? req.order?.customer?.email : '') ||
                            req.order?.customerEmail ||
                            'N/A';

                          return (
                            <tr key={req._id} className="hover:bg-slate-800/40 transition-colors">
                              <td className="py-3.5 px-4">
                                <div className="font-mono font-bold text-white">
                                  #{req._id.slice(-6).toUpperCase()}
                                </div>
                                <div className="text-[11px] text-slate-400 font-mono">
                                  Order: #{req.order?._id ? req.order._id.slice(-6).toUpperCase() : 'N/A'}
                                </div>
                              </td>

                              <td className="py-3.5 px-4">
                                <div className="font-semibold text-white">{customerName}</div>
                                <div className="text-[11px] text-slate-400">{customerEmail}</div>
                              </td>

                              <td className="py-3.5 px-4">
                                <div className="font-black text-white text-sm">
                                  ₹{(req.requestedAmount || 0).toFixed(2)}
                                </div>
                                {req.approvedAmount && req.approvedAmount > 0 && req.status === 'refunded' && (
                                  <div className="text-[10px] text-emerald-400 font-semibold">
                                    Refunded: ₹{req.approvedAmount.toFixed(2)}
                                  </div>
                                )}
                              </td>

                              <td className="py-3.5 px-4 max-w-xs">
                                <span className="font-medium text-slate-200">{req.reason}</span>
                                {req.description && (
                                  <p className="text-[11px] text-slate-500 truncate max-w-xs mt-0.5">
                                    {req.description}
                                  </p>
                                )}
                              </td>

                              <td className="py-3.5 px-4">
                                <span
                                  className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                                    req.status === 'refunded'
                                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                      : req.status === 'pending'
                                      ? 'bg-amber-500/15 text-amber-400 border-amber-500/30 animate-pulse'
                                      : req.status === 'processing'
                                      ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                                      : req.status === 'rejected'
                                      ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                                      : 'bg-red-500/15 text-red-400 border-red-500/30'
                                  }`}
                                >
                                  {req.status.toUpperCase()}
                                </span>
                              </td>

                              <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                                {new Date(req.requestedAt || req.createdAt).toLocaleDateString()}
                              </td>

                              <td className="py-3.5 px-4 text-right">
                                <button
                                  onClick={() => openDetailsModal(req)}
                                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white border border-slate-700 text-xs font-semibold transition-all shadow-sm"
                                >
                                  {req.status === 'pending' ? 'Review & Process' : 'View Details'}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>

      {/* Review / Details Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold text-lg">
                  ↩
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">Refund Request Details</h3>
                  <p className="text-xs text-slate-400">
                    Claim #{selectedRequest._id.slice(-8).toUpperCase()} • Order #{selectedRequest.order?._id ? selectedRequest.order._id.slice(-8).toUpperCase() : 'N/A'}
                  </p>
                </div>
              </div>
              <button
                onClick={closeDetailsModal}
                disabled={isProcessingAction}
                className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Request & Order Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Customer & Payment Info */}
              <div className="bg-slate-950/60 rounded-2xl p-4 border border-slate-800 space-y-2">
                <h4 className="font-bold text-slate-300 uppercase tracking-wider text-[11px] pb-1 border-b border-slate-800">
                  Customer & Payment
                </h4>
                <div className="flex justify-between">
                  <span className="text-slate-500">Customer:</span>
                  <span className="text-white font-medium">
                    {selectedRequest.customer?.name || selectedRequest.order?.customerName || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Email:</span>
                  <span className="text-slate-300">
                    {selectedRequest.customer?.email || selectedRequest.order?.customerEmail || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Amount Paid:</span>
                  <span className="text-white font-black">
                    ₹{(selectedRequest.order?.totalAmount || selectedRequest.requestedAmount || 0).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Payment Status:</span>
                  <span className="text-emerald-400 font-semibold">
                    {selectedRequest.order?.paymentStatus?.toUpperCase() || 'PAID'}
                  </span>
                </div>
                {selectedRequest.stripePaymentIntentId && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Stripe PI:</span>
                    <span className="text-slate-400 font-mono text-[10px] truncate max-w-[160px]">
                      {selectedRequest.stripePaymentIntentId}
                    </span>
                  </div>
                )}
                {selectedRequest.stripeRefundId && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Stripe Refund ID:</span>
                    <span className="text-emerald-400 font-mono text-[10px] truncate max-w-[160px]">
                      {selectedRequest.stripeRefundId}
                    </span>
                  </div>
                )}
              </div>

              {/* Claim Details */}
              <div className="bg-slate-950/60 rounded-2xl p-4 border border-slate-800 space-y-2">
                <h4 className="font-bold text-slate-300 uppercase tracking-wider text-[11px] pb-1 border-b border-slate-800">
                  Refund Reason & Status
                </h4>
                <div className="flex justify-between">
                  <span className="text-slate-500">Claim Reason:</span>
                  <span className="text-amber-300 font-semibold">{selectedRequest.reason}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Requested Refund:</span>
                  <span className="text-white font-black text-sm">
                    ₹{(selectedRequest.requestedAmount || 0).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Claim Status:</span>
                  <span className="font-bold text-indigo-400">{selectedRequest.status.toUpperCase()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Date Raised:</span>
                  <span className="text-slate-300">
                    {new Date(selectedRequest.requestedAt || selectedRequest.createdAt).toLocaleString()}
                  </span>
                </div>
                {selectedRequest.processedAt && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Processed At:</span>
                    <span className="text-slate-400">
                      {new Date(selectedRequest.processedAt).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Customer Description */}
            {selectedRequest.description && (
              <div className="bg-slate-950/60 rounded-2xl p-4 border border-slate-800 space-y-1.5 text-xs">
                <span className="text-slate-400 font-semibold">Customer Problem Description:</span>
                <p className="text-slate-200 bg-slate-900/60 p-3 rounded-xl border border-slate-800 leading-relaxed">
                  {selectedRequest.description}
                </p>
              </div>
            )}

            {/* Order Items List */}
            {selectedRequest.order?.items && selectedRequest.order.items.length > 0 && (
              <div className="bg-slate-950/60 rounded-2xl p-4 border border-slate-800 space-y-2 text-xs">
                <h4 className="font-bold text-slate-300 uppercase tracking-wider text-[11px]">
                  Purchased Products
                </h4>
                <div className="divide-y divide-slate-800/80 max-h-36 overflow-y-auto">
                  {selectedRequest.order.items.map((item, idx) => (
                    <div key={idx} className="py-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500">📦</span>
                        <div>
                          <p className="font-semibold text-white">{item.title}</p>
                          <p className="text-slate-500 text-[11px]">
                            Qty: {item.quantity} × ₹{Number(item.priceAtPurchase).toFixed(2)}
                          </p>
                        </div>
                      </div>
                      <span className="font-bold text-slate-200">
                        ₹{(Number(item.priceAtPurchase) * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Admin Note Section */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-300">
                Admin Note / Decision Explanation
              </label>
              <textarea
                rows={2}
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                disabled={isProcessingAction || selectedRequest.status !== 'pending'}
                placeholder={
                  selectedRequest.status === 'pending'
                    ? 'Enter internal note or reason for customer notification...'
                    : 'No additional note recorded.'
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors resize-none disabled:opacity-60"
              />
            </div>

            {/* Error Message */}
            {actionError && (
              <div className="p-3 rounded-xl bg-red-950/70 border border-red-500/50 text-red-300 text-xs">
                ✕ {actionError}
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={closeDetailsModal}
                disabled={isProcessingAction}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
              >
                Close
              </button>

              {selectedRequest.status === 'pending' && (
                <div className="flex items-center gap-3">
                  {hasPermission('refunds:reject') && (
                    <button
                      type="button"
                      onClick={handleRejectRefund}
                      disabled={isProcessingAction}
                      className="px-4 py-2.5 rounded-xl bg-rose-950/70 hover:bg-rose-900/80 text-rose-300 border border-rose-700/60 text-xs font-bold transition-all disabled:opacity-50"
                    >
                      Reject Request
                    </button>
                  )}

                  {hasPermission('refunds:approve') && (
                    <button
                      type="button"
                      onClick={handleApproveRefund}
                      disabled={isProcessingAction}
                      className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-lg shadow-emerald-600/25 flex items-center gap-2 disabled:opacity-50"
                    >
                      {isProcessingAction ? (
                        <>
                          <span className="animate-spin inline-block">⏳</span>
                          <span>Processing via Stripe...</span>
                        </>
                      ) : (
                        <span>✓ Approve & Refund via Stripe</span>
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
