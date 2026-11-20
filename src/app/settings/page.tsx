'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { User, Business } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Settings, Building2, Boxes, Users, Plus, Save, ShieldCheck, AlertCircle } from 'lucide-react';

export default function SettingsPage() {
  const { user, refreshSession } = useAuth();
  const [tab, setTab] = useState<'business' | 'inventory' | 'users'>('business');

  // Business state
  const [businessData, setBusinessData] = useState<Partial<Business>>({
    name: '',
    logo: '',
    email: '',
    phone: '',
    address: '',
    currency: '$',
    default_tax_rate: 10.0,
    allow_negative_inventory: 0,
    default_min_stock: 10
  });

  const [savingBusiness, setSavingBusiness] = useState(false);
  const [businessMsg, setBusinessMsg] = useState('');

  // Users state
  const [usersList, setUsersList] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Add User Modal
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [userForm, setUserForm] = useState({ name: '', email: '', password: '', role: 'Staff' as const });
  const [userFormError, setUserFormError] = useState('');
  const [addingUser, setAddingUser] = useState(false);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) setBusinessData(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await fetch('/api/settings/users');
      if (res.ok) setUsersList(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    if (tab === 'users') {
      fetchUsers();
    }
  }, [tab]);

  const handleSaveBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBusiness(true);
    setBusinessMsg('');

    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(businessData)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save settings');

      setBusinessMsg('Settings updated successfully!');
      refreshSession();
    } catch (err: any) {
      setBusinessMsg(err.message);
    } finally {
      setSavingBusiness(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserFormError('');
    setAddingUser(true);

    try {
      const res = await fetch('/api/settings/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userForm)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add user');

      setIsAddUserOpen(false);
      setUserForm({ name: '', email: '', password: '', role: 'Staff' });
      fetchUsers();
    } catch (err: any) {
      setUserFormError(err.message);
    } finally {
      setAddingUser(false);
    }
  };

  const toggleUserStatus = async (targetUser: User) => {
    const nextStatus = targetUser.status === 'active' ? 'disabled' : 'active';
    try {
      const res = await fetch(`/api/settings/users/${targetUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      });
      if (res.ok) fetchUsers();
    } catch (e) {
      console.error(e);
    }
  };

  if (user?.role !== 'Admin') {
    return (
      <div className="py-20 text-center space-y-3">
        <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-white">Administrator Access Required</h2>
        <p className="text-xs text-slate-400">Only system administrators are authorized to configure business policies and permissions.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">System Settings</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Configure business metadata, currency, tax rules, negative inventory policies, and user accounts.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setTab('business')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            tab === 'business' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Business Profile
        </button>

        <button
          onClick={() => setTab('inventory')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            tab === 'inventory' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Boxes className="w-4 h-4" />
          Inventory Policies
        </button>

        <button
          onClick={() => setTab('users')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            tab === 'users' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          User Management (RBAC)
        </button>
      </div>

      {/* TAB 1: BUSINESS PROFILE */}
      {tab === 'business' && (
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm max-w-2xl">
          <form onSubmit={handleSaveBusiness} className="space-y-4">
            {businessMsg && (
              <div className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs">
                {businessMsg}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Company / Business Name</label>
              <input
                type="text"
                required
                value={businessData.name || ''}
                onChange={(e) => setBusinessData({ ...businessData, name: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Business Email</label>
                <input
                  type="email"
                  required
                  value={businessData.email || ''}
                  onChange={(e) => setBusinessData({ ...businessData, email: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Business Phone</label>
                <input
                  type="text"
                  value={businessData.phone || ''}
                  onChange={(e) => setBusinessData({ ...businessData, phone: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Address</label>
              <input
                type="text"
                value={businessData.address || ''}
                onChange={(e) => setBusinessData({ ...businessData, address: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Currency Symbol</label>
                <select
                  value={businessData.currency || '$'}
                  onChange={(e) => setBusinessData({ ...businessData, currency: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold"
                >
                  <option value="$">$ (USD - United States Dollar)</option>
                  <option value="€">€ (EUR - Euro)</option>
                  <option value="£">£ (GBP - British Pound)</option>
                  <option value="₹">₹ (INR - Indian Rupee)</option>
                  <option value="¥">¥ (JPY/CNY - Yen/Yuan)</option>
                  <option value="A$">A$ (AUD - Australian Dollar)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Default POS Tax Rate (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={businessData.default_tax_rate ?? 10}
                  onChange={(e) => setBusinessData({ ...businessData, default_tax_rate: Number(e.target.value) })}
                  className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={savingBusiness}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-md shadow-indigo-600/20"
              >
                <Save className="w-4 h-4" />
                {savingBusiness ? 'Saving Changes...' : 'Save Profile Changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 2: INVENTORY POLICIES */}
      {tab === 'inventory' && (
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm max-w-2xl">
          <form onSubmit={handleSaveBusiness} className="space-y-6">
            {businessMsg && (
              <div className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs">
                {businessMsg}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Default Minimum Stock Level</label>
              <input
                type="number"
                value={businessData.default_min_stock ?? 10}
                onChange={(e) => setBusinessData({ ...businessData, default_min_stock: Number(e.target.value) })}
                className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              />
              <p className="text-[11px] text-slate-500 mt-1">Default threshold for low-stock automated warnings when creating products.</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-white">Allow Negative Inventory</h4>
                <p className="text-[11px] text-slate-400 mt-0.5 max-w-md leading-relaxed">
                  When enabled, POS sales can proceed even if available stock is zero. When disabled, sales below stock are strictly blocked.
                </p>
              </div>
              <input
                type="checkbox"
                checked={businessData.allow_negative_inventory === 1}
                onChange={(e) => setBusinessData({ ...businessData, allow_negative_inventory: e.target.checked ? 1 : 0 })}
                className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
              />
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={savingBusiness}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-md shadow-indigo-600/20"
              >
                <Save className="w-4 h-4" />
                {savingBusiness ? 'Saving Changes...' : 'Save Inventory Policies'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: USER MANAGEMENT */}
      {tab === 'users' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-white">Active System Users ({usersList.length})</h3>
            <button
              onClick={() => setIsAddUserOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-md shadow-indigo-600/20"
            >
              <Plus className="w-4 h-4" /> Add User
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                    <th className="py-3.5 px-4">User Name</th>
                    <th className="py-3.5 px-4">Email</th>
                    <th className="py-3.5 px-4">Assigned Role</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {loadingUsers ? (
                    <tr><td colSpan={5} className="py-8 text-center text-slate-400">Loading user accounts...</td></tr>
                  ) : usersList.map((u) => (
                    <tr key={u.id}>
                      <td className="py-3.5 px-4 font-bold text-white">{u.name}</td>
                      <td className="py-3.5 px-4 text-slate-400">{u.email}</td>
                      <td className="py-3.5 px-4 font-semibold text-indigo-400">{u.role}</td>
                      <td className="py-3.5 px-4"><Badge status={u.status} /></td>
                      <td className="py-3.5 px-4 text-right">
                        {u.id !== user?.id && (
                          <button
                            onClick={() => toggleUserStatus(u)}
                            className="px-3 py-1 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300"
                          >
                            {u.status === 'active' ? 'Disable User' : 'Enable User'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      <Modal
        isOpen={isAddUserOpen}
        onClose={() => setIsAddUserOpen(false)}
        title="Add System User"
        maxWidth="md"
      >
        <form onSubmit={handleAddUser} className="space-y-4">
          {userFormError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{userFormError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Full Name *</label>
            <input
              type="text"
              required
              value={userForm.name}
              onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
              placeholder="John Doe"
              className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Email Address *</label>
            <input
              type="email"
              required
              value={userForm.email}
              onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
              placeholder="john@company.com"
              className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Initial Password *</label>
            <input
              type="password"
              required
              minLength={6}
              value={userForm.password}
              onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
              placeholder="••••••••"
              className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Role & Permissions *</label>
            <select
              value={userForm.role}
              onChange={(e: any) => setUserForm({ ...userForm, role: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-semibold"
            >
              <option value="Staff">Staff (POS Sales & Catalog View)</option>
              <option value="Manager">Manager (Manage Catalog, Purchases, Inventory, Reports)</option>
              <option value="Admin">Admin (Full System & User Management Access)</option>
            </select>
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsAddUserOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={addingUser}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500"
            >
              {addingUser ? 'Adding User...' : 'Add User'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
