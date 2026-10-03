'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { getToken, getAdmin, clearAuth, AdminUser, hasPermission } from '@/lib/auth';
import {
  getAdminDeliveryZones,
  createAdminDeliveryZone,
  updateAdminDeliveryZone,
  deleteAdminDeliveryZone,
  getProducts,
  DeliveryZoneItem,
  DeliveryZoneBoundary,
  DeliveryZoneInput,
  ProductItem,
} from '@/lib/api';
import DeliveryZoneMapEditor from '@/components/DeliveryZoneMapEditor';

const PRESET_COLORS = ['#4f46e5', '#059669', '#d97706', '#7c3aed', '#dc2626', '#0284c7'];

export default function DeliveryZonesPage() {
  const router = useRouter();

  // Auth & Lifecycle State
  const [mounted, setMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [zones, setZones] = useState<DeliveryZoneItem[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAccessDenied, setIsAccessDenied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [currentZone, setCurrentZone] = useState<DeliveryZoneItem | null>(null);

  // Form Fields
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formDeliveryFee, setFormDeliveryFee] = useState<string | number>('30');
  const [formMinOrderAmount, setFormMinOrderAmount] = useState<string | number>('100');
  const [formEstimatedTime, setFormEstimatedTime] = useState('30-45 mins');
  const [formPriority, setFormPriority] = useState<number>(1);
  const [formIsActive, setFormIsActive] = useState<boolean>(true);
  const [formCoverageType, setFormCoverageType] = useState<'all_products' | 'specific_products' | 'categories'>('all_products');
  const [formAssignedProducts, setFormAssignedProducts] = useState<string[]>([]);
  const [formColor, setFormColor] = useState('#4f46e5');
  const [formBoundary, setFormBoundary] = useState<DeliveryZoneBoundary | null>(null);

  // ACL Capabilities
  const canCreate = mounted && hasPermission('delivery_zones:create');
  const canUpdate = mounted && hasPermission('delivery_zones:update');
  const canDelete = mounted && hasPermission('delivery_zones:delete');

  const handleBoundaryChange = useCallback((b: DeliveryZoneBoundary) => {
    setFormBoundary(b);
  }, []);

  // Load delivery zones & catalog products
  const loadData = async () => {
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

    if (!hasPermission('delivery_zones:read')) {
      setIsAccessDenied(true);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [zonesRes, prodsRes] = await Promise.all([
        getAdminDeliveryZones(token),
        getProducts(undefined, token),
      ]);

      if (zonesRes.status === 401 || prodsRes.status === 401) {
        clearAuth();
        router.replace('/login');
        return;
      }

      if (zonesRes.status === 403) {
        setIsAccessDenied(true);
        setIsLoading(false);
        return;
      }

      if (zonesRes.success && zonesRes.deliveryZones) {
        setZones(zonesRes.deliveryZones);
      } else {
        setErrorMessage(zonesRes.message || 'Failed to fetch delivery zones.');
      }

      if (prodsRes.success && prodsRes.products) {
        setProducts(prodsRes.products);
      }
    } catch {
      setErrorMessage('Network error while connecting to the backend server.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // Filtered zones
  const filteredZones = useMemo(() => {
    return zones.filter((z) => {
      const term = searchTerm.toLowerCase();
      return (
        z.name.toLowerCase().includes(term) ||
        z.code.toLowerCase().includes(term) ||
        (z.description && z.description.toLowerCase().includes(term))
      );
    });
  }, [zones, searchTerm]);

  // Metrics
  const activeCount = useMemo(() => zones.filter((z) => z.isActive).length, [zones]);
  const avgFee = useMemo(
    () => (zones.length > 0 ? zones.reduce((acc, z) => acc + (z.deliveryFee || 0), 0) / zones.length : 0),
    [zones]
  );

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setFormName('');
    setFormCode('');
    setFormDescription('');
    setFormDeliveryFee('35');
    setFormMinOrderAmount('100');
    setFormEstimatedTime('30-45 mins');
    setFormPriority(5);
    setFormIsActive(true);
    setFormCoverageType('all_products');
    setFormAssignedProducts([]);
    setFormColor('#4f46e5');
    setFormBoundary(null);
    setModalError(null);
    setIsCreateModalOpen(true);
  };

  // Submit Create Zone
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formName.trim()) {
      setModalError('Delivery zone name is required.');
      return;
    }
    if (!formCode.trim()) {
      setModalError('Zone code is required.');
      return;
    }
    if (!formBoundary || !formBoundary.coordinates || formBoundary.coordinates[0].length < 4) {
      setModalError('Please define a closed polygon boundary with at least 3 points on the map.');
      return;
    }

    setIsSubmitting(true);
    setModalError(null);

    const payload: DeliveryZoneInput = {
      name: formName.trim(),
      code: formCode.trim().toUpperCase(),
      description: formDescription.trim(),
      boundary: formBoundary,
      deliveryFee: Number(formDeliveryFee) || 0,
      minOrderAmount: Number(formMinOrderAmount) || 0,
      estimatedDeliveryTime: formEstimatedTime.trim() || '30-45 mins',
      priority: Number(formPriority) || 1,
      isActive: formIsActive,
      coverageType: formCoverageType,
      assignedProducts: formCoverageType === 'specific_products' ? formAssignedProducts : [],
      color: formColor,
    };

    const token = getToken();
    const res = await createAdminDeliveryZone(payload, token || undefined);

    setIsSubmitting(false);

    if (res.success && res.deliveryZone) {
      setZones((prev) => [res.deliveryZone!, ...prev]);
      setIsCreateModalOpen(false);
      setSuccessMessage(res.message || 'Delivery zone created successfully.');
      setTimeout(() => setSuccessMessage(null), 5000);
    } else {
      setModalError(res.message || 'Failed to create delivery zone.');
    }
  };

  // Open Edit Modal
  const handleOpenEditModal = (zone: DeliveryZoneItem) => {
    setCurrentZone(zone);
    setFormName(zone.name);
    setFormCode(zone.code);
    setFormDescription(zone.description || '');
    setFormDeliveryFee(zone.deliveryFee);
    setFormMinOrderAmount(zone.minOrderAmount);
    setFormEstimatedTime(zone.estimatedDeliveryTime);
    setFormPriority(zone.priority);
    setFormIsActive(zone.isActive);
    setFormCoverageType(zone.coverageType || 'all_products');
    setFormAssignedProducts((zone.assignedProducts || []).map((p) => (typeof p === 'string' ? p : p._id)));
    setFormColor(zone.color || '#4f46e5');
    setFormBoundary(zone.boundary);
    setModalError(null);
    setIsEditModalOpen(true);
  };

  // Submit Edit Zone
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentZone) return;

    if (!formName.trim()) {
      setModalError('Delivery zone name is required.');
      return;
    }
    if (!formCode.trim()) {
      setModalError('Zone code is required.');
      return;
    }
    if (!formBoundary || !formBoundary.coordinates || formBoundary.coordinates[0].length < 4) {
      setModalError('Please define a valid polygon boundary on the map.');
      return;
    }

    setIsSubmitting(true);
    setModalError(null);

    const payload: Partial<DeliveryZoneInput> = {
      name: formName.trim(),
      code: formCode.trim().toUpperCase(),
      description: formDescription.trim(),
      boundary: formBoundary,
      deliveryFee: Number(formDeliveryFee) || 0,
      minOrderAmount: Number(formMinOrderAmount) || 0,
      estimatedDeliveryTime: formEstimatedTime.trim(),
      priority: Number(formPriority) || 1,
      isActive: formIsActive,
      coverageType: formCoverageType,
      assignedProducts: formCoverageType === 'specific_products' ? formAssignedProducts : [],
      color: formColor,
    };

    const token = getToken();
    const res = await updateAdminDeliveryZone(currentZone._id, payload, token || undefined);

    setIsSubmitting(false);

    if (res.success && res.deliveryZone) {
      setZones((prev) => prev.map((z) => (z._id === currentZone._id ? res.deliveryZone! : z)));
      setIsEditModalOpen(false);
      setSuccessMessage(res.message || 'Delivery zone updated successfully.');
      setTimeout(() => setSuccessMessage(null), 5000);
    } else {
      setModalError(res.message || 'Failed to update delivery zone.');
    }
  };

  // Open Delete Modal
  const handleOpenDeleteModal = (zone: DeliveryZoneItem) => {
    setCurrentZone(zone);
    setModalError(null);
    setIsDeleteModalOpen(true);
  };

  // Submit Delete Zone
  const handleDeleteSubmit = async () => {
    if (!currentZone) return;

    setIsSubmitting(true);
    setModalError(null);

    const token = getToken();
    const res = await deleteAdminDeliveryZone(currentZone._id, token || undefined);

    setIsSubmitting(false);

    if (res.success) {
      setZones((prev) => prev.filter((z) => z._id !== currentZone._id));
      setIsDeleteModalOpen(false);
      setSuccessMessage(res.message || 'Delivery zone removed successfully.');
      setTimeout(() => setSuccessMessage(null), 5000);
    } else {
      setModalError(res.message || 'Failed to delete delivery zone.');
    }
  };

  // Product Selection Toggle
  const toggleProductSelection = (productId: string) => {
    setFormAssignedProducts((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
    );
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header admin={admin} title="Delivery Zone Management" />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
          {/* Top Title & Action Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  Delivery Zone Management
                </h1>
                <span className="text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full">
                  MongoDB 2dsphere
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Configure geographical delivery boundaries, delivery fees, minimum order amounts, and product availability.
              </p>
            </div>

            {canCreate && (
              <button
                onClick={handleOpenCreateModal}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-semibold rounded-xl shadow-sm shadow-indigo-600/30 transition-all cursor-pointer"
              >
                <span>+ Create Delivery Zone</span>
              </button>
            )}
          </div>

          {/* Access Denied View */}
          {isAccessDenied ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto text-xl font-bold">
                🔒
              </div>
              <h3 className="text-sm font-bold text-slate-800">Access Restricted</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Your account does not possess the required ACL permission: <code className="bg-slate-100 px-1 py-0.5 rounded text-rose-600">delivery_zones:read</code>.
              </p>
            </div>
          ) : (
            <>
              {/* Notification Banner */}
              {successMessage && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center justify-between shadow-2xs animate-fadeIn">
                  <div className="flex items-center gap-2 font-medium">
                    <span>✓</span>
                    <span>{successMessage}</span>
                  </div>
                  <button onClick={() => setSuccessMessage(null)} className="text-emerald-600 hover:text-emerald-800 text-sm font-bold">✕</button>
                </div>
              )}

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-[11px] font-medium text-slate-500">Total Delivery Zones</span>
                  <p className="text-xl font-bold text-slate-900 mt-1">{zones.length}</p>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Configured boundaries</span>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-[11px] font-medium text-slate-500">Active Service Zones</span>
                  <p className="text-xl font-bold text-emerald-600 mt-1">{activeCount}</p>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Currently accepting orders</span>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-[11px] font-medium text-slate-500">Average Delivery Charge</span>
                  <p className="text-xl font-bold text-indigo-600 mt-1">₹{avgFee.toFixed(2)}</p>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Across all regions</span>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-[11px] font-medium text-slate-500">Geospatial Index</span>
                  <p className="text-xl font-bold text-purple-600 mt-1">2dsphere</p>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">MongoDB $geoIntersects</span>
                </div>
              </div>

              {/* Search Bar */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search zones by name, code (e.g. CHD-EXP)..."
                    className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="absolute left-3 top-2.5 text-xs text-slate-400">🔍</span>
                </div>
                <div className="text-xs text-slate-500 font-medium">
                  Showing <span className="font-bold text-slate-800">{filteredZones.length}</span> of <span className="font-bold text-slate-800">{zones.length}</span> zones
                </div>
              </div>

              {/* Delivery Zones Table */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                {isLoading ? (
                  <div className="p-16 flex flex-col items-center justify-center gap-3">
                    <div className="w-8 h-8 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin" />
                    <p className="text-xs text-slate-500 font-medium">Loading delivery zones...</p>
                  </div>
                ) : filteredZones.length === 0 ? (
                  <div className="p-16 text-center space-y-3">
                    <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto text-xl">
                      🗺️
                    </div>
                    <h4 className="text-sm font-semibold text-slate-800">No Delivery Zones Found</h4>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      {searchTerm ? `No delivery zones match "${searchTerm}".` : 'No delivery zones have been configured yet.'}
                    </p>
                    {canCreate && !searchTerm && (
                      <button
                        onClick={handleOpenCreateModal}
                        className="mt-2 px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700"
                      >
                        + Create First Delivery Zone
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                          <th className="py-3.5 px-4">Zone Information</th>
                          <th className="py-3.5 px-4">Delivery Fee</th>
                          <th className="py-3.5 px-4">Min. Order</th>
                          <th className="py-3.5 px-4">Est. Time</th>
                          <th className="py-3.5 px-4">Product Scope</th>
                          <th className="py-3.5 px-4">Status</th>
                          <th className="py-3.5 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                        {filteredZones.map((zone) => {
                          const vertexCount = zone.boundary?.coordinates?.[0]?.length || 0;

                          return (
                            <tr key={zone._id} className="hover:bg-slate-50/80 transition-colors">
                              {/* Zone Name & Code */}
                              <td className="py-3.5 px-4">
                                <div className="flex items-center gap-2.5">
                                  <span
                                    className="w-3.5 h-3.5 rounded-full shrink-0 border border-white shadow-2xs"
                                    style={{ backgroundColor: zone.color || '#4f46e5' }}
                                  />
                                  <div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-bold text-slate-900">{zone.name}</span>
                                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                        {zone.code}
                                      </span>
                                    </div>
                                    <div className="text-[11px] text-slate-400 mt-0.5">
                                      <span>Priority {zone.priority}</span> •{' '}
                                      <span>{vertexCount > 0 ? `${vertexCount - 1} polygon vertices` : 'Polygon set'}</span>
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* Delivery Fee */}
                              <td className="py-3.5 px-4 font-semibold text-slate-900">
                                {zone.deliveryFee > 0 ? `₹${zone.deliveryFee.toFixed(2)}` : <span className="text-emerald-600 font-bold">Free</span>}
                              </td>

                              {/* Minimum Order */}
                              <td className="py-3.5 px-4 text-slate-700">
                                {zone.minOrderAmount > 0 ? `₹${zone.minOrderAmount.toFixed(2)}` : <span className="text-slate-400 italic">None</span>}
                              </td>

                              {/* Estimated Time */}
                              <td className="py-3.5 px-4">
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                  ⏱️ {zone.estimatedDeliveryTime}
                                </span>
                              </td>

                              {/* Product Scope */}
                              <td className="py-3.5 px-4">
                                {zone.coverageType === 'all_products' ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                                    All Products ({products.length})
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                                    {zone.assignedProducts?.length || 0} Products
                                  </span>
                                )}
                              </td>

                              {/* Active Status */}
                              <td className="py-3.5 px-4">
                                {zone.isActive ? (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    Active
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                    Inactive
                                  </span>
                                )}
                              </td>

                              {/* Actions */}
                              <td className="py-3.5 px-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  {canUpdate ? (
                                    <button
                                      onClick={() => handleOpenEditModal(zone)}
                                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                                      title="Edit Delivery Zone"
                                    >
                                      Edit
                                    </button>
                                  ) : (
                                    <button disabled className="px-2.5 py-1.5 bg-slate-50 text-slate-400 text-xs font-semibold rounded-lg cursor-not-allowed opacity-60">
                                      Edit
                                    </button>
                                  )}

                                  {canDelete ? (
                                    <button
                                      onClick={() => handleOpenDeleteModal(zone)}
                                      className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                                      title="Delete Delivery Zone"
                                    >
                                      Delete
                                    </button>
                                  ) : (
                                    <button disabled className="px-2.5 py-1.5 bg-slate-50 text-slate-300 text-xs font-semibold rounded-lg cursor-not-allowed opacity-60">
                                      Delete
                                    </button>
                                  )}
                                </div>
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

      {/* CREATE ZONE MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Create Delivery Zone</h3>
                <p className="text-xs text-slate-500 mt-0.5">Draw geographical boundary polygon and set delivery rates.</p>
              </div>
              <button onClick={() => setIsCreateModalOpen(false)} disabled={isSubmitting} className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1">✕</button>
            </div>

            <form onSubmit={handleCreateSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
              {modalError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium">
                  {modalError}
                </div>
              )}

              {/* Name & Code */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Zone Name <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Chandigarh Express Zone"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Zone Code <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                    placeholder="e.g. CHD-EXP"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 uppercase font-mono font-bold"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="e.g. Fast 30-45 mins delivery across central city sectors"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Boundary Map Drawer */}
              <DeliveryZoneMapEditor
                initialBoundary={formBoundary}
                color={formColor}
                onChange={handleBoundaryChange}
              />

              {/* Delivery Rates & Times Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Delivery Charge (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={formDeliveryFee}
                    onChange={(e) => setFormDeliveryFee(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Min. Order Amount (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={formMinOrderAmount}
                    onChange={(e) => setFormMinOrderAmount(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Est. Delivery Time</label>
                  <input
                    type="text"
                    required
                    value={formEstimatedTime}
                    onChange={(e) => setFormEstimatedTime(e.target.value)}
                    placeholder="e.g. 30-45 mins"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Priority & Color */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Zone Priority (1-10) <span className="text-slate-400 font-normal">(higher priority wins on overlap)</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={formPriority}
                    onChange={(e) => setFormPriority(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Zone Map Color</label>
                  <div className="flex items-center gap-2">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setFormColor(c)}
                        className={`w-6 h-6 rounded-full border-2 transition-transform ${
                          formColor === c ? 'scale-115 border-slate-900 shadow-xs' : 'border-transparent hover:scale-105'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Product Coverage Scope */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="block text-xs font-semibold text-slate-700">Product Scope</label>
                <div className="flex items-center gap-4 text-xs">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="createCoverageType"
                      checked={formCoverageType === 'all_products'}
                      onChange={() => setFormCoverageType('all_products')}
                      className="text-indigo-600"
                    />
                    <span>All Products in Catalog</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="createCoverageType"
                      checked={formCoverageType === 'specific_products'}
                      onChange={() => setFormCoverageType('specific_products')}
                      className="text-indigo-600"
                    />
                    <span>Specific Products Only ({formAssignedProducts.length})</span>
                  </label>
                </div>

                {formCoverageType === 'specific_products' && (
                  <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1 bg-slate-50">
                    {products.map((p) => (
                      <label key={p._id} className="flex items-center gap-2 p-1 hover:bg-white rounded text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formAssignedProducts.includes(p._id)}
                          onChange={() => toggleProductSelection(p._id)}
                          className="rounded text-indigo-600"
                        />
                        <span className="font-medium text-slate-800">{p.title}</span>
                        <span className="text-slate-400 text-[11px] ml-auto">₹{p.price}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Active Toggle */}
              <div className="pt-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                    className="rounded text-indigo-600"
                  />
                  <span>Active & Open for Delivery Orders</span>
                </label>
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-sm"
                >
                  {isSubmitting ? 'Creating Zone...' : 'Create Delivery Zone'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT ZONE MODAL */}
      {isEditModalOpen && currentZone && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Edit Delivery Zone</h3>
                <p className="text-xs text-slate-500 mt-0.5">Modify boundary vertices, delivery fee, or product rules.</p>
              </div>
              <button onClick={() => setIsEditModalOpen(false)} disabled={isSubmitting} className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1">✕</button>
            </div>

            <form onSubmit={handleEditSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
              {modalError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium">
                  {modalError}
                </div>
              )}

              {/* Name & Code */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Zone Name <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Zone Code <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 uppercase font-mono font-bold"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Boundary Map Drawer */}
              <DeliveryZoneMapEditor
                initialBoundary={formBoundary}
                color={formColor}
                onChange={handleBoundaryChange}
              />

              {/* Delivery Rates & Times Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Delivery Charge (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={formDeliveryFee}
                    onChange={(e) => setFormDeliveryFee(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Min. Order Amount (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={formMinOrderAmount}
                    onChange={(e) => setFormMinOrderAmount(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Est. Delivery Time</label>
                  <input
                    type="text"
                    required
                    value={formEstimatedTime}
                    onChange={(e) => setFormEstimatedTime(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Priority & Color */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Zone Priority (1-10)</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={formPriority}
                    onChange={(e) => setFormPriority(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Zone Map Color</label>
                  <div className="flex items-center gap-2">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setFormColor(c)}
                        className={`w-6 h-6 rounded-full border-2 transition-transform ${
                          formColor === c ? 'scale-115 border-slate-900 shadow-xs' : 'border-transparent hover:scale-105'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Product Coverage Scope */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="block text-xs font-semibold text-slate-700">Product Scope</label>
                <div className="flex items-center gap-4 text-xs">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="editCoverageType"
                      checked={formCoverageType === 'all_products'}
                      onChange={() => setFormCoverageType('all_products')}
                      className="text-indigo-600"
                    />
                    <span>All Products in Catalog</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="editCoverageType"
                      checked={formCoverageType === 'specific_products'}
                      onChange={() => setFormCoverageType('specific_products')}
                      className="text-indigo-600"
                    />
                    <span>Specific Products ({formAssignedProducts.length})</span>
                  </label>
                </div>

                {formCoverageType === 'specific_products' && (
                  <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1 bg-slate-50">
                    {products.map((p) => (
                      <label key={p._id} className="flex items-center gap-2 p-1 hover:bg-white rounded text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formAssignedProducts.includes(p._id)}
                          onChange={() => toggleProductSelection(p._id)}
                          className="rounded text-indigo-600"
                        />
                        <span className="font-medium text-slate-800">{p.title}</span>
                        <span className="text-slate-400 text-[11px] ml-auto">₹{p.price}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Active Toggle */}
              <div className="pt-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                    className="rounded text-indigo-600"
                  />
                  <span>Active & Open for Delivery Orders</span>
                </label>
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-sm"
                >
                  {isSubmitting ? 'Saving Changes...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {isDeleteModalOpen && currentZone && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto text-xl font-bold">
              🗑️
            </div>
            <div className="text-center">
              <h3 className="text-base font-bold text-slate-900">Delete Delivery Zone?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to delete <strong className="text-slate-800">{currentZone.name}</strong> ({currentZone.code})? Customers in this region will no longer be serviceable.
              </p>
            </div>

            {modalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs">
                {modalError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={isSubmitting}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteSubmit}
                disabled={isSubmitting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl"
              >
                {isSubmitting ? 'Deleting...' : 'Delete Zone'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
