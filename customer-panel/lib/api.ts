/**
 * Customer Panel Centralized API Client
 */

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

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
  distanceInKm?: number;
  distanceInMeters?: number;
  isDeliverable?: boolean;
  deliverabilityMessage?: string;
  assignedDeliveryZones?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ProductsResponse {
  success: boolean;
  count: number;
  products: ProductItem[];
  message?: string;
}

export interface NearbyProductsResponse {
  success: boolean;
  count: number;
  origin?: {
    latitude: number;
    longitude: number;
  };
  radiusKm?: number;
  products: ProductItem[];
  message?: string;
}

export interface DeliveryZoneSummary {
  _id: string;
  name: string;
  code: string;
  deliveryFee: number;
  minOrderAmount: number;
  estimatedDeliveryTime: string;
  color?: string;
  description?: string;
  coverageType?: 'all_products' | 'specific_products' | 'specific_categories';
}

export interface DeliveryServiceabilityResponse {
  success: boolean;
  isServiceable: boolean;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  deliveryZone: DeliveryZoneSummary | null;
  deliveryFee: number;
  minOrderAmount: number;
  estimatedDeliveryTime: string;
  meetsMinOrder?: boolean;
  minOrderShortfall?: number;
  ineligibleItems?: {
    productId: string;
    title?: string;
    reason: string;
  }[];
  message?: string;
}

export interface SingleProductResponse {
  success: boolean;
  product: ProductItem;
  message?: string;
}

export interface CartCheckoutItem {
  productId: string;
  quantity: number;
}

export interface CheckoutRequest {
  items: CartCheckoutItem[];
  customerEmail?: string;
  customerName?: string;
  deliveryLocation?: {
    latitude: number;
    longitude: number;
    formattedAddress?: string;
  };
}

export interface CheckoutResponse {
  success: boolean;
  message?: string;
  clientSecret?: string;
  url?: string;
  sessionId?: string;
  orderId?: string;
  totalAmount?: number;
}

export interface OrderItemDetail {
  product: string | ProductItem;
  title: string;
  priceAtPurchase: number;
  quantity: number;
  image?: string;
}

export interface OrderDetail {
  _id: string;
  customer?: string | null;
  customerEmail: string;
  customerName?: string;
  items: OrderItemDetail[];
  totalAmount: number;
  subtotalAmount?: number;
  deliveryFee?: number;
  deliveryZoneName?: string;
  estimatedDeliveryTime?: string;
  deliveryLocation?: {
    type?: string;
    coordinates?: [number, number]; // [lng, lat]
    formattedAddress?: string;
  };
  currency: string;
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  orderStatus: 'pending' | 'confirmed' | 'cancelled' | 'processing' | 'completed';
  refundStatus?: 'none' | 'requested' | 'processing' | 'partial' | 'refunded' | 'rejected' | 'failed';
  refundedAmount?: number;
  stripeRefundId?: string;
  refundRequestId?: string | null;
  stripeCheckoutSessionId?: string;
  stripePaymentIntentId?: string;
  shippingAddress?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface OrderResponse {
  success: boolean;
  order?: OrderDetail;
  message?: string;
}

export interface CustomerOrdersResponse {
  success: boolean;
  count: number;
  orders: OrderDetail[];
  message?: string;
}

export interface RefundRequestItem {
  _id: string;
  order: string | OrderDetail;
  customer: string;
  reason: string;
  description?: string;
  status: 'pending' | 'approved' | 'rejected' | 'processing' | 'refunded' | 'failed' | 'cancelled';
  requestedAmount: number;
  approvedAmount?: number;
  currency: string;
  stripeRefundId?: string;
  adminNote?: string;
  failureReason?: string;
  requestedAt: string;
  processedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RefundRequestResponse {
  success: boolean;
  refundRequest?: RefundRequestItem;
  message?: string;
}

export interface MyRefundRequestsResponse {
  success: boolean;
  count: number;
  refundRequests: RefundRequestItem[];
  message?: string;
}

/**
 * Fetch public products with optional search, sorting, in-stock filter, and delivery coordinates
 */
export async function getPublicProducts(params?: {
  search?: string;
  sort?: string;
  inStock?: boolean;
  lat?: number;
  lng?: number;
}): Promise<ProductsResponse> {
  const query = new URLSearchParams();
  if (params?.search) query.append('search', params.search);
  if (params?.sort) query.append('sort', params.sort);
  if (params?.inStock) query.append('inStock', 'true');
  if (params?.lat !== undefined && params?.lng !== undefined) {
    query.append('lat', params.lat.toString());
    query.append('lng', params.lng.toString());
  }

  const queryString = query.toString() ? `?${query.toString()}` : '';
  const response = await fetch(`${API_BASE_URL}/api/products${queryString}`, {
    method: 'GET',
    cache: 'no-store',
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Failed to fetch products');
  }
  return data;
}

/**
 * Check delivery serviceability for a customer coordinate
 */
export async function checkDeliveryServiceability(params: {
  lat: number;
  lng: number;
  items?: CartCheckoutItem[];
  cartTotal?: number;
}): Promise<DeliveryServiceabilityResponse> {
  const response = await fetch(`${API_BASE_URL}/api/delivery-zones/check-serviceability`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      latitude: params.lat,
      longitude: params.lng,
      items: params.items || [],
      cartTotal: params.cartTotal || 0,
    }),
    cache: 'no-store',
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      success: false,
      isServiceable: false,
      coordinates: { latitude: params.lat, longitude: params.lng },
      deliveryZone: null,
      deliveryFee: 0,
      minOrderAmount: 0,
      estimatedDeliveryTime: '',
      message: data.message || 'Delivery serviceability check failed',
    };
  }
  return data;
}

/**
 * Fetch a single product by ID
 */
export async function getPublicProductById(id: string): Promise<SingleProductResponse> {
  const response = await fetch(`${API_BASE_URL}/api/products/${id}`, {
    method: 'GET',
    cache: 'no-store',
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Failed to fetch product details');
  }
  return data;
}

/**
 * Create Stripe Checkout session from cart items
 */
export async function createCheckoutSession(
  payload: CheckoutRequest,
  token?: string | null
): Promise<CheckoutResponse> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}/api/orders/checkout`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Failed to initiate checkout. Please try again.');
  }
  return data;
}

/**
 * Retrieve Order by ID
 */
export async function getOrderById(id: string): Promise<OrderResponse> {
  const response = await fetch(`${API_BASE_URL}/api/orders/${id}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Failed to retrieve order');
  }
  return data;
}

/**
 * Retrieve Order by Stripe Session ID
 */
export async function getOrderBySessionId(sessionId: string): Promise<OrderResponse> {
  const response = await fetch(`${API_BASE_URL}/api/orders/session/${sessionId}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Failed to retrieve order by session ID');
  }
  return data;
}

/**
 * Retrieve logged-in customer's order history
 */
export async function getMyOrders(token: string): Promise<CustomerOrdersResponse> {
  const response = await fetch(`${API_BASE_URL}/api/orders/my-orders`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    cache: 'no-store',
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error: any = new Error(data.message || 'Failed to retrieve orders history');
    error.status = response.status;
    throw error;
  }
  return data;
}

/**
 * Retrieve Stripe Public Configuration
 */
export async function getStripeConfig(): Promise<{ publishableKey: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/stripe/config`, {
      method: 'GET',
      cache: 'no-store',
    });
    if (response.ok) {
      const data = await response.json();
      if (data.publishableKey) {
        return { publishableKey: data.publishableKey };
      }
    }
  } catch (err) {
    console.warn('[Stripe Config] Could not fetch public config from backend:', err);
  }
  return {
    publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '',
  };
}

/**
 * Helper to get full image URL
 */
export function getProductImageUrl(imagePath?: string): string {
  if (!imagePath) return '/placeholder-product.svg';
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }
  const cleanPath = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
  return `${API_BASE_URL}${cleanPath}`;
}

/**
 * Submit a customer refund request for an eligible paid order
 */
export async function createRefundRequest(
  orderId: string,
  payload: { reason: string; description?: string },
  token: string
): Promise<RefundRequestResponse> {
  const response = await fetch(`${API_BASE_URL}/api/orders/${orderId}/refund-request`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error: any = new Error(data.message || 'Failed to submit refund request');
    error.status = response.status;
    throw error;
  }
  return data;
}

/**
 * Fetch the existing refund request for a specific order
 */
export async function getOrderRefundRequest(
  orderId: string,
  token: string
): Promise<RefundRequestResponse> {
  const response = await fetch(`${API_BASE_URL}/api/orders/${orderId}/refund-request`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    cache: 'no-store',
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error: any = new Error(data.message || 'Failed to fetch refund details');
    error.status = response.status;
    throw error;
  }
  return data;
}

/**
 * Fetch all refund requests raised by the logged-in customer
 */
export async function getMyRefundRequests(
  token: string
): Promise<MyRefundRequestsResponse> {
  const response = await fetch(`${API_BASE_URL}/api/orders/my-refund-requests`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    cache: 'no-store',
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error: any = new Error(data.message || 'Failed to fetch refund requests');
    error.status = response.status;
    throw error;
  }
  return data;
}

/**
 * Fetch nearby products using MongoDB geospatial $geoNear query
 */
export async function getNearbyProducts(params: {
  lat: number;
  lng: number;
  radius?: number; // in km
  search?: string;
  inStock?: boolean;
  limit?: number;
}): Promise<NearbyProductsResponse> {
  const query = new URLSearchParams();
  query.append('lat', params.lat.toString());
  query.append('lng', params.lng.toString());
  if (params.radius !== undefined) query.append('radius', params.radius.toString());
  if (params.search && params.search.trim()) query.append('search', params.search.trim());
  if (params.inStock) query.append('inStock', 'true');
  if (params.limit) query.append('limit', params.limit.toString());

  const response = await fetch(`${API_BASE_URL}/api/products/nearby?${query.toString()}`, {
    method: 'GET',
    cache: 'no-store',
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error: any = new Error(data.message || 'Failed to search nearby products');
    error.status = response.status;
    throw error;
  }
  return data;
}





