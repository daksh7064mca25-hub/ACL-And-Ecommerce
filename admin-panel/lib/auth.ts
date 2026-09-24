import CryptoJS from 'crypto-js';

/**
 * Authentication & ACL Storage Utility
 * Manages encrypted JWT token, Admin profile, and assigned permissions in client-side localStorage.
 * Resilient, safe against malformed data, and SSR-safe.
 */

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  permissions?: string[];
}

const TOKEN_KEY = 'admin_jwt_token';
const ADMIN_KEY = 'admin_user_profile';
const PERMISSIONS_KEY = 'admin_user_permissions';

// Encryption secret key from environment or secure fallback
const ENCRYPTION_SECRET =
  process.env.NEXT_PUBLIC_TOKEN_ENCRYPTION_KEY || 'admin_jwt_storage_encryption_secret_key_2026';

/**
 * Check if code is running in a browser environment
 */
const isClient = (): boolean => typeof window !== 'undefined';

/**
 * Helper: Encrypt plain text using AES encryption
 */
export function encryptData(plainText: string): string {
  if (!plainText) return '';
  try {
    return CryptoJS.AES.encrypt(plainText, ENCRYPTION_SECRET).toString();
  } catch {
    return plainText;
  }
}

/**
 * Helper: Decrypt AES cipher text back to original string.
 * Gracefully handles malformed or legacy plain text data without crashing.
 */
export function decryptData(cipherText: string): string | null {
  if (!cipherText || typeof cipherText !== 'string') return null;

  // If plain JWT string (starts with eyJ), return directly
  if (cipherText.startsWith('eyJ')) {
    return cipherText;
  }

  try {
    const bytes = CryptoJS.AES.decrypt(cipherText, ENCRYPTION_SECRET);
    try {
      const decrypted = bytes.toString(CryptoJS.enc.Utf8);
      return decrypted || null;
    } catch {
      // CryptoJS throws 'Malformed UTF-8 data' if decrypting with different key or corrupt bytes
      return null;
    }
  } catch {
    return null;
  }
}

/**
 * Save encrypted JWT token to localStorage
 */
export function saveToken(token: string): void {
  if (!isClient() || !token) return;
  try {
    const encryptedToken = encryptData(token);
    localStorage.setItem(TOKEN_KEY, encryptedToken);
  } catch (error) {
    console.error('Failed to save encrypted token to localStorage:', error);
  }
}

/**
 * Retrieve and decrypt JWT token from localStorage
 */
export function getToken(): string | null {
  if (!isClient()) return null;
  try {
    const storedValue = localStorage.getItem(TOKEN_KEY);
    if (!storedValue) return null;

    // 1. If it's already a raw JWT, return it
    if (storedValue.startsWith('eyJ')) {
      return storedValue;
    }

    // 2. Decrypt AES ciphertext
    const decryptedToken = decryptData(storedValue);
    if (decryptedToken) {
      return decryptedToken;
    }

    // 3. If decrypt failed (corrupt/stale data from prior session), clean up
    removeToken();
    return null;
  } catch {
    removeToken();
    return null;
  }
}

/**
 * Remove JWT token from localStorage
 */
export function removeToken(): void {
  if (!isClient()) return;
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Ignore storage removal errors
  }
}

/**
 * Check if a token currently exists and can be decrypted
 */
export function hasToken(): boolean {
  return Boolean(getToken());
}

/**
 * Save basic Admin information to localStorage
 */
export function saveAdmin(admin: AdminUser): void {
  if (!isClient() || !admin) return;
  try {
    const serialized = JSON.stringify(admin);
    const encryptedAdmin = encryptData(serialized);
    localStorage.setItem(ADMIN_KEY, encryptedAdmin);
  } catch (error) {
    console.error('Failed to save admin info to localStorage:', error);
  }
}

/**
 * Retrieve and decrypt basic Admin information from localStorage
 */
export function getAdmin(): AdminUser | null {
  if (!isClient()) return null;
  try {
    const raw = localStorage.getItem(ADMIN_KEY);
    if (!raw) return null;

    // Check if plain JSON
    if (raw.trim().startsWith('{')) {
      try {
        return JSON.parse(raw) as AdminUser;
      } catch {
        // Fall through to decryption
      }
    }

    const decrypted = decryptData(raw);
    const jsonString = decrypted || raw;
    return JSON.parse(jsonString) as AdminUser;
  } catch {
    removeAdmin();
    return null;
  }
}

/**
 * Remove stored Admin information from localStorage
 */
export function removeAdmin(): void {
  if (!isClient()) return;
  try {
    localStorage.removeItem(ADMIN_KEY);
  } catch {
    // Ignore storage removal errors
  }
}

/**
 * Save assigned ACL permissions to localStorage
 */
export function savePermissions(permissions: string[]): void {
  if (!isClient() || !Array.isArray(permissions)) return;
  try {
    const serialized = JSON.stringify(permissions);
    const encryptedPerms = encryptData(serialized);
    localStorage.setItem(PERMISSIONS_KEY, encryptedPerms);
  } catch (error) {
    console.error('Failed to save permissions to localStorage:', error);
  }
}

/**
 * Retrieve assigned ACL permissions from localStorage
 */
export function getPermissions(): string[] {
  if (!isClient()) return [];
  try {
    const raw = localStorage.getItem(PERMISSIONS_KEY);
    if (!raw) return [];

    // Plain JSON fallback
    if (raw.trim().startsWith('[')) {
      try {
        return JSON.parse(raw) as string[];
      } catch {
        // Fall through
      }
    }

    const decrypted = decryptData(raw);
    const jsonString = decrypted || raw;
    return JSON.parse(jsonString) as string[];
  } catch {
    return [];
  }
}

/**
 * Check if the currently authenticated user possesses a specific permission
 *
 * @param permissionName - e.g. 'users:read', 'promotions:send', 'dashboard:read'
 */
export function hasPermission(permissionName: string): boolean {
  const permissions = getPermissions();
  // If permissions array is empty (e.g. initial load before API returns), allow admin fallback or check
  if (permissions.length === 0) {
    const admin = getAdmin();
    // Default admin role possesses standard capabilities if permissions have not yet loaded
    if (admin?.role === 'Admin') return true;
    return false;
  }
  return permissions.includes(permissionName);
}

/**
 * Clear all authentication and ACL data (token, profile, permissions)
 */
export function clearAuth(): void {
  removeToken();
  removeAdmin();
  if (isClient()) {
    try {
      localStorage.removeItem(PERMISSIONS_KEY);
    } catch {
      // Ignore
    }
  }
}
