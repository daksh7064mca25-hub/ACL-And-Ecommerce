'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { CustomerUser, getCustomerToken, getCustomerUser, setCustomerAuth, clearCustomerAuth } from '@/lib/auth';

interface AuthContextType {
  user: CustomerUser | null;
  token: string | null;
  login: (token: string, user: CustomerUser) => void;
  logout: () => void;
  isAuthenticated: boolean;
  isMounted: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<CustomerUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const storedToken = getCustomerToken();
    const storedUser = getCustomerUser();
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(storedUser);
    }
  }, []);

  const login = (newToken: string, newUser: CustomerUser) => {
    setToken(newToken);
    setUser(newUser);
    setCustomerAuth(newToken, newUser);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    clearCustomerAuth();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        logout,
        isAuthenticated: !!token,
        isMounted,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
