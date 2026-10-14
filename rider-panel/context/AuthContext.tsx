'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { RiderUser, getRiderToken, getRiderUser, saveRiderAuth, clearRiderAuth } from '@/lib/auth';

interface AuthContextType {
  token: string | null;
  user: RiderUser | null;
  isAuthenticated: boolean;
  login: (token: string, user: RiderUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<RiderUser | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const storedToken = getRiderToken();
    const storedUser = getRiderUser();
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(storedUser);
    }
    setIsLoaded(true);
  }, []);

  const login = (newToken: string, newUser: RiderUser) => {
    saveRiderAuth(newToken, newUser);
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    clearRiderAuth();
    setToken(null);
    setUser(null);
  };

  if (!isLoaded) return null;

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        isAuthenticated: Boolean(token && user),
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
