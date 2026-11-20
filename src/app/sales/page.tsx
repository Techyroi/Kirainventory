'use client';

import React, { useEffect, useState } from 'react';
import { useCurrency } from '@/context/CurrencyContext';
import { Sale } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { ExportCSVButton } from '@/components/ui/ExportCSVButton';
import { Receipt, Search, Eye, CreditCard, Banknote, ArrowRightLeft } from 'lucide-react';

export default function SalesPage() {
  const { formatCurrency } = useCurrency();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  const [paymentMethodFilter, setPaymentMethodFilter] = useState('');

  const fetchSales = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sales?paymentMethod=${paymentMethodFilter}`);
      if (res.ok) setSales(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSales();
  }, [paymentMethodFilter]);

  const viewSaleDetails = async (saleId: string) => {
    try {
      const res = await fetch(`/api/sales/${saleId}`);
      if (res.ok) setSelectedSale(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Sales & Invoice History</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Complete transaction ledger for completed customer sales and POS checkouts.
          </p>
        </div>

        <ExportCSVButton
          data={sales.map(s => ({
            Invoice: s.invoice_number,
            Customer: s.customer_name,
            Subtotal: s.subtotal,
            Tax: s.tax_amount,
            Total: s.total_amount,
            PaymentMethod: s.payment_method,
            Status: s.status,
            User: s.user_name,
            Date: s.created_at
          }))}
          filename="sales_history.csv"
        />
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
        <select
          value={paymentMethodFilter}
          onChange={(e) => setPaymentMethodFilter(e.target.value)}
          className="px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none"
        >
          <option value="">All Payment Methods</option>
          <option value="Cash">Cash</option>
          <option value="Card">Card</option>
          <option value="Transfer">Bank Transfer</option>
        </select>
      </div>

      {/* Sales Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                <th className="py-3.5 px-4">Invoice #</th>
                <th className="py-3.5 px-4">Customer</th>
                <th className="py-3.5 px-4">Items</th>
                <th className="py-3.5 px-4">Payment Method</th>
                <th className="py-3.5 px-4">Total Amount</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Cashier / Staff</th>
                <th className="py-3.5 px-4">Date</th>
                <th className="py-3.5 px-4 text-right">View</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">Loading sales ledger...</td>
                </tr>
              ) : sales.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">No sales transactions found.</td>
                </tr>
              ) : (
                sales.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-indigo-400 font-mono">{s.invoice_number}</td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">{s.customer_name}</td>
                    <td className="py-3.5 px-4 text-slate-400">{s.item_count || 1} items</td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-medium text-[11px]">
                        {s.payment_method === 'Cash' && <Banknote className="w-3 h-3 text-emerald-400" />}
                        {s.payment_method === 'Card' && <CreditCard className="w-3 h-3 text-indigo-400" />}
                        {s.payment_method === 'Transfer' && <ArrowRightLeft className="w-3 h-3 text-amber-400" />}
                        {s.payment_method}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-extrabold text-slate-900 dark:text-white text-sm">
                      {formatCurrency(s.total_amount)}
                    </td>
                    <td className="py-3.5 px-4"><Badge status={s.status} /></td>
                    <td className="py-3.5 px-4 text-slate-300">{s.user_name}</td>
                    <td className="py-3.5 px-4 text-slate-400">
                      {new Date(s.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => viewSaleDetails(s.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-slate-800 transition-colors"
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

      {/* Sale Detail Inspector Modal */}
      {selectedSale && (
        <Modal
          isOpen={Boolean(selectedSale)}
          onClose={() => setSelectedSale(null)}
          title={`Invoice ${selectedSale.invoice_number}`}
          subtitle={`Customer: ${selectedSale.customer_name}`}
          maxWidth="lg"
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-800/50">
              <div>
                <p className="text-slate-400">Payment Method: <span className="text-white font-bold">{selectedSale.payment_method}</span></p>
                <p className="text-slate-400">Cashier: <span className="text-white font-bold">{selectedSale.user_name}</span></p>
              </div>
              <div>
                <p className="text-slate-400">Status: <Badge status={selectedSale.status} /></p>
                <p className="text-slate-400">Date: <span className="text-white font-bold">{new Date(selectedSale.created_at).toLocaleString()}</span></p>
              </div>
            </div>

            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase text-[10px]">
                  <th className="py-2">Product Name</th>
                  <th className="py-2 font-mono">SKU</th>
                  <th className="py-2 text-center">Qty</th>
                  <th className="py-2 text-right">Unit Price</th>
                  <th className="py-2 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {(selectedSale.items || []).map((item, idx) => (
                  <tr key={idx}>
                    <td className="py-2 font-bold text-white">{item.product_name}</td>
                    <td className="py-2 font-mono text-slate-400">{item.sku}</td>
                    <td className="py-2 text-center text-white">{item.quantity}</td>
                    <td className="py-2 text-right text-slate-300">{formatCurrency(item.selling_price)}</td>
                    <td className="py-2 text-right font-bold text-emerald-400">{formatCurrency(item.total_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="pt-3 border-t border-slate-800 space-y-1 text-right text-xs">
              <p className="text-slate-400">Subtotal: <span className="text-white font-bold">{formatCurrency(selectedSale.subtotal)}</span></p>
              <p className="text-slate-400">Tax: <span className="text-white font-bold">{formatCurrency(selectedSale.tax_amount)}</span></p>
              <p className="text-sm font-extrabold text-white">Total Amount: <span className="text-emerald-400">{formatCurrency(selectedSale.total_amount)}</span></p>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
