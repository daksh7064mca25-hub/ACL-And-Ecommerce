'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { loginRider } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

export default function RiderLoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState('rider@example.com');
  const [password, setPassword] = useState('Rider@123');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await loginRider(email.trim(), password);
      if (res.success && res.token && res.data?.rider) {
        login(res.token, res.data.rider);
        router.replace('/');
      } else {
        setErrorMessage(res.message || 'Login failed. Please check your credentials.');
      }
    } catch (err: any) {
      console.error('[Rider Login] Error:', err);
      setErrorMessage(err.message || 'Failed to authenticate with backend server.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070b14] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-2">
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-orange-600 to-amber-500 mx-auto flex items-center justify-center text-3xl shadow-2xl shadow-orange-500/30">
          🛵
        </div>
        <h2 className="text-2xl font-black text-white tracking-tight">Rider Delivery Portal</h2>
        <p className="text-xs text-gray-400">Sign in to manage assigned deliveries and stream live GPS tracking.</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-gray-900/80 border border-gray-800 backdrop-blur-xl py-8 px-6 sm:px-10 rounded-3xl shadow-2xl space-y-6">
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
              <span>⚠️</span>
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-300 mb-1.5">
                Rider Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-gray-950 border border-gray-800 rounded-2xl px-4 py-3 text-sm text-white focus:border-orange-500 outline-none transition"
                placeholder="rider@example.com"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-300 mb-1.5">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-gray-950 border border-gray-800 rounded-2xl px-4 py-3 text-sm text-white focus:border-orange-500 outline-none transition"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 disabled:opacity-50 text-white font-extrabold text-sm py-3.5 rounded-2xl shadow-lg shadow-orange-500/25 transition transform active:scale-[0.99] flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign In as Rider</span>
                  <span>→</span>
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Credentials helper */}
          <div className="pt-4 border-t border-gray-800/80 text-center">
            <span className="text-[11px] text-gray-500 block mb-2 font-medium uppercase tracking-wider">Demo Credentials</span>
            <div className="inline-flex items-center gap-2 bg-gray-950 px-3 py-1.5 rounded-xl border border-gray-800 text-xs text-gray-400 font-mono">
              <span className="text-orange-400 font-bold">rider@example.com</span> / <span>Rider@123</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
