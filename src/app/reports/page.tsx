'use client';

import React, { useEffect, useState } from 'react';
import { useCurrency } from '@/context/CurrencyContext';
import { StatCard } from '@/components/ui/StatCard';
import { ExportCSVButton } from '@/components/ui/ExportCSVButton';
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Boxes,
  Truck,
  Filter,
  ArrowUpRight,
  PieChart as PieIcon
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell
} from 'recharts';

export default function ReportsPage() {
  const { formatCurrency } = useCurrency();
  const [reportTab, setReportTab] = useState<'sales' | 'inventory' | 'performance' | 'purchases'>('sales');

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const res = await fetch(`/api/reports?${params.toString()}`);
      if (res.ok) setReportData(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [startDate, endDate]);

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Financial & Inventory Reports</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Analyze sales velocity, asset valuation, profit margins, and vendor expenditure.
          </p>
        </div>

        <ExportCSVButton
          data={
            reportTab === 'sales'
              ? (reportData?.salesTrend || [])
              : reportTab === 'performance'
              ? (reportData?.productPerformance || [])
              : (reportData?.purchasesBySupplier || [])
          }
          filename={`${reportTab}_analytics_report.csv`}
        />
      </div>

      {/* Date Range Filter Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
          <Filter className="w-4 h-4 text-indigo-400" /> Date Filtering:
        </div>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none"
        />
        <span className="text-xs text-slate-500">to</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none"
        />
        {(startDate || endDate) && (
          <button
            onClick={() => { setStartDate(''); setEndDate(''); }}
            className="text-xs text-indigo-400 hover:underline font-semibold"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setReportTab('sales')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            reportTab === 'sales' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' : 'text-slate-400 hover:text-white'
          }`}
        >
          Sales & Revenue Report
        </button>
        <button
          onClick={() => setReportTab('inventory')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            reportTab === 'inventory' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' : 'text-slate-400 hover:text-white'
          }`}
        >
          Inventory Valuation
        </button>
        <button
          onClick={() => setReportTab('performance')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            reportTab === 'performance' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' : 'text-slate-400 hover:text-white'
          }`}
        >
          Product Profitability
        </button>
        <button
          onClick={() => setReportTab('purchases')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            reportTab === 'purchases' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' : 'text-slate-400 hover:text-white'
          }`}
        >
          Purchase Expenditure
        </button>
      </div>

      {/* REPORT CONTENTS */}
      {loading ? (
        <div className="py-20 text-center text-xs text-slate-400">Aggregating analytics data...</div>
      ) : (
        <>
          {/* TAB 1: SALES REPORT */}
          {reportTab === 'sales' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  title="Total Revenue"
                  value={formatCurrency(reportData?.salesSummary?.total_revenue || 0)}
                  icon={DollarSign}
                  color="emerald"
                />
                <StatCard
                  title="Completed Orders"
                  value={reportData?.salesSummary?.order_count || 0}
                  icon={ShoppingCart}
                  color="indigo"
                />
                <StatCard
                  title="Average Order Value"
                  value={formatCurrency(reportData?.salesSummary?.avg_order_value || 0)}
                  icon={TrendingUp}
                  color="violet"
                />
                <StatCard
                  title="Total Tax Collected"
                  value={formatCurrency(reportData?.salesSummary?.total_tax || 0)}
                  icon={BarChart3}
                  color="cyan"
                />
              </div>

              {/* Chart */}
              <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4">Revenue Growth Timeline</h3>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={reportData?.salesTrend || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                      <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} />
                      <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(v) => `$${v}`} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '12px' }}
                        formatter={(val: any) => [formatCurrency(Number(val)), 'Revenue']}
                      />
                      <Bar dataKey="revenue" fill="#6366f1" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: INVENTORY VALUATION */}
          {reportTab === 'inventory' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  title="Total Stock Units"
                  value={reportData?.inventoryValuation?.total_quantity || 0}
                  icon={Boxes}
                  color="indigo"
                />
                <StatCard
                  title="Total Cost Valuation"
                  value={formatCurrency(reportData?.inventoryValuation?.total_cost_value || 0)}
                  icon={DollarSign}
                  color="emerald"
                />
                <StatCard
                  title="Potential Retail Value"
                  value={formatCurrency(reportData?.inventoryValuation?.total_retail_value || 0)}
                  icon={TrendingUp}
                  color="violet"
                />
                <StatCard
                  title="Low / Out of Stock"
                  value={`${reportData?.inventoryValuation?.low_stock_count || 0} low / ${reportData?.inventoryValuation?.out_of_stock_count || 0} out`}
                  icon={BarChart3}
                  color="amber"
                />
              </div>
            </div>
          )}

          {/* TAB 3: PRODUCT PROFITABILITY */}
          {reportTab === 'performance' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                      <th className="py-3.5 px-4">Product</th>
                      <th className="py-3.5 px-4">SKU</th>
                      <th className="py-3.5 px-4">Cost / Selling</th>
                      <th className="py-3.5 px-4">Unit Profit Margin</th>
                      <th className="py-3.5 px-4">Units Sold</th>
                      <th className="py-3.5 px-4">Total Revenue</th>
                      <th className="py-3.5 px-4 font-bold text-right">Net Profit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {(reportData?.productPerformance || []).map((p: any) => (
                      <tr key={p.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">{p.name}</td>
                        <td className="py-3.5 px-4 font-mono text-slate-400">{p.sku}</td>
                        <td className="py-3.5 px-4 text-slate-300">{formatCurrency(p.cost_price)} / {formatCurrency(p.selling_price)}</td>
                        <td className="py-3.5 px-4 font-bold text-indigo-400">{formatCurrency(p.unit_profit)}</td>
                        <td className="py-3.5 px-4 font-bold text-slate-200">{p.total_sold} units</td>
                        <td className="py-3.5 px-4 font-bold text-slate-200">{formatCurrency(p.total_revenue)}</td>
                        <td className="py-3.5 px-4 text-right font-extrabold text-emerald-400">{formatCurrency(p.total_profit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: PURCHASES EXPENDITURE */}
          {reportTab === 'purchases' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard
                  title="Total PO Spend"
                  value={formatCurrency(reportData?.purchaseSummary?.total_purchase_spend || 0)}
                  icon={Truck}
                  color="violet"
                />
                <StatCard
                  title="Total PO Orders"
                  value={reportData?.purchaseSummary?.total_pos || 0}
                  icon={ShoppingCart}
                  color="indigo"
                />
                <StatCard
                  title="Outstanding Vendor Balances"
                  value={formatCurrency(reportData?.purchaseSummary?.outstanding_payments || 0)}
                  icon={DollarSign}
                  color="amber"
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
