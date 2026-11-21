'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { BillingPaymentStatus, CrmClient } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { PasswordInput } from '@/components/ui/PasswordInput';
import {
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Edit3,
  PauseCircle,
  PlayCircle,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
  Users
} from 'lucide-react';
import { clsx } from 'clsx';

type FilterOption = 'all' | 'active' | 'paused' | 'Overdue' | 'Pending' | 'Paid' | 'Trial';

export default function ClientCrmPage() {
  const { user, business: currentBusiness } = useAuth();
  const [clients, setClients] = useState<CrmClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterOption>('all');
  const [error, setError] = useState('');
  const [expandedBizId, setExpandedBizId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Add client modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    businessName: '',
    name: '',
    email: '',
    phone: '',
    password: '',
    plan_amount: '29',
    payment_status: 'Pending' as BillingPaymentStatus,
    next_due_date: '',
    crm_notes: ''
  });
  const [addError, setAddError] = useState('');
  const [savingAdd, setSavingAdd] = useState(false);

  // Edit billing modal
  const [editingClient, setEditingClient] = useState<CrmClient | null>(null);
  const [editForm, setEditForm] = useState({
    payment_status: 'Paid' as BillingPaymentStatus,
    plan_amount: '0',
    next_due_date: '',
    crm_notes: ''
  });
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete confirmation
  const [deletingClient, setDeletingClient] = useState<CrmClient | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchClients = useCallback(async () => {
    if (!user?.is_platform_admin) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (filter !== 'all') params.set('filter', filter);
      const res = await fetch(`/api/crm?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load clients');
      setClients(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load clients');
    } finally {
      setLoading(false);
    }
  }, [user?.is_platform_admin, search, filter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchClients();
    }, 150);
    return () => clearTimeout(timer);
  }, [fetchClients]);

  const stats = useMemo(() => {
    const total = clients.length;
    const active = clients.filter((c) => c.access_status === 'active').length;
    const paused = clients.filter((c) => c.access_status === 'paused').length;
    const unpaid = clients.filter((c) => c.payment_status === 'Overdue' || c.payment_status === 'Pending').length;
    return { total, active, paused, unpaid };
  }, [clients]);

  const handleTogglePause = async (client: CrmClient) => {
    setBusyId(client.id);
    setError('');
    const nextStatus = client.access_status === 'paused' ? 'active' : 'paused';
    try {
      const res = await fetch(`/api/crm/${client.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_status: nextStatus })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update access status');
      await fetchClients();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusyId(null);
    }
  };

  const handleMarkPaid = async (client: CrmClient) => {
    setBusyId(client.id);
    setError('');
    try {
      const res = await fetch(`/api/crm/${client.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_paid' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to mark paid');
      await fetchClients();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleSubUser = async (clientId: string, userId: string, currentStatus: 'active' | 'disabled') => {
    setBusyId(userId);
    setError('');
    try {
      const res = await fetch(`/api/crm/${clientId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          user_status: currentStatus === 'active' ? 'disabled' : 'active'
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update user');
      await fetchClients();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusyId(null);
    }
  };

  const openEditModal = (client: CrmClient) => {
    setEditingClient(client);
    setEditForm({
      payment_status: client.payment_status || 'Paid',
      plan_amount: String(client.plan_amount ?? 0),
      next_due_date: client.next_due_date ? client.next_due_date.slice(0, 10) : '',
      crm_notes: client.crm_notes || ''
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient) return;
    setSavingEdit(true);
    setError('');
    try {
      const res = await fetch(`/api/crm/${editingClient.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_status: editForm.payment_status,
          plan_amount: Number(editForm.plan_amount) || 0,
          next_due_date: editForm.next_due_date || null,
          crm_notes: editForm.crm_notes
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save billing details');
      setEditingClient(null);
      await fetchClients();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');
    setSavingAdd(true);
    try {
      const res = await fetch('/api/crm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...addForm,
          plan_amount: Number(addForm.plan_amount) || 0
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add client');
      setIsAddOpen(false);
      setAddForm({
        businessName: '',
        name: '',
        email: '',
        phone: '',
        password: '',
        plan_amount: '29',
        payment_status: 'Pending',
        next_due_date: '',
        crm_notes: ''
      });
      await fetchClients();
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : 'Failed to create client');
    } finally {
      setSavingAdd(false);
    }
  };

  const handleDeleteClient = async () => {
    if (!deletingClient) return;
    setDeleting(true);
    setError('');
    try {
      const res = await fetch(`/api/crm/${deletingClient.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to remove client');
      setDeletingClient(null);
      await fetchClients();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  if (!user?.is_platform_admin) {
    return (
      <div className="py-20 text-center space-y-3">
        <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Platform Owner Access Required</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Only the platform administrator can access the Client CRM to manage tenant access and direct payments.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Client CRM & Access Control</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Track direct payments manually, pause non-paying accounts, or remove inactive clients.
          </p>
        </div>
        <button
          onClick={() => setIsAddOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Client
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Clients</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{stats.total}</p>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Active Access</p>
          <p className="text-2xl font-bold text-emerald-500 mt-1">{stats.active}</p>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Paused Accounts</p>
          <p className="text-2xl font-bold text-rose-500 mt-1">{stats.paused}</p>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Pending / Overdue</p>
          <p className="text-2xl font-bold text-amber-500 mt-1">{stats.unpaid}</p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-sm">
          {error}
        </div>
      )}

      {/* Search & Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search business name, email, phone, or notes..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {(['all', 'active', 'paused', 'Overdue', 'Pending', 'Paid', 'Trial'] as FilterOption[]).map((opt) => (
            <button
              key={opt}
              onClick={() => setFilter(opt)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors',
                filter === opt
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              )}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      {/* Client List */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-slate-400">Loading clients...</div>
        ) : clients.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-400">No clients match your current filter.</div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {clients.map((client) => {
              const isOwnWorkspace = client.id === currentBusiness?.id;
              const isExpanded = expandedBizId === client.id;
              const isBusy = busyId === client.id;

              return (
                <div key={client.id} className="p-4 sm:p-5 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Client Info */}
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Building2 className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                        <span className="font-semibold text-slate-900 dark:text-white truncate">
                          {client.name}
                        </span>
                        {isOwnWorkspace && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                            Your Workspace
                          </span>
                        )}
                        <Badge status={client.access_status} />
                        <Badge status={client.payment_status} />
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                        <span>{client.email}</span>
                        {client.phone && <span>{client.phone}</span>}
                        <span>Fee: ${Number(client.plan_amount || 0).toFixed(2)}/mo</span>
                        {client.next_due_date && (
                          <span>Due: {new Date(client.next_due_date).toLocaleDateString()}</span>
                        )}
                        {client.last_paid_at && (
                          <span>Last Paid: {new Date(client.last_paid_at).toLocaleDateString()}</span>
                        )}
                      </div>

                      {client.crm_notes && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                          Note: {client.crm_notes}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => setExpandedBizId(isExpanded ? null : client.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                      >
                        <Users className="w-3.5 h-3.5" />
                        {client.user_count} {client.user_count === 1 ? 'User' : 'Users'}
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>

                      {client.payment_status !== 'Paid' || client.access_status === 'paused' ? (
                        <button
                          onClick={() => handleMarkPaid(client)}
                          disabled={isBusy}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Mark Paid
                        </button>
                      ) : null}

                      {!isOwnWorkspace && (
                        <button
                          onClick={() => handleTogglePause(client)}
                          disabled={isBusy}
                          className={clsx(
                            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors disabled:opacity-50',
                            client.access_status === 'paused'
                              ? 'bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20 border-indigo-500/20'
                              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 border-amber-500/20'
                          )}
                        >
                          {client.access_status === 'paused' ? (
                            <>
                              <PlayCircle className="w-3.5 h-3.5" />
                              Resume
                            </>
                          ) : (
                            <>
                              <PauseCircle className="w-3.5 h-3.5" />
                              Pause
                            </>
                          )}
                        </button>
                      )}

                      <button
                        onClick={() => openEditModal(client)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        Billing
                      </button>

                      {!isOwnWorkspace && (
                        <button
                          onClick={() => setDeletingClient(client)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 border border-rose-500/20 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Remove
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded Users List */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                        Users in {client.name} ({client.product_count} products · {client.sales_count} sales)
                      </p>
                      <div className="space-y-2">
                        {client.users.map((u) => (
                          <div
                            key={u.id}
                            className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-xs"
                          >
                            <div className="min-w-0">
                              <span className="font-semibold text-slate-900 dark:text-white">{u.name}</span>
                              <span className="text-slate-400 ml-2">{u.email}</span>
                              <span className="ml-2 px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-[10px] font-semibold">
                                {u.role}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge status={u.status} />
                              {u.id !== user.id && (
                                <button
                                  onClick={() => handleToggleSubUser(client.id, u.id, u.status)}
                                  disabled={busyId === u.id}
                                  className="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-medium transition-colors"
                                >
                                  {u.status === 'active' ? 'Pause User' : 'Activate'}
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Client Modal */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Add New Client" maxWidth="lg">
        <form onSubmit={handleAddClient} className="space-y-4">
          {addError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs">
              {addError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Business Name *</label>
              <input
                type="text"
                required
                value={addForm.businessName}
                onChange={(e) => setAddForm({ ...addForm, businessName: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Owner Name *</label>
              <input
                type="text"
                required
                value={addForm.name}
                onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Email *</label>
              <input
                type="email"
                required
                value={addForm.email}
                onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Phone</label>
              <input
                type="text"
                value={addForm.phone}
                onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Temporary Password *</label>
              <PasswordInput
                required
                value={addForm.password}
                onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Monthly Fee ($)</label>
              <input
                type="number"
                step="0.01"
                value={addForm.plan_amount}
                onChange={(e) => setAddForm({ ...addForm, plan_amount: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Payment Status</label>
              <select
                value={addForm.payment_status}
                onChange={(e) => setAddForm({ ...addForm, payment_status: e.target.value as BillingPaymentStatus })}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
              >
                <option value="Paid">Paid</option>
                <option value="Pending">Pending</option>
                <option value="Overdue">Overdue</option>
                <option value="Trial">Trial</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Next Due Date</label>
              <input
                type="date"
                value={addForm.next_due_date}
                onChange={(e) => setAddForm({ ...addForm, next_due_date: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Notes</label>
            <textarea
              rows={2}
              value={addForm.crm_notes}
              onChange={(e) => setAddForm({ ...addForm, crm_notes: e.target.value })}
              placeholder="e.g. Collects cash / bank transfer on the 1st"
              className="w-full px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsAddOpen(false)}
              className="px-4 py-2 rounded-xl text-sm font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingAdd}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50"
            >
              {savingAdd ? 'Creating...' : 'Create Client'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Billing Modal */}
      <Modal
        isOpen={Boolean(editingClient)}
        onClose={() => setEditingClient(null)}
        title={`Billing & Notes — ${editingClient?.name || ''}`}
        maxWidth="md"
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Payment Status</label>
            <select
              value={editForm.payment_status}
              onChange={(e) => setEditForm({ ...editForm, payment_status: e.target.value as BillingPaymentStatus })}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
            >
              <option value="Paid">Paid</option>
              <option value="Pending">Pending</option>
              <option value="Overdue">Overdue</option>
              <option value="Trial">Trial</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Monthly Fee ($)</label>
              <input
                type="number"
                step="0.01"
                value={editForm.plan_amount}
                onChange={(e) => setEditForm({ ...editForm, plan_amount: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Next Due Date</label>
              <input
                type="date"
                value={editForm.next_due_date}
                onChange={(e) => setEditForm({ ...editForm, next_due_date: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">CRM Notes</label>
            <textarea
              rows={3}
              value={editForm.crm_notes}
              onChange={(e) => setEditForm({ ...editForm, crm_notes: e.target.value })}
              placeholder="Payment arrangement, contact notes..."
              className="w-full px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setEditingClient(null)}
              className="px-4 py-2 rounded-xl text-sm font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingEdit}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50"
            >
              <CreditCard className="w-4 h-4" />
              {savingEdit ? 'Saving...' : 'Save Billing'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deletingClient)}
        onClose={() => setDeletingClient(null)}
        onConfirm={handleDeleteClient}
        title="Remove Client Workspace"
        message={`Are you sure you want to permanently remove "${deletingClient?.name}" and all ${deletingClient?.user_count ?? 0} of its users, products, and sales? If they just haven't paid yet, consider clicking Pause instead.`}
        confirmText="Remove Permanently"
        loading={deleting}
      />
    </div>
  );
}
