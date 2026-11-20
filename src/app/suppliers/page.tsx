'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useCurrency } from '@/context/CurrencyContext';
import { Supplier, Product, Purchase } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ExportCSVButton } from '@/components/ui/ExportCSVButton';
import { Building2, Plus, Search, Edit2, Trash2, Phone, Mail, MapPin, Eye, AlertCircle } from 'lucide-react';

export default function SuppliersPage() {
  const { user } = useAuth();
  const { formatCurrency } = useCurrency();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [formData, setFormData] = useState({
    company_name: '',
    contact_person: '',
    email: '',
    phone: '',
    address: '',
    notes: ''
  });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Profile View Drawer
  const [selectedSupplier, setSelectedSupplier] = useState<any | null>(null);

  // Delete State
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/suppliers?query=${encodeURIComponent(searchQuery)}`);
      if (res.ok) setSuppliers(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, [searchQuery]);

  const handleOpenAdd = () => {
    setEditingSupplier(null);
    setFormData({ company_name: '', contact_person: '', email: '', phone: '', address: '', notes: '' });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (sup: Supplier) => {
    setEditingSupplier(sup);
    setFormData({
      company_name: sup.company_name,
      contact_person: sup.contact_person || '',
      email: sup.email || '',
      phone: sup.phone || '',
      address: sup.address || '',
      notes: sup.notes || ''
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);

    try {
      const url = editingSupplier ? `/api/suppliers/${editingSupplier.id}` : '/api/suppliers';
      const method = editingSupplier ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save supplier');

      setIsModalOpen(false);
      fetchSuppliers();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const viewSupplierProfile = async (id: string) => {
    try {
      const res = await fetch(`/api/suppliers/${id}`);
      if (res.ok) setSelectedSupplier(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/suppliers/${deleteId}`, { method: 'DELETE' });
      if (res.ok) {
        setSuppliers(prev => prev.filter(s => s.id !== deleteId));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Suppliers Directory</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Manage vendor contacts, outstanding balances, and purchase order histories.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <ExportCSVButton
            data={suppliers.map(s => ({
              CompanyName: s.company_name,
              ContactPerson: s.contact_person,
              Email: s.email,
              Phone: s.phone,
              Address: s.address,
              TotalPurchases: s.total_purchases,
              OutstandingPayments: s.outstanding_payments
            }))}
            filename="suppliers_directory.csv"
          />

          {user?.role !== 'Staff' && (
            <button
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-md shadow-indigo-600/20"
            >
              <Plus className="w-4 h-4" />
              Add Supplier
            </button>
          )}
        </div>
      </div>

      {/* Search Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search company, contact person, or email..."
            className="w-full pl-9 pr-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          />
        </div>
      </div>

      {/* Supplier Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full py-12 text-center text-slate-400 text-xs">Loading supplier directory...</div>
        ) : suppliers.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-400 text-xs">No suppliers found.</div>
        ) : (
          suppliers.map((s) => (
            <div key={s.id} className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between hover:border-indigo-500/30 transition-all">
              <div>
                <div className="flex items-center justify-between">
                  <div className="p-2.5 rounded-xl bg-violet-500/10 text-violet-400">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => viewSupplierProfile(s.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-slate-800 transition-colors"
                      title="View Profile"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    {user?.role !== 'Staff' && (
                      <>
                        <button
                          onClick={() => handleOpenEdit(s)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-slate-800 transition-colors"
                          title="Edit Supplier"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteId(s.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                          title="Delete Supplier"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <h3 className="mt-3 text-base font-bold text-slate-900 dark:text-white">{s.company_name}</h3>
                <p className="text-xs font-medium text-indigo-400 mt-0.5">{s.contact_person || 'Contact N/A'}</p>

                <div className="mt-3 space-y-1 text-xs text-slate-400">
                  {s.email && <div className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 text-slate-500" /> <span className="truncate">{s.email}</span></div>}
                  {s.phone && <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-slate-500" /> <span>{s.phone}</span></div>}
                  {s.address && <div className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-slate-500" /> <span className="truncate">{s.address}</span></div>}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-semibold">Total Purchases</p>
                  <p className="font-extrabold text-slate-900 dark:text-white mt-0.5">{formatCurrency(s.total_purchases || 0)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-semibold">Outstanding</p>
                  <p className="font-extrabold text-amber-400 mt-0.5">{formatCurrency(s.outstanding_payments || 0)}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingSupplier ? 'Edit Supplier' : 'Add Supplier'}
        maxWidth="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Company Name *</label>
            <input
              type="text"
              required
              value={formData.company_name}
              onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
              placeholder="TechWorld Supplies"
              className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Contact Person</label>
            <input
              type="text"
              value={formData.contact_person}
              onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
              placeholder="David Zhao"
              className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Email Address</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="sales@techworld.com"
                className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Phone Number</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+1 555-234-5678"
                className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Address</label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="San Jose, CA"
              className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
            />
          </div>

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-md shadow-indigo-600/20 disabled:opacity-50"
            >
              {submitting ? 'Saving...' : editingSupplier ? 'Update Supplier' : 'Save Supplier'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Supplier Profile View Modal */}
      {selectedSupplier && (
        <Modal
          isOpen={Boolean(selectedSupplier)}
          onClose={() => setSelectedSupplier(null)}
          title={selectedSupplier.company_name}
          subtitle={`Contact: ${selectedSupplier.contact_person || 'N/A'}`}
          maxWidth="lg"
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-800/50">
              <div>
                <p className="text-slate-400">Total Spend: <span className="text-emerald-400 font-extrabold">{formatCurrency(selectedSupplier.total_purchases || 0)}</span></p>
                <p className="text-slate-400">Outstanding Balance: <span className="text-amber-400 font-extrabold">{formatCurrency(selectedSupplier.outstanding_payments || 0)}</span></p>
              </div>
              <div>
                <p className="text-slate-400">Email: <span className="text-white font-medium">{selectedSupplier.email || 'N/A'}</span></p>
                <p className="text-slate-400">Phone: <span className="text-white font-medium">{selectedSupplier.phone || 'N/A'}</span></p>
              </div>
            </div>

            <div>
              <h4 className="font-bold text-white mb-2 uppercase text-[10px] tracking-wider text-slate-400">Products Supplied ({selectedSupplier.products?.length || 0})</h4>
              <div className="max-h-40 overflow-y-auto divide-y divide-slate-800 border border-slate-800 rounded-xl p-2">
                {(selectedSupplier.products || []).map((p: any) => (
                  <div key={p.id} className="py-1.5 flex justify-between">
                    <span className="font-bold text-white">{p.name} ({p.sku})</span>
                    <span className="text-slate-400">Stock: {p.current_stock} | Cost: {formatCurrency(p.cost_price)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      )}

      <ConfirmDialog
        isOpen={Boolean(deleteId)}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Supplier"
        message="Are you sure you want to delete this supplier?"
        loading={deleting}
      />
    </div>
  );
}
