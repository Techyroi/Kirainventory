'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useCurrency } from '@/context/CurrencyContext';
import { Product, InventoryMovement } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { ExportCSVButton } from '@/components/ui/ExportCSVButton';
import {
  Boxes,
  History,
  RefreshCw,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownLeft,
  AlertCircle,
  FileText
} from 'lucide-react';

export default function InventoryPage() {
  const { user } = useAuth();
  const { formatCurrency } = useCurrency();

  const [activeTab, setActiveTab] = useState<'matrix' | 'movements'>('matrix');

  // Stock Matrix state
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Audit Log state
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [loadingMovements, setLoadingMovements] = useState(false);
  const [filterType, setFilterType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Adjustment Modal State
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [movementType, setMovementType] = useState<'Add' | 'Remove' | 'Damaged' | 'Lost' | 'Return' | 'Adjustment' | 'Transfer'>('Adjustment');
  const [quantity, setQuantity] = useState('1');
  const [reason, setReason] = useState('');
  const [adjustError, setAdjustError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchProducts = async () => {
    setLoadingProducts(true);
    try {
      const res = await fetch(`/api/products?query=${encodeURIComponent(searchQuery)}`);
      if (res.ok) setProducts(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingProducts(false);
    }
  };

  const fetchMovements = async () => {
    setLoadingMovements(true);
    try {
      const params = new URLSearchParams();
      if (filterType) params.append('type', filterType);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const res = await fetch(`/api/inventory/movement?${params.toString()}`);
      if (res.ok) setMovements(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingMovements(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [searchQuery]);

  useEffect(() => {
    if (activeTab === 'movements') {
      fetchMovements();
    }
  }, [activeTab, filterType, startDate, endDate]);

  const handleOpenAdjust = (product: Product) => {
    setSelectedProduct(product);
    setMovementType('Adjustment');
    setQuantity('1');
    setReason('');
    setAdjustError('');
    setIsAdjustModalOpen(true);
  };

  const handleSubmitAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    setAdjustError('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/inventory/movement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: selectedProduct.id,
          movementType,
          quantity: Number(quantity),
          reason
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Adjustment failed');

      setIsAdjustModalOpen(false);
      fetchProducts();
      if (activeTab === 'movements') fetchMovements();
    } catch (err: any) {
      setAdjustError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Inventory & Audit Trail</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time stock valuation, manual adjustments, and immutable movement history logs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <ExportCSVButton
            data={activeTab === 'matrix' ? products.map(p => ({
              Product: p.name,
              SKU: p.sku,
              Stock: p.current_stock,
              MinStock: p.min_stock_level,
              MaxStock: p.max_stock_level,
              ValuationCost: (p.current_stock * p.cost_price).toFixed(2),
              Status: p.status
            })) : movements.map(m => ({
              Product: m.product_name,
              SKU: m.sku,
              Type: m.movement_type,
              QuantityDelta: m.quantity,
              Before: m.previous_quantity,
              After: m.new_quantity,
              Reason: m.reason,
              User: m.user_name,
              Date: m.created_at
            }))}
            filename={activeTab === 'matrix' ? 'stock_matrix.csv' : 'stock_movements_log.csv'}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('matrix')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'matrix'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Boxes className="w-4 h-4" />
          Stock Valuation Matrix
        </button>

        <button
          onClick={() => setActiveTab('movements')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'movements'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <History className="w-4 h-4" />
          Stock Movements Log
        </button>
      </div>

      {/* TAB 1: STOCK MATRIX */}
      {activeTab === 'matrix' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by product name or SKU..."
                className="w-full pl-9 pr-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                    <th className="py-3.5 px-4">Product</th>
                    <th className="py-3.5 px-4">SKU</th>
                    <th className="py-3.5 px-4">Current Stock</th>
                    <th className="py-3.5 px-4">Min / Max Level</th>
                    <th className="py-3.5 px-4">Asset Valuation</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Stock Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {loadingProducts ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">Loading stock matrix...</td>
                    </tr>
                  ) : products.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">No products found.</td>
                    </tr>
                  ) : (
                    products.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">{p.name}</td>
                        <td className="py-3.5 px-4 font-mono text-slate-400">{p.sku}</td>
                        <td className="py-3.5 px-4 font-extrabold text-slate-900 dark:text-white text-sm">{p.current_stock} units</td>
                        <td className="py-3.5 px-4 text-slate-400">Min: {p.min_stock_level} | Max: {p.max_stock_level}</td>
                        <td className="py-3.5 px-4 font-bold text-emerald-400">
                          {formatCurrency(p.current_stock * p.cost_price)}
                        </td>
                        <td className="py-3.5 px-4">
                          <Badge status={p.status} />
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => handleOpenAdjust(p)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition-colors"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            Adjust Stock
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: AUDIT MOVEMENTS LOG */}
      {activeTab === 'movements' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none"
              >
                <option value="">All Movement Types</option>
                <option value="Purchase">Purchase (PO Receive)</option>
                <option value="Sale">Sale (POS Invoice)</option>
                <option value="Return">Customer Return</option>
                <option value="Damaged">Damaged Goods</option>
                <option value="Lost">Lost Item</option>
                <option value="Adjustment">Manual Adjustment</option>
                <option value="Transfer">Transfer</option>
              </select>

              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none"
              />

              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none"
              />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                    <th className="py-3.5 px-4">Timestamp</th>
                    <th className="py-3.5 px-4">Product Name</th>
                    <th className="py-3.5 px-4">SKU</th>
                    <th className="py-3.5 px-4">Movement Type</th>
                    <th className="py-3.5 px-4">Delta Quantity</th>
                    <th className="py-3.5 px-4">Stock Transition</th>
                    <th className="py-3.5 px-4">Reason / Ref</th>
                    <th className="py-3.5 px-4">Recorded By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {loadingMovements ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">Loading audit log feed...</td>
                    </tr>
                  ) : movements.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">No stock movements found.</td>
                    </tr>
                  ) : (
                    movements.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3.5 px-4 text-slate-400">
                          {new Date(m.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'medium' })}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">{m.product_name}</td>
                        <td className="py-3.5 px-4 font-mono text-slate-400">{m.sku}</td>
                        <td className="py-3.5 px-4 font-semibold text-indigo-400">{m.movement_type}</td>
                        <td className="py-3.5 px-4 font-bold">
                          <span className={m.quantity > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                            {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-400 font-mono">
                          {m.previous_quantity} → {m.new_quantity}
                        </td>
                        <td className="py-3.5 px-4 text-slate-300 max-w-xs truncate">{m.reason}</td>
                        <td className="py-3.5 px-4 font-medium text-slate-300">{m.user_name}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Adjustment Modal */}
      <Modal
        isOpen={isAdjustModalOpen}
        onClose={() => setIsAdjustModalOpen(false)}
        title={`Adjust Stock: ${selectedProduct?.name}`}
        subtitle={`Current stock quantity: ${selectedProduct?.current_stock} units`}
        maxWidth="md"
      >
        <form onSubmit={handleSubmitAdjustment} className="space-y-4">
          {adjustError && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{adjustError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Movement Action Type *
            </label>
            <select
              value={movementType}
              onChange={(e: any) => setMovementType(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            >
              <option value="Adjustment">Manual Stock Adjustment (+/-)</option>
              <option value="Add">Add Stock (+)</option>
              <option value="Remove">Remove Stock (-)</option>
              <option value="Return">Customer Return (+)</option>
              <option value="Damaged">Damaged Item (-)</option>
              <option value="Lost">Lost Item (-)</option>
              <option value="Transfer">Transfer Stock</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Quantity *
            </label>
            <input
              type="number"
              min="1"
              required
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="5"
              className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Audit Reason *
            </label>
            <textarea
              required
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Physical inventory count correction, Damaged during shipping..."
              className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
          </div>

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsAdjustModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-md shadow-indigo-600/20 disabled:opacity-50"
            >
              {submitting ? 'Executing Adjustment...' : 'Confirm Stock Adjustment'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
