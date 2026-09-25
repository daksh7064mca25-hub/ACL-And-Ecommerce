/**
 * Customer Panel Centralized API Client
 */

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export interface ProductItem {
  _id: string;
  title: string;
  price: number;
  quantity: number;
  images: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ProductsResponse {
  success: boolean;
  count: number;
  products: ProductItem[];
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
  currency: string;
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  orderStatus: 'pending' | 'confirmed' | 'cancelled' | 'processing' | 'completed';
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

/**
 * Fetch public products with optional search, sorting, and in-stock filter
 */
export async function getPublicProducts(params?: {
  search?: string;
  sort?: string;
  inStock?: boolean;
}): Promise<ProductsResponse> {
  const query = new URLSearchParams();
  if (params?.search) query.append('search', params.search);
  if (params?.sort) query.append('sort', params.sort);
  if (params?.inStock) query.append('inStock', 'true');

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

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Failed to retrieve orders history');
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



