'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { getToken, getAdmin, clearAuth, AdminUser, hasPermission } from '@/lib/auth';
import {
  getRoles,
  getPermissions,
  createRole,
  updateRole,
  deleteRole,
  RoleItem,
  PermissionItem,
} from '@/lib/api';

export default function RolesPage() {
  const router = useRouter();

  // Page state
  const [mounted, setMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [availablePermissions, setAvailablePermissions] = useState<PermissionItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAccessDenied, setIsAccessDenied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Active form data
  const [currentRole, setCurrentRole] = useState<RoleItem | null>(null);
  const [formRoleName, setFormRoleName] = useState('');
  const [formDisplayName, setFormDisplayName] = useState('');
  const [formSelectedPermissions, setFormSelectedPermissions] = useState<string[]>([]);

  // Permissions state for the active user (guarded with mounted to prevent hydration mismatch)
  const canCreate = mounted && hasPermission('roles:create');
  const canUpdate = mounted && hasPermission('roles:update');
  const canDelete = mounted && hasPermission('roles:delete');

  // Load initial data
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

    if (!hasPermission('roles:read')) {
      setIsAccessDenied(true);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [rolesRes, permsRes] = await Promise.all([getRoles(token), getPermissions(token)]);

      if (rolesRes.status === 401 || permsRes.status === 401) {
        clearAuth();
        router.replace('/login');
        return;
      }

      if (rolesRes.status === 403 || permsRes.status === 403) {
        setIsAccessDenied(true);
        setIsLoading(false);
        return;
      }

      if (rolesRes.success && rolesRes.roles) {
        setRoles(rolesRes.roles);
      } else {
        setErrorMessage(rolesRes.message || 'Failed to fetch roles.');
      }

      if (permsRes.success && permsRes.permissions) {
        setAvailablePermissions(permsRes.permissions);
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

  // Filtered roles list
  const filteredRoles = useMemo(() => {
    return roles.filter((role) => {
      const term = searchTerm.toLowerCase();
      const matchName = role.name.toLowerCase().includes(term);
      const matchDisplay = role.display?.toLowerCase().includes(term);
      return matchName || matchDisplay;
    });
  }, [roles, searchTerm]);

  // Statistics
  const systemRolesCount = useMemo(() => roles.filter((r) => r.isSystemRole).length, [roles]);
  const customRolesCount = roles.length - systemRolesCount;

  // Handlers for Create Modal
  const handleOpenCreateModal = () => {
    setFormRoleName('');
    setFormDisplayName('');
    setFormSelectedPermissions([]);
    setModalError(null);
    setIsCreateModalOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formRoleName.trim()) {
      setModalError('Role name is required.');
      return;
    }

    setIsSubmitting(true);
    setModalError(null);

    const token = getToken();
    const res = await createRole(
      {
        name: formRoleName.trim(),
        display: formDisplayName.trim() || formRoleName.trim(),
        permissions: formSelectedPermissions,
      },
      token || undefined
    );

    setIsSubmitting(false);

    if (res.success && res.role) {
      setRoles((prev) => [...prev, res.role!]);
      setIsCreateModalOpen(false);
      setSuccessMessage(res.message || 'Role created successfully.');
      setTimeout(() => setSuccessMessage(null), 5000);
    } else {
      setModalError(res.message || 'Failed to create role.');
    }
  };

  // Handlers for Edit Modal
  const handleOpenEditModal = (role: RoleItem) => {
    setCurrentRole(role);
    setFormRoleName(role.name);
    setFormDisplayName(role.display || role.name);
    const existingPermIds = role.permissions.map((p) => p._id);
    setFormSelectedPermissions(existingPermIds);
    setModalError(null);
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentRole) return;
    if (!formRoleName.trim()) {
      setModalError('Role name is required.');
      return;
    }

    setIsSubmitting(true);
    setModalError(null);

    const token = getToken();
    const res = await updateRole(
      currentRole._id,
      {
        name: currentRole.isSystemRole ? currentRole.name : formRoleName.trim(),
        display: formDisplayName.trim() || formRoleName.trim(),
        permissions: formSelectedPermissions,
      },
      token || undefined
    );

    setIsSubmitting(false);

    if (res.success && res.role) {
      setRoles((prev) => prev.map((r) => (r._id === currentRole._id ? res.role! : r)));
      setIsEditModalOpen(false);
      setSuccessMessage(res.message || 'Role updated successfully.');
      setTimeout(() => setSuccessMessage(null), 5000);
    } else {
      setModalError(res.message || 'Failed to update role.');
    }
  };

  // Handlers for Delete Modal
  const handleOpenDeleteModal = (role: RoleItem) => {
    setCurrentRole(role);
    setModalError(null);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteSubmit = async () => {
    if (!currentRole) return;

    setIsSubmitting(true);
    setModalError(null);

    const token = getToken();
    const res = await deleteRole(currentRole._id, token || undefined);

    setIsSubmitting(false);

    if (res.success) {
      setRoles((prev) => prev.filter((r) => r._id !== currentRole._id));
      setIsDeleteModalOpen(false);
      setSuccessMessage(res.message || 'Role deleted successfully.');
      setTimeout(() => setSuccessMessage(null), 5000);
    } else {
      setModalError(res.message || 'Failed to delete role.');
    }
  };

  // Permission selection toggle helpers
  const togglePermission = (permId: string) => {
    setFormSelectedPermissions((prev) =>
      prev.includes(permId) ? prev.filter((id) => id !== permId) : [...prev, permId]
    );
  };

  const selectAllPermissions = () => {
    setFormSelectedPermissions(availablePermissions.map((p) => p._id));
  };

  const deselectAllPermissions = () => {
    setFormSelectedPermissions([]);
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header admin={admin} title="Role & Permission Management" />

        <main className="flex-1 p-8 overflow-y-auto max-w-7xl w-full mx-auto space-y-6">
          {/* Header Banner */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full border border-indigo-200">
                  ACL Security Module
                </span>
                <span className="text-xs text-slate-500">• ACL Permission: roles:read</span>
              </div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">System Roles & ACL Permissions</h2>
              <p className="text-xs text-slate-500 mt-1">
                Manage roles, inspect active permissions, and safely assign access privileges to staff and users.
              </p>
            </div>

            {canCreate && (
              <div className="flex items-center gap-3">
                <button
                  onClick={handleOpenCreateModal}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-sm shadow-indigo-500/20 transition-colors cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Create New Role</span>
                </button>
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
                  You do not have the required ACL permission (<code className="bg-rose-50 text-rose-700 px-1 py-0.5 rounded font-mono">roles:read</code>) to view role configurations.
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
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Roles</p>
                    <p className="text-2xl font-bold text-slate-900 mt-0.5">{roles.length}</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm">
                    🛡️
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">System Roles</p>
                    <p className="text-2xl font-bold text-slate-800 mt-0.5">{systemRolesCount}</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-sm">
                    🔒
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Custom Roles</p>
                    <p className="text-2xl font-bold text-emerald-600 mt-0.5">{customRolesCount}</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-sm">
                    ✨
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">System Permissions</p>
                    <p className="text-2xl font-bold text-amber-600 mt-0.5">{availablePermissions.length}</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-sm">
                    🔑
                  </div>
                </div>
              </div>

              {/* Success Alert Banner */}
              {successMessage && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center justify-between shadow-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-600 font-bold">✓</span>
                    <span>{successMessage}</span>
                  </div>
                  <button
                    onClick={() => setSuccessMessage(null)}
                    className="text-emerald-700 hover:text-emerald-900 font-bold text-sm cursor-pointer"
                  >
                    ×
                  </button>
                </div>
              )}

              {/* Error Message */}
              {errorMessage && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center justify-between shadow-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">Error:</span>
                    <span>{errorMessage}</span>
                  </div>
                  <button
                    onClick={loadData}
                    className="px-3 py-1 bg-rose-600 text-white rounded-lg text-xs font-medium hover:bg-rose-700 transition-colors cursor-pointer"
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* Search Bar */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
                    placeholder="Search roles by name or display label..."
                    className="block w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div className="text-xs text-slate-500">
                  Showing <span className="font-semibold text-slate-800">{filteredRoles.length}</span> of{' '}
                  <span className="font-semibold text-slate-800">{roles.length}</span> roles
                </div>
              </div>

              {/* Roles Table */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                {isLoading ? (
                  <div className="p-12 flex flex-col items-center justify-center gap-3">
                    <div className="w-8 h-8 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin" />
                    <p className="text-xs text-slate-500 font-medium">Loading system roles & permissions...</p>
                  </div>
                ) : filteredRoles.length === 0 ? (
                  <div className="p-12 text-center">
                    <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    </div>
                    <h4 className="text-sm font-semibold text-slate-800">No Roles Found</h4>
                    <p className="text-xs text-slate-500 mt-1">
                      {searchTerm ? `No roles match "${searchTerm}".` : 'No roles currently exist.'}
                    </p>
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm('')}
                        className="mt-3 text-xs text-indigo-600 font-semibold hover:underline cursor-pointer"
                      >
                        Clear search filter
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                          <th className="py-3.5 px-4">Role Identifier & Display</th>
                          <th className="py-3.5 px-4">Type</th>
                          <th className="py-3.5 px-4">Assigned Permissions</th>
                          <th className="py-3.5 px-4">Active Users</th>
                          <th className="py-3.5 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                        {filteredRoles.map((role) => {
                          const isDeletable = !role.isSystemRole && (role.userCount || 0) === 0;

                          return (
                            <tr key={role._id} className="hover:bg-slate-50/80 transition-colors">
                              {/* Role & Display */}
                              <td className="py-4 px-4">
                                <div className="flex items-center gap-3">
                                  <div
                                    className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold shrink-0 text-xs shadow-xs ${
                                      role.name === 'Admin'
                                        ? 'bg-purple-100 text-purple-700 border border-purple-200'
                                        : role.isSystemRole
                                        ? 'bg-slate-100 text-slate-700 border border-slate-200'
                                        : 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                                    }`}
                                  >
                                    {role.name.charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <p className="font-semibold text-slate-900 text-sm">{role.display || role.name}</p>
                                    </div>
                                    <p className="text-[11px] text-slate-400 font-mono">Key: {role.name}</p>
                                  </div>
                                </div>
                              </td>

                              {/* Type Badge */}
                              <td className="py-4 px-4">
                                {role.isSystemRole ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                    <span>🔒</span> System
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <span>✨</span> Custom
                                  </span>
                                )}
                              </td>

                              {/* Permissions Pills */}
                              <td className="py-4 px-4 max-w-md">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-[11px] font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                    {role.permissions?.length || 0} perm(s)
                                  </span>
                                  {role.permissions?.slice(0, 3).map((p) => (
                                    <span
                                      key={p._id || p.name}
                                      className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-50 text-indigo-700 border border-indigo-100"
                                      title={p.description || p.name}
                                    >
                                      {p.name}
                                    </span>
                                  ))}
                                  {role.permissions && role.permissions.length > 3 && (
                                    <span
                                      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200 cursor-help"
                                      title={role.permissions
                                        .slice(3)
                                        .map((p) => p.name)
                                        .join(', ')}
                                    >
                                      +{role.permissions.length - 3} more
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Active Users */}
                              <td className="py-4 px-4">
                                <span
                                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                    (role.userCount || 0) > 0
                                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                      : 'bg-slate-100 text-slate-500'
                                  }`}
                                >
                                  {role.userCount || 0} user(s)
                                </span>
                              </td>

                              {/* Actions */}
                              <td className="py-4 px-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  {canUpdate ? (
                                    <button
                                      onClick={() => handleOpenEditModal(role)}
                                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                                      title="Edit Role & Permissions"
                                    >
                                      Edit
                                    </button>
                                  ) : (
                                    <button
                                      disabled
                                      className="px-2.5 py-1.5 bg-slate-50 text-slate-400 text-xs font-semibold rounded-lg cursor-not-allowed opacity-60"
                                      title="Requires ACL permission: roles:update"
                                    >
                                      Edit
                                    </button>
                                  )}

                                  {canDelete ? (
                                    <button
                                      onClick={() => handleOpenDeleteModal(role)}
                                      disabled={!isDeletable}
                                      className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                                        isDeletable
                                          ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 cursor-pointer'
                                          : 'bg-slate-50 text-slate-300 cursor-not-allowed'
                                      }`}
                                      title={
                                        role.isSystemRole
                                          ? 'System roles cannot be deleted'
                                          : (role.userCount || 0) > 0
                                          ? 'Cannot delete role while active users are assigned'
                                          : 'Delete Role'
                                      }
                                    >
                                      Delete
                                    </button>
                                  ) : (
                                    <button
                                      disabled
                                      className="px-2.5 py-1.5 bg-slate-50 text-slate-300 text-xs font-semibold rounded-lg cursor-not-allowed opacity-60"
                                      title="Requires ACL permission: roles:delete"
                                    >
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

      {/* CREATE ROLE MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Create New Role</h3>
                <p className="text-xs text-slate-500 mt-0.5">Define a custom role and assign granular ACL permissions.</p>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                disabled={isSubmitting}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleCreateSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
              {modalError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                  <span className="font-bold">Error:</span>
                  <span>{modalError}</span>
                </div>
              )}

              {/* Role Identifiers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Role Key / Identifier <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formRoleName}
                    onChange={(e) => setFormRoleName(e.target.value)}
                    placeholder="e.g. Manager"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Unique identifier used internally.</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Display Label <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={formDisplayName}
                    onChange={(e) => setFormDisplayName(e.target.value)}
                    placeholder="e.g. Operations Manager"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Human-friendly name shown in UI.</p>
                </div>
              </div>

              {/* Permissions Checklist */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-800">
                      Assign ACL Permissions ({formSelectedPermissions.length} selected)
                    </label>
                    <p className="text-[11px] text-slate-400">Select the actions allowed for this role.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={selectAllPermissions}
                      className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                    >
                      Select All
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={deselectAllPermissions}
                      className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 hover:underline cursor-pointer"
                    >
                      Deselect All
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-slate-50 p-3.5 rounded-xl border border-slate-200 max-h-60 overflow-y-auto">
                  {availablePermissions.map((perm) => {
                    const isChecked = formSelectedPermissions.includes(perm._id);
                    return (
                      <label
                        key={perm._id}
                        className={`flex items-start gap-2.5 p-2.5 rounded-lg border transition-all cursor-pointer select-none ${
                          isChecked
                            ? 'bg-indigo-50/60 border-indigo-200 text-slate-900'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100/60'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => togglePermission(perm._id)}
                          className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-900 leading-tight">
                            {perm.display || perm.name}
                          </p>
                          <p className="text-[10px] text-slate-500 font-mono leading-tight mt-0.5">{perm.name}</p>
                          {perm.description && (
                            <p className="text-[10px] text-slate-400 mt-1 leading-snug">{perm.description}</p>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-sm shadow-indigo-500/20 transition-colors cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      <span>Creating Role...</span>
                    </>
                  ) : (
                    <span>Create Role</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT ROLE MODAL */}
      {isEditModalOpen && currentRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Edit Role: <span className="text-indigo-600">{currentRole.display || currentRole.name}</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Update role details and reconfigure assigned permissions.
                </p>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                disabled={isSubmitting}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleEditSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
              {modalError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                  <span className="font-bold">Error:</span>
                  <span>{modalError}</span>
                </div>
              )}

              {/* Role Identifiers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Role Key / Identifier
                  </label>
                  <input
                    type="text"
                    required
                    disabled={currentRole.isSystemRole}
                    value={formRoleName}
                    onChange={(e) => setFormRoleName(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 disabled:bg-slate-100 disabled:text-slate-500 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  {currentRole.isSystemRole && (
                    <p className="text-[10px] text-amber-600 mt-1">System role identifiers cannot be renamed.</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Display Label
                  </label>
                  <input
                    type="text"
                    value={formDisplayName}
                    onChange={(e) => setFormDisplayName(e.target.value)}
                    placeholder="e.g. Operations Manager"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Human-friendly name shown in UI.</p>
                </div>
              </div>

              {/* Permissions Checklist */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-800">
                      Assigned ACL Permissions ({formSelectedPermissions.length} selected)
                    </label>
                    <p className="text-[11px] text-slate-400">Modify the permissions enabled for this role.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={selectAllPermissions}
                      className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                    >
                      Select All
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={deselectAllPermissions}
                      className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 hover:underline cursor-pointer"
                    >
                      Deselect All
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-slate-50 p-3.5 rounded-xl border border-slate-200 max-h-60 overflow-y-auto">
                  {availablePermissions.map((perm) => {
                    const isChecked = formSelectedPermissions.includes(perm._id);
                    return (
                      <label
                        key={perm._id}
                        className={`flex items-start gap-2.5 p-2.5 rounded-lg border transition-all cursor-pointer select-none ${
                          isChecked
                            ? 'bg-indigo-50/60 border-indigo-200 text-slate-900'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100/60'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => togglePermission(perm._id)}
                          className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-900 leading-tight">
                            {perm.display || perm.name}
                          </p>
                          <p className="text-[10px] text-slate-500 font-mono leading-tight mt-0.5">{perm.name}</p>
                          {perm.description && (
                            <p className="text-[10px] text-slate-400 mt-1 leading-snug">{perm.description}</p>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-sm shadow-indigo-500/20 transition-colors cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {isDeleteModalOpen && currentRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-xl overflow-hidden p-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto text-xl font-bold">
              🗑️
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900">Delete Custom Role</h3>
              <p className="text-xs text-slate-500">
                Are you sure you want to delete role{' '}
                <span className="font-semibold text-slate-800 font-mono">
                  &quot;{currentRole.display || currentRole.name}&quot;
                </span>
                ?
              </p>
            </div>

            {modalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                <span className="font-bold">Error:</span>
                <span>{modalError}</span>
              </div>
            )}

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-500 space-y-1">
              <p className="font-semibold text-slate-700">Safety Policy:</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>System roles (Admin, Customer, Rider, Staff) cannot be removed.</li>
                <li>Roles currently assigned to active users cannot be removed.</li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={isSubmitting}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteSubmit}
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-sm transition-colors cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete Role</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
