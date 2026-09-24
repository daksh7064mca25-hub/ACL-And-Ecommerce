/**
 * Customer Authentication Helpers
 */

const TOKEN_KEY = 'customer_jwt_token';
const USER_KEY = 'customer_user_info';

export interface CustomerUser {
  id: string;
  name: string;
  email: string;
  role: string;
  isEmailVerified: boolean;
}

export const setCustomerAuth = (token: string, user: CustomerUser): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch (err) {
    console.error('Failed to save customer auth:', err);
  }
};

export const getCustomerToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch (err) {
    return null;
  }
};

export const getCustomerUser = (): CustomerUser | null => {
  if (typeof window === 'undefined') return null;
  try {
    const data = localStorage.getItem(USER_KEY);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    return null;
  }
};

export const clearCustomerAuth = (): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch (err) {
    console.error('Failed to clear customer auth:', err);
  }
};
