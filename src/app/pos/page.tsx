'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useCurrency } from '@/context/CurrencyContext';
import { Product, Customer, Sale } from '@/types';
import { Modal } from '@/components/ui/Modal';
import {
  ShoppingCart,
  Search,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  CreditCard,
  Banknote,
  ArrowRightLeft,
  Printer,
  AlertCircle,
  UserCheck,
  Package
} from 'lucide-react';

interface CartItem {
  product: Product;
  quantity: number;
  selling_price: number;
}

export default function PosPage() {
  const { user, business } = useAuth();
  const { formatCurrency, symbol } = useCurrency();

  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [discountAmount, setDiscountAmount] = useState<string>('0.00');
  const [taxRate, setTaxRate] = useState<number>(business?.default_tax_rate || 8.5);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Card' | 'Transfer'>('Cash');
  const [notes, setNotes] = useState('');

  // Checkout State
  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);

  const fetchPosData = async () => {
    setLoading(true);
    try {
      const [prodRes, custRes] = await Promise.all([
        fetch('/api/products'),
        fetch('/api/customers')
      ]);
      if (prodRes.ok) setProducts(await prodRes.json());
      if (custRes.ok) setCustomers(await custRes.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosData();
  }, []);

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1, selling_price: product.selling_price }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  // Calculations
  const subtotal = cart.reduce((sum, item) => sum + item.quantity * item.selling_price, 0);
  const discount = Number(discountAmount) || 0;
  const taxableAmount = Math.max(0, subtotal - discount);
  const taxAmount = (taxableAmount * (taxRate / 100));
  const totalAmount = taxableAmount + taxAmount;

  const handleCompleteSale = async () => {
    if (cart.length === 0) return;
    setCheckoutError('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: selectedCustomerId || null,
          items: cart.map((item) => ({
            product_id: item.product.id,
            quantity: item.quantity,
            selling_price: item.selling_price
          })),
          discount_amount: discount,
          tax_amount: taxAmount,
          payment_method: paymentMethod,
          notes
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to complete sale');
      }

      setCompletedSale(data);
      setCart([]);
      setDiscountAmount('0.00');
      setNotes('');
      fetchPosData(); // Refresh product stock levels
    } catch (err: any) {
      setCheckoutError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredProducts = products.filter(
    (p) =>
      p.status !== 'Inactive' &&
      (p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.barcode && p.barcode.includes(searchQuery)))
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-7rem)]">
      {/* LEFT 2 COLS: Product Catalog Grid */}
      <div className="lg:col-span-2 flex flex-col h-full space-y-4">
        {/* Search Bar */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search product name, SKU, or scan barcode..."
              autoFocus
              className="w-full pl-10 pr-4 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
          </div>
        </div>

        {/* Product Cards Grid */}
        <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
          {loading ? (
            <div className="col-span-full py-16 text-center text-xs text-slate-400">Loading catalog...</div>
          ) : filteredProducts.length === 0 ? (
            <div className="col-span-full py-16 text-center text-xs text-slate-400">No products matching query.</div>
          ) : (
            filteredProducts.map((p) => {
              const isOut = p.current_stock <= 0;
              return (
                <div
                  key={p.id}
                  onClick={() => !isOut && addToCart(p)}
                  className={`p-3.5 rounded-2xl bg-white dark:bg-slate-900 border transition-all flex flex-col justify-between ${
                    isOut
                      ? 'opacity-50 cursor-not-allowed border-slate-200 dark:border-slate-800'
                      : 'cursor-pointer hover:border-indigo-500 hover:shadow-md border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div>
                    <div className="w-full h-24 rounded-xl bg-slate-100 dark:bg-slate-800 overflow-hidden mb-2.5 flex items-center justify-center">
                      {p.product_image ? (
                        <img src={p.product_image} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        <Package className="w-8 h-8 text-slate-400" />
                      )}
                    </div>
                    <p className="font-bold text-xs text-slate-900 dark:text-white line-clamp-2 leading-snug">{p.name}</p>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">SKU: {p.sku}</p>
                  </div>

                  <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80">
                    <span className="font-bold text-xs text-indigo-400">{formatCurrency(p.selling_price)}</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                      isOut ? 'bg-rose-500/10 text-rose-400' : p.current_stock <= p.min_stock_level ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'
                    }`}>
                      {p.current_stock} left
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT COL: Interactive POS Cart Terminal */}
      <div className="flex flex-col h-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-4 overflow-hidden">
        {/* Cart Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-indigo-500" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Current Order Cart</h2>
          </div>
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400">
            {cart.reduce((s, i) => s + i.quantity, 0)} Items
          </span>
        </div>

        {/* Customer Selector */}
        <div className="my-3">
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
            Customer Selection
          </label>
          <select
            value={selectedCustomerId}
            onChange={(e) => setSelectedCustomerId(e.target.value)}
            className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none"
          >
            <option value="">Walk-in Customer (Optional)</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Cart Line Items List */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 my-2">
          {cart.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-400">
              Cart is empty. Click items from the catalog to add.
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.product.id} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <div className="flex-1 min-w-0 pr-2">
                  <p className="font-bold text-slate-900 dark:text-white truncate">{item.product.name}</p>
                  <p className="text-[10px] text-slate-400">{formatCurrency(item.selling_price)} / unit</p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center rounded-lg bg-slate-200 dark:bg-slate-700">
                    <button
                      onClick={() => updateQuantity(item.product.id, -1)}
                      className="p-1 hover:text-indigo-400"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="px-2 font-bold text-xs">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.product.id, 1)}
                      className="p-1 hover:text-indigo-400"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <button
                    onClick={() => removeFromCart(item.product.id)}
                    className="p-1 text-slate-400 hover:text-rose-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Payment & Summary Controls */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
          {checkoutError && (
            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{checkoutError}</span>
            </div>
          )}

          {/* Payment Method Selector */}
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setPaymentMethod('Cash')}
              className={`p-2 rounded-xl text-xs font-semibold flex flex-col items-center gap-1 border transition-colors ${
                paymentMethod === 'Cash' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-800/40 text-slate-400 border-slate-700'
              }`}
            >
              <Banknote className="w-4 h-4" />
              Cash
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod('Card')}
              className={`p-2 rounded-xl text-xs font-semibold flex flex-col items-center gap-1 border transition-colors ${
                paymentMethod === 'Card' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-800/40 text-slate-400 border-slate-700'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              Card
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod('Transfer')}
              className={`p-2 rounded-xl text-xs font-semibold flex flex-col items-center gap-1 border transition-colors ${
                paymentMethod === 'Transfer' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-800/40 text-slate-400 border-slate-700'
              }`}
            >
              <ArrowRightLeft className="w-4 h-4" />
              Transfer
            </button>
          </div>

          {/* Calculations Table */}
          <div className="space-y-1.5 text-xs text-slate-400">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="font-semibold text-slate-200">{formatCurrency(subtotal)}</span>
            </div>

            <div className="flex justify-between items-center">
              <span>Discount ({symbol})</span>
              <input
                type="number"
                step="0.01"
                value={discountAmount}
                onChange={(e) => setDiscountAmount(e.target.value)}
                className="w-20 px-2 py-0.5 rounded text-right text-xs bg-slate-800 border border-slate-700 text-white"
              />
            </div>

            <div className="flex justify-between">
              <span>Tax ({taxRate}%)</span>
              <span className="font-semibold text-slate-200">{formatCurrency(taxAmount)}</span>
            </div>

            <div className="flex justify-between text-sm font-extrabold text-white pt-2 border-t border-slate-800">
              <span>Total Due</span>
              <span className="text-emerald-400">{formatCurrency(totalAmount)}</span>
            </div>
          </div>

          {/* Submit Checkout */}
          <button
            onClick={handleCompleteSale}
            disabled={cart.length === 0 || submitting}
            className="w-full py-3 px-4 rounded-xl text-xs font-extrabold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            {submitting ? 'Processing Checkout...' : `Complete Sale (${formatCurrency(totalAmount)})`}
          </button>
        </div>
      </div>

      {/* Printable Receipt Invoice Modal */}
      {completedSale && (
        <Modal
          isOpen={Boolean(completedSale)}
          onClose={() => setCompletedSale(null)}
          title="Sale Receipt / Invoice"
          maxWidth="md"
        >
          <div id="printable-receipt" className="space-y-4 text-xs text-slate-700 dark:text-slate-300">
            <div className="text-center pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">{business?.name || 'Kiralyte POS system'}</h3>
              <p className="text-slate-500">{business?.address || 'San Francisco, CA'}</p>
              <p className="text-slate-500">{business?.email || 'support@apexretail.com'}</p>
              <div className="mt-2 inline-block px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 font-mono font-bold">
                INVOICE #{completedSale.invoice_number}
              </div>
            </div>

            <div className="flex justify-between text-[11px] text-slate-400">
              <span>Customer: {completedSale.customer_name}</span>
              <span>Date: {new Date(completedSale.created_at).toLocaleString()}</span>
            </div>

            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-bold uppercase text-[10px]">
                  <th className="py-2">Item</th>
                  <th className="py-2 text-center">Qty</th>
                  <th className="py-2 text-right">Price</th>
                  <th className="py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {cart.map((item, idx) => (
                  <tr key={idx}>
                    <td className="py-2 font-medium">{item.product.name}</td>
                    <td className="py-2 text-center">{item.quantity}</td>
                    <td className="py-2 text-right">{formatCurrency(item.selling_price)}</td>
                    <td className="py-2 text-right font-bold">{formatCurrency(item.quantity * item.selling_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-1 text-right">
              <p>Subtotal: <span className="font-semibold">{formatCurrency(completedSale.subtotal)}</span></p>
              <p>Tax: <span className="font-semibold">{formatCurrency(completedSale.tax_amount)}</span></p>
              <p className="text-sm font-extrabold text-slate-900 dark:text-white">
                Total: <span className="text-emerald-400">{formatCurrency(completedSale.total_amount)}</span>
              </p>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-200 hover:bg-slate-700"
            >
              <Printer className="w-4 h-4" /> Print Receipt
            </button>
            <button
              onClick={() => setCompletedSale(null)}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500"
            >
              Done / Next Sale
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
