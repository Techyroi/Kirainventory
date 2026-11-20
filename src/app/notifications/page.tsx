'use client';

import React, { useEffect, useState } from 'react';
import { NotificationItem } from '@/types';
import { Bell, CheckCircle2, AlertTriangle, CheckCheck, RefreshCw } from 'lucide-react';
import { clsx } from 'clsx';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const markAllRead = async () => {
    await fetch('/api/notifications', { method: 'POST' });
    setUnreadCount(0);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
  };

  const markSingleRead = async (id: string) => {
    await fetch(`/api/notifications/${id}`, { method: 'PUT' });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const filtered = filter === 'unread' ? notifications.filter(n => !n.is_read) : notifications;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">System Notification Center</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Automated alerts for low stock levels, stockout risks, PO receipts, and sales completion.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-md shadow-indigo-600/20"
            >
              <CheckCheck className="w-4 h-4" /> Mark All as Read
            </button>
          )}

          <button
            onClick={fetchNotifications}
            className="p-2.5 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            filter === 'all' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' : 'text-slate-400 hover:text-white'
          }`}
        >
          All Activity ({notifications.length})
        </button>

        <button
          onClick={() => setFilter('unread')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            filter === 'unread' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' : 'text-slate-400 hover:text-white'
          }`}
        >
          Unread Alerts ({unreadCount})
        </button>
      </div>

      {/* Notification List */}
      <div className="space-y-3">
        {loading ? (
          <div className="py-12 text-center text-slate-400 text-xs">Loading notifications...</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">No notifications found.</div>
        ) : (
          filtered.map((n) => (
            <div
              key={n.id}
              onClick={() => !n.is_read && markSingleRead(n.id)}
              className={clsx(
                'p-4 rounded-2xl border transition-all flex items-start justify-between gap-4 cursor-pointer',
                n.is_read
                  ? 'bg-white/60 dark:bg-slate-900/60 border-slate-200/60 dark:border-slate-800/80 opacity-75'
                  : 'bg-white dark:bg-slate-900 border-indigo-500/30 shadow-md shadow-indigo-500/5'
              )}
            >
              <div className="flex items-start gap-3.5">
                <div className={clsx(
                  'p-2.5 rounded-xl flex-shrink-0 mt-0.5',
                  n.type === 'out_of_stock' || n.type === 'low_stock' ? 'bg-rose-500/10 text-rose-500' : 'bg-emerald-500/10 text-emerald-500'
                )}>
                  {n.type === 'out_of_stock' || n.type === 'low_stock' ? (
                    <AlertTriangle className="w-5 h-5" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5" />
                  )}
                </div>

                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">{n.title}</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{n.message}</p>
                  <span className="text-[10px] text-slate-400 mt-2 block">
                    {new Date(n.created_at).toLocaleString([], { dateStyle: 'full', timeStyle: 'short' })}
                  </span>
                </div>
              </div>

              {!n.is_read && (
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 flex-shrink-0 animate-pulse mt-2" />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
