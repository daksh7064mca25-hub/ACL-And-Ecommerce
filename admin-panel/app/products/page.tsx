'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { getToken, getAdmin, clearAuth, AdminUser, hasPermission } from '@/lib/auth';
import {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  ProductItem,
} from '@/lib/api';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function ProductsPage() {
  const router = useRouter();

  // Lifecycle & Auth State
  const [mounted, setMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [admin, setAdmin] = useState<AdminUser | null>(null);
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

  // Active Item for Edit/Delete
  const [currentProduct, setCurrentProduct] = useState<ProductItem | null>(null);

  // Form Fields for Create / Edit
  const [formTitle, setFormTitle] = useState('');
  const [formPrice, setFormPrice] = useState<string | number>('');
  const [formQuantity, setFormQuantity] = useState<string | number>('');
  const [formExistingImages, setFormExistingImages] = useState<string[]>([]);
  const [formNewFiles, setFormNewFiles] = useState<File[]>([]);
  const [formNewPreviews, setFormNewPreviews] = useState<string[]>([]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // ACL Capabilities (mounted ensures SSR matching)
  const canCreate = mounted && hasPermission('products:create');
  const canUpdate = mounted && hasPermission('products:update');
  const canDelete = mounted && hasPermission('products:delete');

  // Load products list
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

    if (!hasPermission('products:read')) {
      setIsAccessDenied(true);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await getProducts(undefined, token);

      if (res.status === 401) {
        clearAuth();
        router.replace('/login');
        return;
      }

      if (res.status === 403) {
        setIsAccessDenied(true);
        setIsLoading(false);
        return;
      }

      if (res.success && res.products) {
        setProducts(res.products);
      } else {
        setErrorMessage(res.message || 'Failed to fetch products.');
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

  // Clean up object URLs on preview change
  useEffect(() => {
    return () => {
      formNewPreviews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [formNewPreviews]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const term = searchTerm.toLowerCase();
      return p.title.toLowerCase().includes(term);
    });
  }, [products, searchTerm]);

  // Inventory Metrics
  const totalStockCount = useMemo(() => products.reduce((acc, p) => acc + (p.quantity || 0), 0), [products]);
  const totalInventoryValue = useMemo(
    () => products.reduce((acc, p) => acc + (p.price || 0) * (p.quantity || 0), 0),
    [products]
  );
  const outOfStockCount = useMemo(() => products.filter((p) => (p.quantity || 0) <= 0).length, [products]);

  // Handle New File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const filesArray = Array.from(e.target.files);

    const validFiles: File[] = [];
    const validPreviews: string[] = [];

    filesArray.forEach((file) => {
      if (file.type.startsWith('image/')) {
        validFiles.push(file);
        validPreviews.push(URL.createObjectURL(file));
      }
    });

    setFormNewFiles((prev) => [...prev, ...validFiles]);
    setFormNewPreviews((prev) => [...prev, ...validPreviews]);

    // Reset input so re-selecting same file triggers onChange
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeNewFile = (index: number) => {
    URL.revokeObjectURL(formNewPreviews[index]);
    setFormNewFiles((prev) => prev.filter((_, i) => i !== index));
    setFormNewPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const removeExistingImage = (imagePath: string) => {
    setFormExistingImages((prev) => prev.filter((img) => img !== imagePath));
  };

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setFormTitle('');
    setFormPrice('');
    setFormQuantity('');
    setFormExistingImages([]);
    setFormNewFiles([]);
    setFormNewPreviews([]);
    setModalError(null);
    setIsCreateModalOpen(true);
  };

  // Submit Create Product
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setModalError('Product title is required.');
      return;
    }
    if (formPrice === '' || Number(formPrice) < 0) {
      setModalError('Product price must be a valid non-negative number.');
      return;
    }
    if (formQuantity === '' || Number(formQuantity) < 0 || !Number.isInteger(Number(formQuantity))) {
      setModalError('Product quantity must be a non-negative integer.');
      return;
    }

    setIsSubmitting(true);
    setModalError(null);

    const formData = new FormData();
    formData.append('title', formTitle.trim());
    formData.append('price', String(Number(formPrice)));
    formData.append('quantity', String(Number(formQuantity)));

    formNewFiles.forEach((file) => {
      formData.append('images', file);
    });

    const token = getToken();
    const res = await createProduct(formData, token || undefined);

    setIsSubmitting(false);

    if (res.success && res.product) {
      setProducts((prev) => [res.product!, ...prev]);
      setIsCreateModalOpen(false);
      setSuccessMessage(res.message || 'Product created successfully.');
      setTimeout(() => setSuccessMessage(null), 5000);
    } else {
      setModalError(res.message || 'Failed to create product.');
    }
  };

  // Open Edit Modal
  const handleOpenEditModal = (product: ProductItem) => {
    setCurrentProduct(product);
    setFormTitle(product.title);
    setFormPrice(product.price);
    setFormQuantity(product.quantity);
    setFormExistingImages(product.images || []);
    setFormNewFiles([]);
    setFormNewPreviews([]);
    setModalError(null);
    setIsEditModalOpen(true);
  };

  // Submit Edit Product
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProduct) return;

    if (!formTitle.trim()) {
      setModalError('Product title cannot be empty.');
      return;
    }
    if (formPrice === '' || Number(formPrice) < 0) {
      setModalError('Product price must be a valid non-negative number.');
      return;
    }
    if (formQuantity === '' || Number(formQuantity) < 0 || !Number.isInteger(Number(formQuantity))) {
      setModalError('Product quantity must be a non-negative integer.');
      return;
    }

    setIsSubmitting(true);
    setModalError(null);

    const formData = new FormData();
    formData.append('title', formTitle.trim());
    formData.append('price', String(Number(formPrice)));
    formData.append('quantity', String(Number(formQuantity)));
    formData.append('existingImages', JSON.stringify(formExistingImages));

    formNewFiles.forEach((file) => {
      formData.append('images', file);
    });

    const token = getToken();
    const res = await updateProduct(currentProduct._id, formData, token || undefined);

    setIsSubmitting(false);

    if (res.success && res.product) {
      setProducts((prev) => prev.map((p) => (p._id === currentProduct._id ? res.product! : p)));
      setIsEditModalOpen(false);
      setSuccessMessage(res.message || 'Product updated successfully.');
      setTimeout(() => setSuccessMessage(null), 5000);
    } else {
      setModalError(res.message || 'Failed to update product.');
    }
  };

  // Open Delete Modal
  const handleOpenDeleteModal = (product: ProductItem) => {
    setCurrentProduct(product);
    setModalError(null);
    setIsDeleteModalOpen(true);
  };

  // Submit Delete Product
  const handleDeleteSubmit = async () => {
    if (!currentProduct) return;

    setIsSubmitting(true);
    setModalError(null);

    const token = getToken();
    const res = await deleteProduct(currentProduct._id, token || undefined);

    setIsSubmitting(false);

    if (res.success) {
      setProducts((prev) => prev.filter((p) => p._id !== currentProduct._id));
      setIsDeleteModalOpen(false);
      setSuccessMessage(res.message || 'Product deleted successfully.');
      setTimeout(() => setSuccessMessage(null), 5000);
    } else {
      setModalError(res.message || 'Failed to delete product.');
    }
  };

  // Helper to format Image URL
  const formatImageUrl = (imgPath: string) => {
    if (!imgPath) return '';
    if (imgPath.startsWith('http://') || imgPath.startsWith('https://')) {
      return imgPath;
    }
    return `${API_BASE_URL}${imgPath.startsWith('/') ? imgPath : `/${imgPath}`}`;
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header admin={admin} title="Products & Inventory" />

        <main className="flex-1 p-8 overflow-y-auto max-w-7xl w-full mx-auto space-y-6">
          {/* Header Banner */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  Inventory Management
                </span>
                <span className="text-xs text-slate-500">• ACL Permission: products:read</span>
              </div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Product Catalog</h2>
              <p className="text-xs text-slate-500 mt-1">
                Manage your product lineup, update pricing and inventory stock, and manage product image galleries.
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
                  <span>Add Product</span>
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
                  You do not have the required ACL permission (<code className="bg-rose-50 text-rose-700 px-1 py-0.5 rounded font-mono">products:read</code>) to view the product catalog.
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
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Products</p>
                    <p className="text-2xl font-bold text-slate-900 mt-0.5">{products.length}</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm">
                    📦
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Units</p>
                    <p className="text-2xl font-bold text-emerald-600 mt-0.5">{totalStockCount}</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-sm">
                    📊
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Inventory Value</p>
                    <p className="text-2xl font-bold text-slate-800 mt-0.5">
                      ${totalInventoryValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm">
                    💰
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Out of Stock</p>
                    <p className={`text-2xl font-bold mt-0.5 ${outOfStockCount > 0 ? 'text-rose-600' : 'text-slate-700'}`}>
                      {outOfStockCount}
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-sm">
                    ⚠️
                  </div>
                </div>
              </div>

              {/* Success Banner */}
              {successMessage && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center justify-between shadow-xs animate-fadeIn">
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
                    placeholder="Search products by title..."
                    className="block w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div className="text-xs text-slate-500">
                  Showing <span className="font-semibold text-slate-800">{filteredProducts.length}</span> of{' '}
                  <span className="font-semibold text-slate-800">{products.length}</span> products
                </div>
              </div>

              {/* Products Table */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                {isLoading ? (
                  <div className="p-12 flex flex-col items-center justify-center gap-3">
                    <div className="w-8 h-8 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin" />
                    <p className="text-xs text-slate-500 font-medium">Loading products catalog...</p>
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div className="p-12 text-center">
                    <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                    </div>
                    <h4 className="text-sm font-semibold text-slate-800">No Products Found</h4>
                    <p className="text-xs text-slate-500 mt-1">
                      {searchTerm ? `No products match "${searchTerm}".` : 'There are currently no products in the catalog.'}
                    </p>
                    {searchTerm ? (
                      <button
                        onClick={() => setSearchTerm('')}
                        className="mt-3 text-xs text-indigo-600 font-semibold hover:underline cursor-pointer"
                      >
                        Clear search filter
                      </button>
                    ) : canCreate ? (
                      <button
                        onClick={handleOpenCreateModal}
                        className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                      >
                        + Add First Product
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                          <th className="py-3.5 px-4">Product Details</th>
                          <th className="py-3.5 px-4">Price</th>
                          <th className="py-3.5 px-4">Inventory Stock</th>
                          <th className="py-3.5 px-4">Images</th>
                          <th className="py-3.5 px-4">Added On</th>
                          <th className="py-3.5 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                        {filteredProducts.map((product) => {
                          const hasImages = product.images && product.images.length > 0;
                          const primaryImage = hasImages ? formatImageUrl(product.images[0]) : null;

                          return (
                            <tr key={product._id} className="hover:bg-slate-50/80 transition-colors">
                              {/* Product Thumbnail & Title */}
                              <td className="py-3.5 px-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-12 h-12 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center relative">
                                    {primaryImage ? (
                                      <Image
                                        src={primaryImage}
                                        alt={product.title}
                                        fill
                                        unoptimized
                                        className="object-cover"
                                      />
                                    ) : (
                                      <span className="text-slate-400 text-lg">📦</span>
                                    )}
                                  </div>
                                  <div>
                                    <p className="font-semibold text-slate-900 text-sm leading-tight">{product.title}</p>
                                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">ID: {product._id.slice(-6)}</p>
                                  </div>
                                </div>
                              </td>

                              {/* Price */}
                              <td className="py-3.5 px-4">
                                <span className="font-semibold text-slate-900 text-xs">
                                  ${product.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              </td>

                              {/* Stock Quantity Status */}
                              <td className="py-3.5 px-4">
                                {product.quantity <= 0 ? (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                                    Out of Stock (0)
                                  </span>
                                ) : product.quantity < 5 ? (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                    Low Stock ({product.quantity})
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                    In Stock ({product.quantity})
                                  </span>
                                )}
                              </td>

                              {/* Images Count & Thumbnails */}
                              <td className="py-3.5 px-4">
                                <div className="flex items-center gap-1">
                                  <span className="text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                    {product.images?.length || 0} image(s)
                                  </span>
                                  {product.images && product.images.length > 1 && (
                                    <div className="flex -space-x-2 overflow-hidden ml-1">
                                      {product.images.slice(1, 4).map((img, idx) => (
                                        <div
                                          key={idx}
                                          className="inline-block h-6 w-6 rounded-full ring-2 ring-white overflow-hidden bg-slate-100 relative"
                                        >
                                          <Image
                                            src={formatImageUrl(img)}
                                            alt={`Img ${idx + 2}`}
                                            fill
                                            unoptimized
                                            className="object-cover"
                                          />
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </td>

                              {/* Created Date */}
                              <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                                {product.createdAt
                                  ? new Date(product.createdAt).toLocaleDateString('en-US', {
                                      year: 'numeric',
                                      month: 'short',
                                      day: 'numeric',
                                    })
                                  : 'N/A'}
                              </td>

                              {/* Actions */}
                              <td className="py-3.5 px-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  {canUpdate ? (
                                    <button
                                      onClick={() => handleOpenEditModal(product)}
                                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                                      title="Edit Product"
                                    >
                                      Edit
                                    </button>
                                  ) : (
                                    <button
                                      disabled
                                      className="px-2.5 py-1.5 bg-slate-50 text-slate-400 text-xs font-semibold rounded-lg cursor-not-allowed opacity-60"
                                      title="Requires ACL permission: products:update"
                                    >
                                      Edit
                                    </button>
                                  )}

                                  {canDelete ? (
                                    <button
                                      onClick={() => handleOpenDeleteModal(product)}
                                      className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                                      title="Delete Product"
                                    >
                                      Delete
                                    </button>
                                  ) : (
                                    <button
                                      disabled
                                      className="px-2.5 py-1.5 bg-slate-50 text-slate-300 text-xs font-semibold rounded-lg cursor-not-allowed opacity-60"
                                      title="Requires ACL permission: products:delete"
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

      {/* CREATE PRODUCT MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Add New Product</h3>
                <p className="text-xs text-slate-500 mt-0.5">Enter product specifications and upload gallery images.</p>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                disabled={isSubmitting}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleCreateSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
              {modalError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                  <span className="font-bold">Error:</span>
                  <span>{modalError}</span>
                </div>
              )}

              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Product Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Wireless Noise-Cancelling Headphones"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              {/* Price & Quantity Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Price ($) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    placeholder="e.g. 199.99"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Inventory Stock Units <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={formQuantity}
                    onChange={(e) => setFormQuantity(e.target.value)}
                    placeholder="e.g. 25"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Image Upload Zone */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Product Images <span className="text-slate-400 font-normal">(JPEG, PNG, WEBP, GIF up to 10 files)</span>
                </label>

                {/* Upload Button Box */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 hover:border-indigo-400 bg-slate-50 rounded-xl p-4 text-center cursor-pointer transition-colors"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-1.5 text-sm font-bold">
                    📁
                  </div>
                  <p className="text-xs font-semibold text-slate-700">Click to browse and upload product images</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Supports multiple image upload via Multer</p>
                </div>

                {/* Previews Grid */}
                {formNewPreviews.length > 0 && (
                  <div className="mt-3">
                    <p className="text-[11px] font-semibold text-slate-600 mb-1.5">
                      Selected Images ({formNewPreviews.length})
                    </p>
                    <div className="grid grid-cols-4 gap-2.5 max-h-44 overflow-y-auto p-1">
                      {formNewPreviews.map((url, idx) => (
                        <div
                          key={idx}
                          className="relative group rounded-lg overflow-hidden border border-slate-200 bg-slate-100 aspect-square"
                        >
                          <Image
                            src={url}
                            alt={`Preview ${idx + 1}`}
                            fill
                            unoptimized
                            className="object-cover"
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeNewFile(idx);
                            }}
                            className="absolute top-1 right-1 bg-rose-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold shadow-md opacity-90 hover:opacity-100 cursor-pointer"
                            title="Remove image"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
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
                      <span>Creating Product...</span>
                    </>
                  ) : (
                    <span>Create Product</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT PRODUCT MODAL */}
      {isEditModalOpen && currentProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Edit Product</h3>
                <p className="text-xs text-slate-500 mt-0.5">Modify product details, manage existing images, or add new photos.</p>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                disabled={isSubmitting}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleEditSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
              {modalError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                  <span className="font-bold">Error:</span>
                  <span>{modalError}</span>
                </div>
              )}

              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Product Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              {/* Price & Quantity */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Price ($) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Inventory Stock Units <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={formQuantity}
                    onChange={(e) => setFormQuantity(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Existing Images Gallery */}
              {formExistingImages.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Current Product Images ({formExistingImages.length})
                  </label>
                  <div className="grid grid-cols-4 gap-2.5 max-h-36 overflow-y-auto p-1 bg-slate-50 rounded-xl border border-slate-200">
                    {formExistingImages.map((imgPath, idx) => (
                      <div
                        key={idx}
                        className="relative group rounded-lg overflow-hidden border border-slate-200 bg-white aspect-square"
                      >
                        <Image
                          src={formatImageUrl(imgPath)}
                          alt={`Existing ${idx + 1}`}
                          fill
                          unoptimized
                          className="object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removeExistingImage(imgPath)}
                          className="absolute top-1 right-1 bg-rose-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold shadow-md opacity-90 hover:opacity-100 cursor-pointer"
                          title="Remove image"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add More Images */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Add Additional Images
                </label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 hover:border-indigo-400 bg-slate-50 rounded-xl p-3 text-center cursor-pointer transition-colors"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <p className="text-xs font-semibold text-slate-700">+ Click to select additional photos</p>
                </div>

                {/* New Previews */}
                {formNewPreviews.length > 0 && (
                  <div className="mt-2">
                    <p className="text-[11px] font-semibold text-indigo-700 mb-1">
                      New Images To Upload ({formNewPreviews.length})
                    </p>
                    <div className="grid grid-cols-4 gap-2.5 max-h-36 overflow-y-auto p-1">
                      {formNewPreviews.map((url, idx) => (
                        <div
                          key={idx}
                          className="relative group rounded-lg overflow-hidden border border-indigo-200 bg-slate-100 aspect-square"
                        >
                          <Image
                            src={url}
                            alt={`New Preview ${idx + 1}`}
                            fill
                            unoptimized
                            className="object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => removeNewFile(idx)}
                            className="absolute top-1 right-1 bg-rose-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold shadow-md opacity-90 hover:opacity-100 cursor-pointer"
                            title="Remove new image"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
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
      {isDeleteModalOpen && currentProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-xl overflow-hidden p-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto text-xl font-bold">
              🗑️
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900">Delete Product</h3>
              <p className="text-xs text-slate-500">
                Are you sure you want to delete product{' '}
                <span className="font-semibold text-slate-800">&quot;{currentProduct.title}&quot;</span>?
              </p>
            </div>

            {modalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                <span className="font-bold">Error:</span>
                <span>{modalError}</span>
              </div>
            )}

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-500 space-y-1">
              <p className="font-semibold text-slate-700">Notice:</p>
              <p>This action will permanently remove the product and clean up all associated image files from the server.</p>
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
                  <span>Delete Product</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
