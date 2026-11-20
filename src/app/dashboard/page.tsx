'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useCurrency } from '@/context/CurrencyContext';
import { StatCard } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';
import {
  Package,
  DollarSign,
  AlertTriangle,
  XCircle,
  TrendingUp,
  Calendar,
  ArrowRight,
  Boxes,
  Truck,
  ShoppingCart,
  Clock,
  RefreshCw
} from 'lucide-react';
import { DashboardMetrics } from '@/types';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend
} from 'recharts';

export default function DashboardPage() {
  const { formatCurrency } = useCurrency();
  const [data, setData] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/dashboard');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-xs text-slate-400 font-medium">Loading Dashboard Analytics...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-gradient-to-r from-indigo-900/40 via-purple-900/20 to-slate-900 p-6 rounded-3xl border border-indigo-500/20 shadow-xl">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Business Command Center</h1>
          <p className="text-xs text-slate-400 mt-1">Real-time inventory levels, sales velocity, and stock movement logs.</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchDashboard}
            className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700"
            title="Refresh Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <Link
            href="/pos"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 transition-all shadow-lg shadow-indigo-600/30"
          >
            <ShoppingCart className="w-4 h-4" />
            Open POS Checkout
          </Link>
        </div>
      </div>

      {/* 1. Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          title="Total Products"
          value={data?.totalProducts || 0}
          icon={Package}
          color="indigo"
        />
        <StatCard
          title="Inventory Value"
          value={formatCurrency(data?.totalInventoryValue || 0)}
          icon={DollarSign}
          color="emerald"
        />
        <StatCard
          title="Low Stock Alert"
          value={data?.lowStockCount || 0}
          icon={AlertTriangle}
          color="amber"
        />
        <StatCard
          title="Out of Stock"
          value={data?.outOfStockCount || 0}
          icon={XCircle}
          color="rose"
        />
        <StatCard
          title="Today's Sales"
          value={formatCurrency(data?.todaySales || 0)}
          icon={TrendingUp}
          color="violet"
        />
        <StatCard
          title="Month's Revenue"
          value={formatCurrency(data?.monthSales || 0)}
          icon={Calendar}
          color="cyan"
        />
      </div>

      {/* 2. Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Over Time */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Revenue & Sales Trends</h3>
              <p className="text-xs text-slate-400">Completed invoices over recent date periods</p>
            </div>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.salesOverTime || []}>
                <defs>
                  <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '12px' }}
                  formatter={(val: any) => [formatCurrency(Number(val)), 'Sales']}
                />
                <Area type="monotone" dataKey="sales" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#salesGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Inventory Value by Category */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Valuation by Category</h3>
            <p className="text-xs text-slate-400">Asset distribution across categories</p>
          </div>
          <div className="h-64 w-full my-4">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data?.inventoryValueByCategory || []}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={75}
                  innerRadius={45}
                  paddingAngle={4}
                >
                  {(data?.inventoryValueByCategory || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '12px' }}
                  formatter={(val: any) => [formatCurrency(Number(val)), 'Valuation']}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {(data?.inventoryValueByCategory || []).slice(0, 4).map((c, idx) => (
              <div key={c.name} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                <span className="truncate text-slate-400">{c.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Operational Sections: Recent Sales, Low Stock Products, Stock Movements */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Sales */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Recent Sales</h3>
              <Link href="/sales" className="text-xs font-semibold text-indigo-400 hover:underline flex items-center gap-1">
                View All <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="space-y-3">
              {(data?.recentSales || []).length === 0 ? (
                <p className="text-xs text-slate-400">No sales recorded yet.</p>
              ) : (
                (data?.recentSales || []).map((s) => (
                  <div key={s.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">{s.invoice_number}</p>
                      <p className="text-[11px] text-slate-400">{s.customer_name}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-indigo-400">{formatCurrency(s.total_amount)}</p>
                      <Badge status={s.status} className="mt-1" />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Low Stock Products */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Low Stock Items</h3>
              <Link href="/inventory" className="text-xs font-semibold text-amber-400 hover:underline flex items-center gap-1">
                Stock Matrix <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="space-y-3">
              {(data?.lowStockProducts || []).length === 0 ? (
                <p className="text-xs text-slate-400">All products are healthy & sufficiently stocked.</p>
              ) : (
                (data?.lowStockProducts || []).map((p) => (
                  <div key={p.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white truncate max-w-[160px]">{p.name}</p>
                      <p className="text-[11px] text-slate-400">SKU: {p.sku}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-amber-400">{p.current_stock} / min {p.min_stock_level}</p>
                      <Link
                        href={`/purchases?supplierId=${p.supplier_id || ''}`}
                        className="inline-block mt-1 text-[10px] font-bold text-indigo-400 hover:underline"
                      >
                        + Reorder PO
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Recent Stock Movements */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Audit Trail Feed</h3>
              <Link href="/inventory" className="text-xs font-semibold text-violet-400 hover:underline flex items-center gap-1">
                Full Log <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="space-y-3">
              {(data?.recentMovements || []).length === 0 ? (
                <p className="text-xs text-slate-400">No stock movements recorded yet.</p>
              ) : (
                (data?.recentMovements || []).map((m) => (
                  <div key={m.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white truncate max-w-[160px]">{m.product_name}</p>
                      <p className="text-[11px] text-slate-400">{m.movement_type} by {m.user_name}</p>
                    </div>
                    <div className="text-right">
                      <span className={`font-bold ${m.quantity > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                      </span>
                      <p className="text-[10px] text-slate-500 mt-0.5">{m.previous_quantity} → {m.new_quantity}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
