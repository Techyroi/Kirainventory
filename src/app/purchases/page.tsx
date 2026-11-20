'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useCurrency } from '@/context/CurrencyContext';
import { Purchase, Supplier, Product } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { ExportCSVButton } from '@/components/ui/ExportCSVButton';
import { Truck, Plus, Eye, CheckCircle2, AlertCircle, Trash2, Package } from 'lucide-react';

interface POFormItem {
  product_id: string;
  quantity: number;
  cost_price: number;
}

export default function PurchasesPage() {
  const { user } = useAuth();
  const { formatCurrency, symbol } = useCurrency();

  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');

  // PO Creation Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [poStatus, setPoStatus] = useState<'Draft' | 'Ordered' | 'Received'>('Draft');
  const [paymentStatus, setPaymentStatus] = useState<'Pending' | 'Partial' | 'Paid'>('Pending');
  const [poNotes, setPoNotes] = useState('');
  const [poItems, setPoItems] = useState<POFormItem[]>([]);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Inspector Modal
  const [selectedPO, setSelectedPO] = useState<Purchase | null>(null);

  const fetchPurchases = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (supplierFilter) params.append('supplierId', supplierFilter);

      const res = await fetch(`/api/purchases?${params.toString()}`);
      if (res.ok) setPurchases(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchMeta = async () => {
    try {
      const [supRes, prodRes] = await Promise.all([
        fetch('/api/suppliers'),
        fetch('/api/products')
      ]);
      if (supRes.ok) setSuppliers(await supRes.json());
      if (prodRes.ok) setProducts(await prodRes.json());
    } catch (e) {
      // Ignore
    }
  };

  useEffect(() => {
    fetchMeta();
  }, []);

  useEffect(() => {
    fetchPurchases();
  }, [statusFilter, supplierFilter]);

  const handleOpenCreateModal = () => {
    setSelectedSupplierId(suppliers[0]?.id || '');
    setPoStatus('Ordered');
    setPaymentStatus('Pending');
    setPoNotes('');
    setPoItems(products.length > 0 ? [{ product_id: products[0].id, quantity: 10, cost_price: products[0].cost_price }] : []);
    setFormError('');
    setIsCreateOpen(true);
  };

  const addLineItem = () => {
    if (products.length === 0) return;
    setPoItems([...poItems, { product_id: products[0].id, quantity: 10, cost_price: products[0].cost_price }]);
  };

  const removeLineItem = (index: number) => {
    setPoItems(poItems.filter((_, i) => i !== index));
  };

  const updateLineItem = (index: number, field: string, val: any) => {
    setPoItems(prev => {
      const copy = [...prev];
      if (field === 'product_id') {
        const prod = products.find(p => p.id === val);
        copy[index] = { ...copy[index], product_id: val, cost_price: prod?.cost_price || 0 };
      } else {
        copy[index] = { ...copy[index], [field]: Number(val) };
      }
      return copy;
    });
  };

  const handleCreatePO = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_id: selectedSupplierId,
          status: poStatus,
          payment_status: paymentStatus,
          notes: poNotes,
          items: poItems
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create PO');

      setIsCreateOpen(false);
      fetchPurchases();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const markPOAsReceived = async (poId: string) => {
    try {
      const res = await fetch(`/api/purchases/${poId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Received', payment_status: 'Paid' })
      });
      if (res.ok) {
        fetchPurchases();
        if (selectedPO?.id === poId) {
          setSelectedPO(prev => prev ? { ...prev, status: 'Received', payment_status: 'Paid' } : null);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const viewPODetails = async (poId: string) => {
    try {
      const res = await fetch(`/api/purchases/${poId}`);
      if (res.ok) setSelectedPO(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Purchase Orders (POs)</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Reorder products from suppliers and receive shipments to update inventory stock.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <ExportCSVButton
            data={purchases.map(p => ({
              PONumber: p.purchase_number,
              Supplier: p.supplier_name,
              TotalAmount: p.total_amount,
              Status: p.status,
              PaymentStatus: p.payment_status,
              CreatedBy: p.user_name,
              Date: p.created_at
            }))}
            filename="purchase_orders.csv"
          />

          {user?.role !== 'Staff' && (
            <button
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-md shadow-indigo-600/20"
            >
              <Plus className="w-4 h-4" />
              New Purchase Order
            </button>
          )}
        </div>
      </div>

      {/* Filter Controls */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none"
        >
          <option value="">All PO Statuses</option>
          <option value="Draft">Draft</option>
          <option value="Ordered">Ordered</option>
          <option value="Received">Received</option>
          <option value="Cancelled">Cancelled</option>
        </select>

        <select
          value={supplierFilter}
          onChange={(e) => setSupplierFilter(e.target.value)}
          className="px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none"
        >
          <option value="">All Suppliers</option>
          {suppliers.map(s => (
            <option key={s.id} value={s.id}>{s.company_name}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                <th className="py-3.5 px-4">PO Number</th>
                <th className="py-3.5 px-4">Supplier</th>
                <th className="py-3.5 px-4">Item Count</th>
                <th className="py-3.5 px-4">Total Amount</th>
                <th className="py-3.5 px-4">PO Status</th>
                <th className="py-3.5 px-4">Payment Status</th>
                <th className="py-3.5 px-4">Created By</th>
                <th className="py-3.5 px-4">Date</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">Loading purchase orders...</td>
                </tr>
              ) : purchases.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">No purchase orders found.</td>
                </tr>
              ) : (
                purchases.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-indigo-400 font-mono">{p.purchase_number}</td>
                    <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">{p.supplier_name}</td>
                    <td className="py-3.5 px-4 text-slate-400">{p.item_count || 1} items</td>
                    <td className="py-3.5 px-4 font-extrabold text-slate-900 dark:text-white text-sm">
                      {formatCurrency(p.total_amount)}
                    </td>
                    <td className="py-3.5 px-4"><Badge status={p.status} /></td>
                    <td className="py-3.5 px-4"><Badge status={p.payment_status} /></td>
                    <td className="py-3.5 px-4 text-slate-300">{p.user_name}</td>
                    <td className="py-3.5 px-4 text-slate-400">
                      {new Date(p.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-2">
                      {p.status !== 'Received' && user?.role !== 'Staff' && (
                        <button
                          onClick={() => markPOAsReceived(p.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Mark Received
                        </button>
                      )}
                      <button
                        onClick={() => viewPODetails(p.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-slate-800 transition-colors inline-block"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create PO Builder Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create Purchase Order"
        subtitle="Order items from supplier to replenish stock"
        maxWidth="2xl"
      >
        <form onSubmit={handleCreatePO} className="space-y-4">
          {formError && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Supplier *
              </label>
              <select
                required
                value={selectedSupplierId}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              >
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.company_name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Initial Status
              </label>
              <select
                value={poStatus}
                onChange={(e: any) => setPoStatus(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              >
                <option value="Draft">Draft</option>
                <option value="Ordered">Ordered</option>
                <option value="Received">Received (Increases Stock Immediately)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Payment Status
              </label>
              <select
                value={paymentStatus}
                onChange={(e: any) => setPaymentStatus(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              >
                <option value="Pending">Pending</option>
                <option value="Paid">Paid</option>
              </select>
            </div>
          </div>

          {/* Line Items Builder */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Order Line Items
              </label>
              <button
                type="button"
                onClick={addLineItem}
                className="text-xs font-bold text-indigo-400 hover:underline flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add Product Line
              </button>
            </div>

            {poItems.map((item, index) => (
              <div key={index} className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-800/60 border border-slate-700">
                <select
                  value={item.product_id}
                  onChange={(e) => updateLineItem(index, 'product_id', e.target.value)}
                  className="flex-1 px-2.5 py-1.5 rounded-lg text-xs bg-slate-900 border border-slate-700 text-white"
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                  ))}
                </select>

                <input
                  type="number"
                  min="1"
                  value={item.quantity}
                  onChange={(e) => updateLineItem(index, 'quantity', e.target.value)}
                  placeholder="Qty"
                  className="w-20 px-2.5 py-1.5 rounded-lg text-xs bg-slate-900 border border-slate-700 text-white text-center"
                />

                <input
                  type="number"
                  step="0.01"
                  value={item.cost_price}
                  onChange={(e) => updateLineItem(index, 'cost_price', e.target.value)}
                  placeholder="Cost"
                  className="w-24 px-2.5 py-1.5 rounded-lg text-xs bg-slate-900 border border-slate-700 text-white text-right"
                />

                <span className="w-24 text-right font-bold text-xs text-emerald-400">
                  {formatCurrency(item.quantity * item.cost_price)}
                </span>

                <button
                  type="button"
                  onClick={() => removeLineItem(index)}
                  className="p-1 text-slate-400 hover:text-rose-400"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Order Notes
            </label>
            <input
              type="text"
              value={poNotes}
              onChange={(e) => setPoNotes(e.target.value)}
              placeholder="e.g. Standard wholesale delivery terms..."
              className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
            />
          </div>

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || poItems.length === 0}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-md shadow-indigo-600/20 disabled:opacity-50"
            >
              {submitting ? 'Creating PO...' : 'Save Purchase Order'}
            </button>
          </div>
        </form>
      </Modal>

      {/* PO Inspector Modal */}
      {selectedPO && (
        <Modal
          isOpen={Boolean(selectedPO)}
          onClose={() => setSelectedPO(null)}
          title={`Purchase Order ${selectedPO.purchase_number}`}
          subtitle={`Supplier: ${selectedPO.supplier_name}`}
          maxWidth="lg"
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-800/50">
              <div>
                <p className="text-slate-400">PO Status: <Badge status={selectedPO.status} /></p>
                <p className="text-slate-400">Payment: <Badge status={selectedPO.payment_status} /></p>
              </div>
              <div>
                <p className="text-slate-400">Ordered By: <span className="text-white font-bold">{selectedPO.user_name}</span></p>
                <p className="text-slate-400">Date: <span className="text-white font-bold">{new Date(selectedPO.created_at).toLocaleDateString()}</span></p>
              </div>
            </div>

            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase text-[10px]">
                  <th className="py-2">Product Name</th>
                  <th className="py-2 font-mono">SKU</th>
                  <th className="py-2 text-center">Qty</th>
                  <th className="py-2 text-right">Cost Price</th>
                  <th className="py-2 text-right">Total Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {(selectedPO.items || []).map((item, idx) => (
                  <tr key={idx}>
                    <td className="py-2 font-bold text-white">{item.product_name}</td>
                    <td className="py-2 font-mono text-slate-400">{item.sku}</td>
                    <td className="py-2 text-center text-white">{item.quantity}</td>
                    <td className="py-2 text-right text-slate-300">{formatCurrency(item.cost_price)}</td>
                    <td className="py-2 text-right font-bold text-emerald-400">{formatCurrency(item.total_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
              <div>
                {selectedPO.status !== 'Received' && user?.role !== 'Staff' && (
                  <button
                    onClick={() => markPOAsReceived(selectedPO.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Receive Shipment & Update Stock
                  </button>
                )}
              </div>
              <p className="text-sm font-extrabold text-white">
                Total PO Spend: <span className="text-emerald-400">{formatCurrency(selectedPO.total_amount)}</span>
              </p>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
