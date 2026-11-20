'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  LayoutDashboard,
  Package,
  Tags,
  Boxes,
  ShoppingCart,
  Receipt,
  Truck,
  Users,
  Building2,
  BarChart3,
  Bell,
  Settings,
  UserCheck,
  X
} from 'lucide-react';
import { clsx } from 'clsx';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const pathname = usePathname();
  const { user, business } = useAuth();

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Products', href: '/products', icon: Package },
    { name: 'Categories', href: '/categories', icon: Tags },
    { name: 'Inventory', href: '/inventory', icon: Boxes },
    { name: 'POS Checkout', href: '/pos', icon: ShoppingCart, highlight: true },
    { name: 'Sales History', href: '/sales', icon: Receipt },
    { name: 'Purchases (POs)', href: '/purchases', icon: Truck },
    { name: 'Suppliers', href: '/suppliers', icon: Building2 },
    { name: 'Customers', href: '/customers', icon: Users },
    { name: 'Reports', href: '/reports', icon: BarChart3 },
    { name: 'Notifications', href: '/notifications', icon: Bell },
    ...(user?.role === 'Admin' ? [{ name: 'Settings', href: '/settings', icon: Settings }] : []),
    ...(user?.is_platform_admin ? [{ name: 'Client CRM', href: '/crm', icon: UserCheck }] : [])
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <aside className={clsx(
        'fixed top-0 bottom-0 left-0 z-50 w-64 bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800 transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static',
        isOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        {/* Brand Header */}
        <div className="flex items-center justify-between h-16 px-6 border-b border-slate-800/80 bg-slate-950/40">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-500/20">
              {business?.name ? business.name.charAt(0) : 'I'}
            </div>
            <div>
              <h1 className="text-sm font-bold text-white leading-tight truncate max-w-[130px]">
                {business?.name || 'Kiralyte POS system'}
              </h1>
              <p className="text-[10px] text-slate-400 font-medium">Enterprise Edition</p>
            </div>
          </Link>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white lg:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onClose}
                className={clsx(
                  'flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : item.highlight
                    ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                )}
              >
                <Icon className={clsx('w-5 h-5', isActive ? 'text-white' : item.highlight ? 'text-emerald-400' : 'text-slate-400')} />
                <span className="truncate">{item.name}</span>
              </Link>
            );
          })}
        </div>

        {/* User Card */}
        {user && (
          <div className="p-4 border-t border-slate-800/80 bg-slate-950/40">
            <div className="flex items-center gap-3 p-2 rounded-xl bg-slate-800/40">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs font-bold border border-indigo-500/30">
                {user.name.charAt(0)}
              </div>
              <div className="truncate flex-1">
                <p className="text-xs font-semibold text-white truncate">{user.name}</p>
                <span className={clsx(
                  'inline-block px-1.5 py-0.2 rounded text-[10px] font-semibold mt-0.5',
                  user.role === 'Admin' ? 'bg-indigo-500/20 text-indigo-300' : user.role === 'Manager' ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-700 text-slate-300'
                )}>
                  {user.role}
                </span>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
};
