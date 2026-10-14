import { getRiderToken } from './auth';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export interface RiderDeliveryItem {
  _id: string;
  customer?: {
    _id?: string;
    name?: string;
    email?: string;
  };
  customerName?: string;
  customerEmail?: string;
  items: {
    title: string;
    quantity: number;
    priceAtPurchase: number;
  }[];
  totalAmount: number;
  deliveryStatus: 'unassigned' | 'assigned' | 'accepted' | 'picked_up' | 'on_the_way' | 'delivered' | 'cancelled';
  orderStatus: string;
  paymentStatus: string;
  deliveryLocation?: {
    type?: string;
    coordinates?: [number, number]; // [lng, lat]
    formattedAddress?: string;
  };
  shippingAddress?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
  };
  riderLocation?: {
    type?: string;
    coordinates?: [number, number]; // [lng, lat]
    accuracy?: number;
    heading?: number;
    speed?: number;
  };
  assignedAt?: string;
  acceptedAt?: string;
  pickedUpAt?: string;
  deliveryStartedAt?: string;
  deliveredAt?: string;
  createdAt: string;
  updatedAt: string;
}

export async function loginRider(email: string, password: string) {
  const response = await fetch(`${API_BASE_URL}/api/auth/rider/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Rider login failed');
  }
  return data;
}

export async function getAssignedDeliveries(token?: string) {
  const authToken = token || getRiderToken();
  if (!authToken) throw new Error('Authentication required');

  const response = await fetch(`${API_BASE_URL}/api/rider/deliveries`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    cache: 'no-store',
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch deliveries');
  return data;
}

export async function getActiveDelivery(token?: string) {
  const authToken = token || getRiderToken();
  if (!authToken) throw new Error('Authentication required');

  const response = await fetch(`${API_BASE_URL}/api/rider/deliveries/active`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    cache: 'no-store',
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch active delivery');
  return data;
}

export async function getDeliveryById(id: string, token?: string) {
  const authToken = token || getRiderToken();
  if (!authToken) throw new Error('Authentication required');

  const response = await fetch(`${API_BASE_URL}/api/rider/deliveries/${id}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    cache: 'no-store',
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch delivery');
  return data;
}

export async function updateDeliveryStatus(id: string, status: string, token?: string) {
  const authToken = token || getRiderToken();
  if (!authToken) throw new Error('Authentication required');

  const response = await fetch(`${API_BASE_URL}/api/rider/deliveries/${id}/status`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ status }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to update delivery status');
  return data;
}
