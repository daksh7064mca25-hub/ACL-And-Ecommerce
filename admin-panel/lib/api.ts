import { AdminUser, getToken, savePermissions } from './auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export interface LoginResponse {
  success: boolean;
  message: string;
  data?: {
    token: string;
    admin: AdminUser;
  };
}

export interface VerifyAuthResponse {
  success: boolean;
  message: string;
  status: number;
  data?: {
    admin: AdminUser;
  };
}

export interface PermissionsResponse {
  success: boolean;
  message?: string;
  role?: {
    name: string;
    display: string;
  };
  permissions?: string[];
}

export interface CustomerUser {
  _id: string;
  name: string;
  email: string;
  isEmailVerified: boolean;
  role: {
    _id?: string;
    name: string;
    display: string;
  };
  createdAt: string;
}

export interface PermissionItem {
  _id: string;
  name: string;
  display: string;
  description?: string;
}

export interface RoleItem {
  _id: string;
  name: string;
  display: string;
  permissions: PermissionItem[];
  isSystemRole?: boolean;
  userCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface GetRolesResponse {
  success: boolean;
  message?: string;
  roles?: RoleItem[];
  status?: number;
}

export interface GetPermissionsResponse {
  success: boolean;
  message?: string;
  permissions?: PermissionItem[];
  status?: number;
}

export interface CreateRolePayload {
  name: string;
  display?: string;
  permissions: string[];
}

export interface UpdateRolePayload {
  name?: string;
  display?: string;
  permissions?: string[];
}

export interface RoleMutationResponse {
  success: boolean;
  message: string;
  role?: RoleItem;
  status?: number;
}

export interface DeleteRoleResponse {
  success: boolean;
  message: string;
  status?: number;
}

export interface ProductLocation {
  type?: string;
  coordinates?: [number, number]; // [longitude, latitude]
  formattedAddress?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
}

export interface ProductItem {
  _id: string;
  title: string;
  price: number;
  quantity: number;
  images: string[];
  location?: ProductLocation;
  createdAt?: string;
  updatedAt?: string;
}

export interface GetProductsResponse {
  success: boolean;
  message?: string;
  count?: number;
  products?: ProductItem[];
  status?: number;
}

export interface GetProductResponse {
  success: boolean;
  message?: string;
  product?: ProductItem;
  status?: number;
}

export interface ProductMutationResponse {
  success: boolean;
  message: string;
  product?: ProductItem;
  status?: number;
}

export interface DeleteProductResponse {
  success: boolean;
  message: string;
  status?: number;
}

export interface GetCustomersResponse {
  success: boolean;
  message?: string;
  users?: CustomerUser[];
  status?: number;
}

export interface SendPromotionPayload {
  html: string;
  customerIds: string[];
  subject?: string;
}

export interface SendPromotionResponse {
  success: boolean;
  message: string;
  sentCount?: number;
  simulated?: boolean;
}

/**
 * Send Admin Login request to backend
 * POST /api/auth/admin/login
 */
export async function loginAdmin(credentials: {
  email: string;
  password: string;
}): Promise<LoginResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/admin/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        success: false,
        message: result?.message || `Login failed (Status: ${response.status})`,
      };
    }

    return result as LoginResponse;
  } catch (error) {
    return {
      success: false,
      message: 'Unable to connect to backend server. Please make sure the backend is running.',
    };
  }
}

/**
 * Verify Admin Authorization using JWT token
 * GET /api/admin/test
 */
export async function verifyAdminAuth(token: string): Promise<VerifyAuthResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/admin/test`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const result = await response.json().catch(() => null);

    return {
      success: response.ok,
      status: response.status,
      message: result?.message || (response.ok ? 'Authorized' : 'Unauthorized'),
      data: result?.data,
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      message: 'Unable to connect to the server to verify session.',
    };
  }
}

/**
 * Retrieve the current authenticated user's role and ACL permissions
 * GET /api/admin/me/permissions
 */

export async function getMyPermissions(authToken?: string): Promise<PermissionsResponse> {
  const token = authToken || getToken();
  if (!token) {
    return {
      success: false,
      message: 'Authentication token missing.',
    };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/admin/me/permissions`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        success: false,
        message: result?.message || `Failed to retrieve permissions (Status: ${response.status})`,
      };
    }

    // Cache permissions locally
    if (result?.permissions && Array.isArray(result.permissions)) {
      savePermissions(result.permissions);
    }

    return {
      success: true,
      role: result?.role,
      permissions: result?.permissions || [],
    };
  } catch (error) {
    return {
      success: false,
      message: 'Network error: Unable to retrieve permissions.',
    };
  }
}

/**
 * Retrieve all registered Customers (Requires ACL: users:read)
 * GET /api/admin/users
 */
export async function getCustomers(authToken?: string): Promise<GetCustomersResponse> {
  const token = authToken || getToken();
  if (!token) {
    return {
      success: false,
      status: 401,
      message: 'Authentication token missing. Please log in.',
    };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/admin/users`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        success: false,
        status: response.status,
        message: result?.message || `Failed to fetch users (Status: ${response.status})`,
      };
    }

    return {
      success: true,
      status: 200,
      users: result?.users || [],
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      message: 'Network error: Unable to connect to backend to fetch customers.',
    };
  }
}

/**
 * Send promotional HTML email to selected customers (Requires ACL: promotions:send)
 * POST /api/admin/promotions
 */
export async function sendPromotion(
  payload: SendPromotionPayload,
  authToken?: string
): Promise<SendPromotionResponse> {
  const token = authToken || getToken();
  if (!token) {
    return {
      success: false,
      message: 'Authentication token missing. Please log in.',
    };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/admin/promotions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        success: false,
        message: result?.message || `Failed to send promotion (Status: ${response.status})`,
      };
    }

    return {
      success: true,
      message: result?.message || 'Promotion dispatched successfully.',
      sentCount: result?.sentCount,
      simulated: result?.simulated,
    };
  } catch (error) {
    return {
      success: false,
      message: 'Network error: Unable to connect to backend server to send promotion.',
    };
  }
}

/**
 * Retrieve all roles with assigned permissions (Requires ACL: roles:read)
 * GET /api/admin/roles
 */
export async function getRoles(authToken?: string): Promise<GetRolesResponse> {
  const token = authToken || getToken();
  if (!token) {
    return {
      success: false,
      status: 401,
      message: 'Authentication token missing. Please log in.',
    };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/admin/roles`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        success: false,
        status: response.status,
        message: result?.message || `Failed to fetch roles (Status: ${response.status})`,
      };
    }

    return {
      success: true,
      status: 200,
      roles: result?.roles || [],
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      message: 'Network error: Unable to connect to backend to fetch roles.',
    };
  }
}

/**
 * Retrieve all available permissions (Requires ACL: roles:read)
 * GET /api/admin/permissions
 */
export async function getPermissions(authToken?: string): Promise<GetPermissionsResponse> {
  const token = authToken || getToken();
  if (!token) {
    return {
      success: false,
      status: 401,
      message: 'Authentication token missing. Please log in.',
    };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/admin/permissions`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        success: false,
        status: response.status,
        message: result?.message || `Failed to fetch permissions (Status: ${response.status})`,
      };
    }

    return {
      success: true,
      status: 200,
      permissions: result?.permissions || [],
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      message: 'Network error: Unable to connect to backend to fetch permissions.',
    };
  }
}

/**
 * Create a new custom role (Requires ACL: roles:create)
 * POST /api/admin/roles
 */
export async function createRole(
  payload: CreateRolePayload,
  authToken?: string
): Promise<RoleMutationResponse> {
  const token = authToken || getToken();
  if (!token) {
    return {
      success: false,
      status: 401,
      message: 'Authentication token missing. Please log in.',
    };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/admin/roles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        success: false,
        status: response.status,
        message: result?.message || `Failed to create role (Status: ${response.status})`,
      };
    }

    return {
      success: true,
      status: response.status,
      message: result?.message || 'Role created successfully.',
      role: result?.role,
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      message: 'Network error: Unable to connect to backend server to create role.',
    };
  }
}

/**
 * Update an existing role (Requires ACL: roles:update)
 * PUT /api/admin/roles/:id
 */
export async function updateRole(
  id: string,
  payload: UpdateRolePayload,
  authToken?: string
): Promise<RoleMutationResponse> {
  const token = authToken || getToken();
  if (!token) {
    return {
      success: false,
      status: 401,
      message: 'Authentication token missing. Please log in.',
    };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/admin/roles/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        success: false,
        status: response.status,
        message: result?.message || `Failed to update role (Status: ${response.status})`,
      };
    }

    return {
      success: true,
      status: response.status,
      message: result?.message || 'Role updated successfully.',
      role: result?.role,
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      message: 'Network error: Unable to connect to backend server to update role.',
    };
  }
}

/**
 * Delete a custom role (Requires ACL: roles:delete)
 * DELETE /api/admin/roles/:id
 */
export async function deleteRole(id: string, authToken?: string): Promise<DeleteRoleResponse> {
  const token = authToken || getToken();
  if (!token) {
    return {
      success: false,
      status: 401,
      message: 'Authentication token missing. Please log in.',
    };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/admin/roles/${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        success: false,
        status: response.status,
        message: result?.message || `Failed to delete role (Status: ${response.status})`,
      };
    }

    return {
      success: true,
      status: response.status,
      message: result?.message || 'Role deleted successfully.',
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      message: 'Network error: Unable to connect to backend server to delete role.',
    };
  }
}

/**
 * Retrieve all products with optional search term (Requires ACL: products:read)
 * GET /api/admin/products
 */
export async function getProducts(search?: string, authToken?: string): Promise<GetProductsResponse> {
  const token = authToken || getToken();
  if (!token) {
    return {
      success: false,
      status: 401,
      message: 'Authentication token missing. Please log in.',
    };
  }

  try {
    const url = new URL(`${API_BASE_URL}/api/admin/products`);
    if (search && search.trim()) {
      url.searchParams.append('search', search.trim());
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        success: false,
        status: response.status,
        message: result?.message || `Failed to fetch products (Status: ${response.status})`,
      };
    }

    return {
      success: true,
      status: 200,
      count: result?.count,
      products: result?.products || [],
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      message: 'Network error: Unable to connect to backend to fetch products.',
    };
  }
}

/**
 * Retrieve a single product by ID (Requires ACL: products:read)
 * GET /api/admin/products/:id
 */
export async function getProductById(id: string, authToken?: string): Promise<GetProductResponse> {
  const token = authToken || getToken();
  if (!token) {
    return {
      success: false,
      status: 401,
      message: 'Authentication token missing. Please log in.',
    };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/admin/products/${id}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        success: false,
        status: response.status,
        message: result?.message || `Failed to fetch product (Status: ${response.status})`,
      };
    }

    return {
      success: true,
      status: 200,
      product: result?.product,
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      message: 'Network error: Unable to connect to backend to fetch product details.',
    };
  }
}

/**
 * Create a new product with multiple images using FormData (Requires ACL: products:create)
 * POST /api/admin/products
 */
export async function createProduct(
  formData: FormData,
  authToken?: string
): Promise<ProductMutationResponse> {
  const token = authToken || getToken();
  if (!token) {
    return {
      success: false,
      status: 401,
      message: 'Authentication token missing. Please log in.',
    };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/admin/products`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        // Note: Do NOT set Content-Type header when sending FormData; browser sets boundary
      },
      body: formData,
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        success: false,
        status: response.status,
        message: result?.message || `Failed to create product (Status: ${response.status})`,
      };
    }

    return {
      success: true,
      status: response.status,
      message: result?.message || 'Product created successfully.',
      product: result?.product,
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      message: 'Network error: Unable to connect to backend server to create product.',
    };
  }
}

/**
 * Update an existing product and images using FormData (Requires ACL: products:update)
 * PUT /api/admin/products/:id
 */
export async function updateProduct(
  id: string,
  formData: FormData,
  authToken?: string
): Promise<ProductMutationResponse> {
  const token = authToken || getToken();
  if (!token) {
    return {
      success: false,
      status: 401,
      message: 'Authentication token missing. Please log in.',
    };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/admin/products/${id}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        // Note: Do NOT set Content-Type header when sending FormData; browser sets boundary
      },
      body: formData,
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        success: false,
        status: response.status,
        message: result?.message || `Failed to update product (Status: ${response.status})`,
      };
    }

    return {
      success: true,
      status: response.status,
      message: result?.message || 'Product updated successfully.',
      product: result?.product,
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      message: 'Network error: Unable to connect to backend server to update product.',
    };
  }
}

/**
 * Delete a product (Requires ACL: products:delete)
 * DELETE /api/admin/products/:id
 */
export async function deleteProduct(id: string, authToken?: string): Promise<DeleteProductResponse> {
  const token = authToken || getToken();
  if (!token) {
    return {
      success: false,
      status: 401,
      message: 'Authentication token missing. Please log in.',
    };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/admin/products/${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        success: false,
        status: response.status,
        message: result?.message || `Failed to delete product (Status: ${response.status})`,
      };
    }

    return {
      success: true,
      status: response.status,
      message: result?.message || 'Product deleted successfully.',
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      message: 'Network error: Unable to connect to backend server to delete product.',
    };
  }
}

export interface AdminRefundRequest {
  _id: string;
  order: {
    _id: string;
    customer?: {
      _id: string;
      name: string;
      email: string;
    } | string;
    customerName?: string;
    customerEmail?: string;
    totalAmount: number;
    currency: string;
    paymentStatus: string;
    orderStatus: string;
    refundStatus: string;
    refundedAmount?: number;
    stripePaymentIntentId?: string;
    stripeCheckoutSessionId?: string;
    items: Array<{
      product?: any;
      title: string;
      priceAtPurchase: number;
      quantity: number;
      image?: string;
    }>;
    createdAt: string;
  } | null;
  customer: {
    _id: string;
    name: string;
    email: string;
  } | null;
  reason: string;
  description?: string;
  status: 'pending' | 'approved' | 'rejected' | 'processing' | 'refunded' | 'failed' | 'cancelled';
  requestedAmount: number;
  approvedAmount?: number;
  currency: string;
  stripeRefundId?: string;
  stripePaymentIntentId?: string;
  stripeChargeId?: string;
  adminNote?: string;
  failureReason?: string;
  requestedAt: string;
  processedAt?: string;
  processedBy?: {
    _id: string;
    name: string;
    email: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface GetRefundRequestsResponse {
  success: boolean;
  count?: number;
  refundRequests?: AdminRefundRequest[];
  message?: string;
  status?: number;
}

export interface GetSingleRefundRequestResponse {
  success: boolean;
  refundRequest?: AdminRefundRequest;
  message?: string;
  status?: number;
}

export interface ApproveRefundResponse {
  success: boolean;
  message: string;
  refundRequest?: AdminRefundRequest;
  stripeRefund?: any;
  status?: number;
}

export interface RejectRefundResponse {
  success: boolean;
  message: string;
  refundRequest?: AdminRefundRequest;
  status?: number;
}

/**
 * Fetch all refund requests (Requires ACL: refunds:read)
 * GET /api/admin/refund-requests
 */
export async function getRefundRequests(
  params?: { status?: string; search?: string },
  authToken?: string
): Promise<GetRefundRequestsResponse> {
  const token = authToken || getToken();
  if (!token) {
    return {
      success: false,
      status: 401,
      message: 'Authentication token missing. Please log in.',
    };
  }

  try {
    const url = new URL(`${API_BASE_URL}/api/admin/refund-requests`);
    if (params?.status && params.status !== 'all') {
      url.searchParams.append('status', params.status);
    }
    if (params?.search && params.search.trim()) {
      url.searchParams.append('search', params.search.trim());
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        success: false,
        status: response.status,
        message: result?.message || `Failed to fetch refund requests (Status: ${response.status})`,
      };
    }

    return {
      success: true,
      status: 200,
      count: result?.count,
      refundRequests: result?.refundRequests || [],
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      message: 'Network error: Unable to connect to backend to fetch refund requests.',
    };
  }
}

/**
 * Fetch a single refund request by ID (Requires ACL: refunds:read)
 * GET /api/admin/refund-requests/:id
 */
export async function getRefundRequestById(
  id: string,
  authToken?: string
): Promise<GetSingleRefundRequestResponse> {
  const token = authToken || getToken();
  if (!token) {
    return {
      success: false,
      status: 401,
      message: 'Authentication token missing. Please log in.',
    };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/admin/refund-requests/${id}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        success: false,
        status: response.status,
        message: result?.message || `Failed to fetch refund request details (Status: ${response.status})`,
      };
    }

    return {
      success: true,
      status: 200,
      refundRequest: result?.refundRequest,
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      message: 'Network error: Unable to connect to backend to fetch refund details.',
    };
  }
}

/**
 * Approve refund request and process via Stripe API (Requires ACL: refunds:approve)
 * POST /api/admin/refund-requests/:id/approve
 */
export async function approveRefundRequest(
  id: string,
  payload?: { adminNote?: string },
  authToken?: string
): Promise<ApproveRefundResponse> {
  const token = authToken || getToken();
  if (!token) {
    return {
      success: false,
      status: 401,
      message: 'Authentication token missing. Please log in.',
    };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/admin/refund-requests/${id}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload || {}),
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        success: false,
        status: response.status,
        message: result?.message || `Failed to approve refund (Status: ${response.status})`,
      };
    }

    return {
      success: true,
      status: response.status,
      message: result?.message || 'Refund processed successfully via Stripe.',
      refundRequest: result?.refundRequest,
      stripeRefund: result?.stripeRefund,
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      message: 'Network error: Unable to connect to backend server to process refund.',
    };
  }
}

/**
 * Reject refund request with reason/note (Requires ACL: refunds:reject)
 * POST /api/admin/refund-requests/:id/reject
 */
export async function rejectRefundRequest(
  id: string,
  payload: { adminNote: string },
  authToken?: string
): Promise<RejectRefundResponse> {
  const token = authToken || getToken();
  if (!token) {
    return {
      success: false,
      status: 401,
      message: 'Authentication token missing. Please log in.',
    };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/admin/refund-requests/${id}/reject`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        success: false,
        status: response.status,
        message: result?.message || `Failed to reject refund (Status: ${response.status})`,
      };
    }

    return {
      success: true,
      status: response.status,
      message: result?.message || 'Refund request rejected.',
      refundRequest: result?.refundRequest,
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      message: 'Network error: Unable to connect to backend server to reject refund.',
    };
  }
}

/**
 * ==========================================================
 * DELIVERY ZONES & SERVICEABILITY API CLIENT METHODS
 * ==========================================================
 */

export interface DeliveryZoneBoundary {
  type: 'Polygon';
  coordinates: number[][][]; // Array of coordinate rings [[[longitude, latitude], ...]]
}

export interface DeliveryZoneItem {
  _id: string;
  name: string;
  code: string;
  description?: string;
  boundary: DeliveryZoneBoundary;
  deliveryFee: number;
  minOrderAmount: number;
  estimatedDeliveryTime: string;
  priority: number;
  isActive: boolean;
  coverageType: 'all_products' | 'specific_products' | 'categories';
  assignedProducts?: ProductItem[];
  assignedCategories?: string[];
  color?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DeliveryZonesResponse {
  success: boolean;
  status: number;
  count?: number;
  deliveryZones?: DeliveryZoneItem[];
  message?: string;
}

export interface SingleDeliveryZoneResponse {
  success: boolean;
  status: number;
  deliveryZone?: DeliveryZoneItem;
  message?: string;
}

export interface DeliveryZoneInput {
  name: string;
  code: string;
  description?: string;
  boundary: DeliveryZoneBoundary;
  deliveryFee: number;
  minOrderAmount: number;
  estimatedDeliveryTime: string;
  priority?: number;
  isActive?: boolean;
  coverageType?: 'all_products' | 'specific_products' | 'categories';
  assignedProducts?: string[];
  assignedCategories?: string[];
  color?: string;
}

/**
 * Fetch all delivery zones
 */
export async function getAdminDeliveryZones(
  token?: string,
  params?: { activeOnly?: boolean; search?: string }
): Promise<DeliveryZonesResponse> {
  const authToken = token || getToken();
  if (!authToken) {
    return {
      success: false,
      status: 401,
      message: 'Authentication token missing. Please log in.',
    };
  }

  const query = new URLSearchParams();
  if (params?.activeOnly) query.append('activeOnly', 'true');
  if (params?.search) query.append('search', params.search.trim());
  const queryString = query.toString() ? `?${query.toString()}` : '';

  try {
    const response = await fetch(`${API_BASE_URL}/api/delivery-zones${queryString}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      cache: 'no-store',
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        success: false,
        status: response.status,
        message: result?.message || `Failed to fetch delivery zones (Status: ${response.status})`,
      };
    }

    return {
      success: true,
      status: response.status,
      count: result?.count || 0,
      deliveryZones: result?.deliveryZones || [],
      message: result?.message,
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      message: 'Network error: Unable to connect to backend server for delivery zones.',
    };
  }
}

/**
 * Fetch single delivery zone by ID
 */
export async function getAdminDeliveryZoneById(
  id: string,
  token?: string
): Promise<SingleDeliveryZoneResponse> {
  const authToken = token || getToken();
  if (!authToken) {
    return {
      success: false,
      status: 401,
      message: 'Authentication token missing. Please log in.',
    };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/delivery-zones/${id}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      cache: 'no-store',
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        success: false,
        status: response.status,
        message: result?.message || `Failed to fetch delivery zone (Status: ${response.status})`,
      };
    }

    return {
      success: true,
      status: response.status,
      deliveryZone: result?.deliveryZone,
      message: result?.message,
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      message: 'Network error: Unable to connect to backend server for delivery zone details.',
    };
  }
}

/**
 * Create a new delivery zone
 */
export async function createAdminDeliveryZone(
  payload: DeliveryZoneInput,
  token?: string
): Promise<SingleDeliveryZoneResponse> {
  const authToken = token || getToken();
  if (!authToken) {
    return {
      success: false,
      status: 401,
      message: 'Authentication token missing. Please log in.',
    };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/delivery-zones`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        success: false,
        status: response.status,
        message: result?.message || `Failed to create delivery zone (Status: ${response.status})`,
      };
    }

    return {
      success: true,
      status: response.status,
      deliveryZone: result?.deliveryZone,
      message: result?.message || 'Delivery zone created successfully.',
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      message: 'Network error: Unable to connect to backend server to create delivery zone.',
    };
  }
}

/**
 * Update an existing delivery zone
 */
export async function updateAdminDeliveryZone(
  id: string,
  payload: Partial<DeliveryZoneInput>,
  token?: string
): Promise<SingleDeliveryZoneResponse> {
  const authToken = token || getToken();
  if (!authToken) {
    return {
      success: false,
      status: 401,
      message: 'Authentication token missing. Please log in.',
    };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/delivery-zones/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        success: false,
        status: response.status,
        message: result?.message || `Failed to update delivery zone (Status: ${response.status})`,
      };
    }

    return {
      success: true,
      status: response.status,
      deliveryZone: result?.deliveryZone,
      message: result?.message || 'Delivery zone updated successfully.',
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      message: 'Network error: Unable to connect to backend server to update delivery zone.',
    };
  }
}

/**
 * Delete a delivery zone
 */
export async function deleteAdminDeliveryZone(
  id: string,
  token?: string
): Promise<{ success: boolean; status: number; message?: string }> {
  const authToken = token || getToken();
  if (!authToken) {
    return {
      success: false,
      status: 401,
      message: 'Authentication token missing. Please log in.',
    };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/delivery-zones/${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        success: false,
        status: response.status,
        message: result?.message || `Failed to delete delivery zone (Status: ${response.status})`,
      };
    }

    return {
      success: true,
      status: response.status,
      message: result?.message || 'Delivery zone deleted successfully.',
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      message: 'Network error: Unable to connect to backend server to delete delivery zone.',
    };
  }
}




