'use client';

import React, { useState, useRef, useEffect } from 'react';
import { AdminUser, clearAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { useSocket } from '@/context/SocketContext';
import { disconnectAdminSocket } from '@/lib/socket';

interface HeaderProps {
  admin: AdminUser | null;
  title?: string;
}

export default function Header({ admin, title = 'Dashboard Overview' }: HeaderProps) {
  const router = useRouter();
  const { isConnected, notifications, unreadCount, markAllAsRead, clearNotifications } = useSocket();
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = () => {
    // 1. Disconnect socket
    disconnectAdminSocket();
    // 2. Clear JWT and Admin profile from localStorage
    clearAuth();
    // 3. Redirect to /login
    router.replace('/login');
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-20 shadow-xs">
      {/* Title / Breadcrumb */}
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-800">{title}</h1>
          <p className="text-xs text-slate-500">Welcome to your management dashboard</p>
        </div>

        {/* Real-time Socket Connection Status Pill */}
        <div
          className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border transition-colors ${
            isConnected
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-amber-50 text-amber-700 border-amber-200'
          }`}
          title={isConnected ? 'Socket.IO live real-time connection active' : 'Connecting to Socket.IO server...'}
        >
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
          <span>{isConnected ? 'Live Socket' : 'Connecting'}</span>
        </div>
      </div>

      {/* Admin Profile, Notification Bell & Logout */}
      <div className="flex items-center gap-3">
        {/* Real-time Notification Bell Popover */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => {
              setIsNotifOpen(!isNotifOpen);
              if (!isNotifOpen && unreadCount > 0) {
                markAllAsRead();
              }
            }}
            className="relative p-2 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer border border-slate-200"
            title="Real-time Notifications"
            aria-label="Notifications"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white shadow-xs animate-bounce">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown Panel */}
          {isNotifOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-2xl shadow-2xl py-2 z-50 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Live Activity Feed</h3>
                  <span className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-bold">
                    {notifications.length}
                  </span>
                </div>
                {notifications.length > 0 && (
                  <button
                    onClick={clearNotifications}
                    className="text-[11px] text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                  >
                    Clear All
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                {notifications.length === 0 ? (
                  <div className="py-8 text-center px-4">
                    <p className="text-2xl mb-1">📭</p>
                    <p className="text-xs font-semibold text-slate-600">No recent notifications</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Real-time order & refund events will appear here.</p>
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div
                      key={notif.id}
                      className="p-3.5 hover:bg-slate-50 transition-colors flex items-start gap-3"
                    >
                      <span className="text-lg leading-none mt-0.5">
                        {notif.type === 'order' ? '🛍️' : notif.type === 'refund' ? '↩️' : notif.type === 'payment' ? '💳' : '🔔'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <p className="text-xs font-bold text-slate-800 truncate">{notif.title}</p>
                          <span className="text-[10px] text-slate-400 whitespace-nowrap">
                            {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{notif.message}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Admin Info Pill */}
        <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-full py-1.5 px-3">
          <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-semibold text-xs flex items-center justify-center border border-indigo-200">
            {admin?.name ? admin.name.charAt(0).toUpperCase() : 'A'}
          </div>
          <div className="flex flex-col text-left pr-1">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-800 leading-tight">
                {admin?.name || 'Administrator'}
              </span>
              <span className="text-[10px] bg-indigo-50 text-indigo-700 font-medium px-1.5 py-0.2 rounded border border-indigo-200">
                {admin?.role || 'Admin'}
              </span>
            </div>
            <span className="text-[11px] text-slate-500 leading-tight">
              {admin?.email || 'admin@example.com'}
            </span>
          </div>
        </div>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          id="logout-btn"
          className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors cursor-pointer"
          title="Sign out of Admin Panel"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span>Logout</span>
        </button>
      </div>
    </header>
  );
}
