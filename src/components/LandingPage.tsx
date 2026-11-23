'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { PasswordInput } from '@/components/ui/PasswordInput';
import {
  ArrowRight,
  Check,
  ChevronDown,
  Database,
  LayoutDashboard,
  Menu,
  Plus,
  ShieldCheck,
  X
} from 'lucide-react';

type CurrencyCode = 'NGN' | 'USD' | 'CAD' | 'GBP' | 'EUR';
type SandboxRole = 'admin' | 'manager' | 'staff';
type PoStage = 'none' | 'alert' | 'pending_approval';

interface AuditLogEntry {
  time: string;
  actor: string;
  tag: string;
  detailNgn: number | null;
  textTemplate: string;
}

const CURRENCY_CONFIG: Record<CurrencyCode, { symbol: string; code: CurrencyCode; decimals: number }> = {
  NGN: { symbol: '₦', code: 'NGN', decimals: 0 },
  USD: { symbol: '$', code: 'USD', decimals: 2 },
  CAD: { symbol: 'CA$', code: 'CAD', decimals: 2 },
  GBP: { symbol: '£', code: 'GBP', decimals: 2 },
  EUR: { symbol: '€', code: 'EUR', decimals: 2 }
};

const BASE_PRICES_NGN = {
  starterMonthly: 4999,
  starterYearly: 59999,
  growthMonthly: 24999,
  growthYearly: 239990,
  growthYearlyFull: 299988,
  multiMonthly: 49900,
  multiYearly: 479040,
  multiYearlyFull: 598800,
  multiYearlySavings: 119760,
  bonus1: 60000,
  bonus2: 40000,
  bonus3: 50000,
  bonusTotal: 150000
};

const INITIAL_LOGS: AuditLogEntry[] = [
  {
    time: 'Just now',
    actor: 'Register #01',
    tag: 'POS SALE',
    detailNgn: 30000,
    textTemplate: 'POS Checkout #8841 — 2x Thermal Paper Rolls ({AMOUNT})'
  },
  {
    time: '14m ago',
    actor: 'Manager',
    tag: 'GRN IN',
    detailNgn: null,
    textTemplate: 'Verified Supplier Delivery GRN #112 (+40 units added)'
  },
  {
    time: '42m ago',
    actor: 'Admin',
    tag: 'AUDIT',
    detailNgn: null,
    textTemplate: 'Locked Staff role permissions on Wholesale Cost Ledger'
  }
];

const FAQS = [
  {
    q: 'What happens if my internet goes off during a busy Saturday rush?',
    a: "Your counter never stops. Kiralyte's POS terminal caches your active product catalog locally and queues every offline checkout and stock deduction on your device. The moment your connection returns, every sale syncs automatically to the cloud ledger."
  },
  {
    q: 'Do I need to buy special Kiralyte hardware or proprietary terminals?',
    a: 'Zero proprietary hardware required. Kiralyte runs directly in any modern browser on Windows laptops, Android tablets, iPads, or MacBooks, and works plug-and-play with standard USB/Bluetooth barcode scanners and 58mm/80mm thermal receipt printers.'
  },
  {
    q: 'Can my cashiers delete completed sales or alter stock numbers?',
    a: "No. Under Kiralyte's Role-Based Lockdown, Staff accounts can only scan items, accept approved payment methods, and print receipts. Wholesale cost prices, net profit margins, inventory adjustments, and void/refund approvals are strictly locked to Manager and Admin credentials—and every action is recorded in an immutable audit log."
  },
  {
    q: 'How fast can I import 2,000+ existing products from Excel?',
    a: 'Under 2 minutes with our 1-click CSV/Excel importer—or let our onboarding engineers do it completely free as part of Bonus #1 when you activate your workspace during the Founders Launch Window.'
  },
  {
    q: 'How does the multi-currency pricing work for international branches?',
    a: "All subscription plans are anchored to our Naira base rates (₦4,999/mo Starter, ₦24,999/mo Growth, ₦49,900/mo Multi-Branch) and converted at the exact live FX equivalent in USD, CAD, GBP, or EUR. Inside your POS dashboard, you can also configure your store's local selling currency for customer receipts and tax reporting."
  }
];

function detectInitialCurrency(): CurrencyCode {
  if (typeof window === 'undefined') return 'NGN';
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    const lang = (navigator.language || '').toUpperCase();
    if (tz.includes('Lagos') || tz.includes('Africa') || lang.includes('NG')) return 'NGN';
    if (tz.includes('Toronto') || tz.includes('Vancouver') || lang.includes('CA')) return 'CAD';
    if (tz.includes('London') || lang.includes('GB')) return 'GBP';
    if (tz.includes('Europe/')) return 'EUR';
    if (tz.includes('America/')) return 'USD';
  } catch {
    // Fallback to NGN
  }
  return 'NGN';
}

export const LandingPage: React.FC = () => {
  const { user, login } = useAuth();

  // Currency & Pricing state
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyCode>('NGN');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [fxRatesFromNgn, setFxRatesFromNgn] = useState<Record<CurrencyCode, number>>({
    NGN: 1,
    USD: 1 / 1500,
    CAD: 1 / 1080,
    GBP: 1 / 1920,
    EUR: 1 / 1630
  });
  const [fxSourceLabel, setFxSourceLabel] = useState('Exact live currency equivalent of NGN base pricing');

  // Mobile Menu & FAQ
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Live Interactive Sandbox
  const [role, setRole] = useState<SandboxRole>('admin');
  const [revenueNgn, setRevenueNgn] = useState(285000);
  const [salesCount, setSalesCount] = useState(38);
  const [skuStock, setSkuStock] = useState(7);
  const [poStage, setPoStage] = useState<PoStage>('none');
  const [logs, setLogs] = useState<AuditLogEntry[]>(INITIAL_LOGS);
  const [reseeding, setReseeding] = useState(false);

  // Auth Modal (wired to real /api/auth/login and /api/auth/signup)
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'register' | 'signin'>('register');
  const [selectedPlan, setSelectedPlan] = useState('Growth');
  const [bizName, setBizName] = useState('');
  const [fullName, setFullName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);

  // Toast
  const [toastMsg, setToastMsg] = useState('');

  const skuSellNgn = 15000;
  const skuCostNgn = 9240;

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((curr) => (curr === msg ? '' : curr));
    }, 3600);
  };

  useEffect(() => {
    let active = true;
    const detected = detectInitialCurrency();
    Promise.resolve().then(() => {
      if (active) setSelectedCurrency(detected);
    });

    fetch('https://open.er-api.com/v6/latest/NGN')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('FX failed'))))
      .then((data) => {
        if (!active || !data?.rates) return;
        setFxRatesFromNgn((prev) => {
          const next = {
            NGN: 1,
            USD: data.rates.USD || prev.USD,
            CAD: data.rates.CAD || prev.CAD,
            GBP: data.rates.GBP || prev.GBP,
            EUR: data.rates.EUR || prev.EUR
          };
          setFxSourceLabel(`Live FX rate synced (1 USD = ₦${Math.round(1 / next.USD).toLocaleString()})`);
          return next;
        });
      })
      .catch(() => {
        // Keep fallback rates
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModalOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const formatFromNgn = (amountNgn: number, forceDecimals: number | null = null) => {
    const cfg = CURRENCY_CONFIG[selectedCurrency];
    const rate = fxRatesFromNgn[selectedCurrency] || 1;
    const converted = amountNgn * rate;
    const decimals = forceDecimals !== null ? forceDecimals : cfg.decimals;
    const formatted = converted.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
    return `${cfg.symbol}${formatted}`;
  };

  const anchor29Formatted =
    selectedCurrency === 'USD' ? '$29.00' : formatFromNgn(29 / fxRatesFromNgn.USD);

  const simulatePosSale = () => {
    if (skuStock <= 0) {
      showToast('Stock is at 0! Click Approve PO to restock SKU-104.');
      return;
    }
    const nextStock = skuStock - 1;
    setSkuStock(nextStock);
    setSalesCount((c) => c + 1);
    setRevenueNgn((r) => r + skuSellNgn);
    if (nextStock <= 5 && poStage === 'none') {
      setPoStage('alert');
    }
    const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
    setLogs((prev) => [
      {
        time: 'Just now',
        actor: `${roleLabel} (You)`,
        tag: 'POS SALE',
        detailNgn: skuSellNgn,
        textTemplate: `Sold 1x SKU-104 Scanner Pro ({AMOUNT}) — Stock deducted to ${nextStock} units`
      },
      ...prev
    ]);
    showToast(`POS Sale recorded (${formatFromNgn(skuSellNgn)})! Stock updated to ${nextStock} units.`);
  };

  const handlePoWorkflowStep = () => {
    const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
    if (poStage === 'alert') {
      setPoStage('pending_approval');
      setLogs((prev) => [
        {
          time: 'Just now',
          actor: `${roleLabel} (You)`,
          tag: 'PO DRAFT',
          detailNgn: skuCostNgn * 25,
          textTemplate: 'Generated Replenishment PO #412 for +25 units ({AMOUNT})'
        },
        ...prev
      ]);
      showToast('Draft PO #412 created! Click "Approve PO #412" to receive stock.');
    } else if (poStage === 'pending_approval') {
      if (role === 'staff') {
        showToast('Role Lockdown: Staff cannot approve POs. Switch to Admin or Manager!');
        return;
      }
      const nextStock = skuStock + 25;
      setSkuStock(nextStock);
      setPoStage('none');
      setLogs((prev) => [
        {
          time: 'Just now',
          actor: `${roleLabel} (You)`,
          tag: 'PO APPROVED',
          detailNgn: null,
          textTemplate: `PO #412 Approved & Received — +25 units added (Total: ${nextStock} units)`
        },
        ...prev
      ]);
      showToast(`PO #412 approved & received! SKU-104 stock replenished to ${nextStock} units.`);
    }
  };

  const reseedSandbox = () => {
    setReseeding(true);
    setTimeout(() => {
      setReseeding(false);
      setRevenueNgn(285000);
      setSalesCount(38);
      setSkuStock(7);
      setPoStage('none');
      setLogs([
        {
          time: 'Just now',
          actor: 'System Seed',
          tag: 'RESET',
          detailNgn: null,
          textTemplate: 'Demo POS ledger, SKU balances & PO queues freshly seeded'
        },
        ...INITIAL_LOGS.slice(1)
      ]);
      showToast('Demo POS sales, SKU stock & PO workflows freshly seeded!');
    }, 450);
  };

  const openAuthModal = (mode: 'register' | 'signin' = 'register', plan = 'Growth') => {
    setModalMode(mode);
    setSelectedPlan(plan);
    setAuthError('');
    setModalOpen(true);
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSubmitting(true);

    try {
      if (modalMode === 'register') {
        const res = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            businessName: bizName,
            name: fullName,
            email: authEmail,
            password: authPassword
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Registration failed');
        setModalOpen(false);
        login(data.token, data.user);
      } else {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: authEmail, password: authPassword })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Login failed');
        setModalOpen(false);
        login(data.token, data.user);
      }
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const roleEmailMap: Record<SandboxRole, string> = {
    admin: 'admin@demo.com',
    manager: 'manager@demo.com',
    staff: 'staff@demo.com'
  };

  return (
    <div className="min-h-screen bg-[#090A14] text-white antialiased selection:bg-[#583DF2] selection:text-white overflow-x-hidden">
      {/* 1. STICKY TOP LAUNCH SCARCITY BANNER & NAVBAR */}
      <div className="sticky top-0 z-50">
        <div className="border-b border-[#583DF2]/40 bg-gradient-to-r from-[#131033] via-[#1C164D] to-[#131033] px-4 py-2 text-center">
          <p className="mx-auto flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[11px] font-semibold tracking-wide text-slate-200 sm:text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#10B981]/20 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-[#10B981]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#10B981] animate-ping" />
              FOUNDERS LAUNCH WINDOW
            </span>
            <span>
              Lock in early-adopter pricing before standard{' '}
              <span className="font-mono font-bold text-white">{anchor29Formatted}/mo</span> equivalent rates take effect —
            </span>
            <span className="font-mono font-bold text-[#F59E0B]">Only 17 founder spots remaining this month.</span>
          </p>
        </div>

        <header className="border-b border-[#1E2235] bg-[#090A14]/90 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
            <Link href="/" className="group flex items-center gap-3 focus:outline-none">
              <img
                src="/kiralyte-icon.png"
                alt="Kiralyte"
                className="h-10 w-10 rounded-xl object-contain shadow-[0_0_18px_rgba(88,61,242,0.35)] transition-transform duration-200 group-hover:scale-105"
              />
              <div className="flex flex-col">
                <span className="text-xl font-black tracking-tight text-white">Kiralyte</span>
                <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-[#818CF8]">
                  POS &amp; INVENTORY
                </span>
              </div>
            </Link>

            <nav className="hidden items-center gap-7 lg:flex" aria-label="Primary Navigation">
              <a href="#profit-leak" className="text-sm font-medium text-slate-300 transition-colors hover:text-white">
                The Profit Leak
              </a>
              <a href="#live-sandbox" className="text-sm font-medium text-slate-300 transition-colors hover:text-white">
                Live Sandbox
              </a>
              <a href="#role-control" className="text-sm font-medium text-slate-300 transition-colors hover:text-white">
                Role Control
              </a>
              <a href="#launch-offer" className="text-sm font-medium text-slate-300 transition-colors hover:text-white">
                Launch Offer
              </a>
            </nav>

            <div className="hidden items-center gap-3 md:flex">
              <div className="relative">
                <select
                  aria-label="Select Currency"
                  value={selectedCurrency}
                  onChange={(e) => setSelectedCurrency(e.target.value as CurrencyCode)}
                  className="cursor-pointer appearance-none rounded-xl border border-[#1E2235] bg-[#0F111E] py-2 pl-3 pr-7 font-mono text-xs font-semibold text-slate-200 transition-colors hover:border-[#583DF2]/60 focus:border-[#583DF2] focus:outline-none"
                >
                  <option value="NGN">NGN (₦)</option>
                  <option value="USD">USD ($)</option>
                  <option value="CAD">CAD (CA$)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="EUR">EUR (€)</option>
                </select>
                <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              </div>

              {user ? (
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#583DF2] to-[#6D4AFF] px-5 py-2.5 text-sm font-bold text-white shadow-[0_0_18px_rgba(88,61,242,0.35)] transition-all hover:brightness-110"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  <span>Go to Dashboard</span>
                </Link>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => openAuthModal('signin')}
                    className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-300 transition-colors hover:bg-[#0F111E] hover:text-white"
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => openAuthModal('register', 'Growth')}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#583DF2] to-[#6D4AFF] px-5 py-2.5 text-sm font-bold text-white shadow-[0_0_18px_rgba(88,61,242,0.35)] transition-all duration-200 hover:brightness-110 active:scale-[0.99]"
                  >
                    <span>Claim Founder Rate</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Toggle Menu"
              className="inline-flex items-center justify-center rounded-xl border border-[#1E2235] bg-[#0F111E] p-2.5 text-slate-300 hover:text-white md:hidden"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>

          {mobileMenuOpen && (
            <div className="border-t border-[#1E2235] bg-[#0F111E] px-4 py-5 md:hidden">
              <div className="flex flex-col space-y-2.5">
                <a href="#profit-leak" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-3 py-2.5 text-sm font-medium text-slate-300 hover:bg-[#181C30] hover:text-white">
                  The Profit Leak
                </a>
                <a href="#live-sandbox" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-3 py-2.5 text-sm font-medium text-slate-300 hover:bg-[#181C30] hover:text-white">
                  Live Sandbox
                </a>
                <a href="#role-control" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-3 py-2.5 text-sm font-medium text-slate-300 hover:bg-[#181C30] hover:text-white">
                  Role Control
                </a>
                <a href="#launch-offer" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-3 py-2.5 text-sm font-medium text-slate-300 hover:bg-[#181C30] hover:text-white">
                  Launch Offer
                </a>
                <div className="pt-2">
                  <label className="block px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Display Currency
                  </label>
                  <select
                    value={selectedCurrency}
                    onChange={(e) => setSelectedCurrency(e.target.value as CurrencyCode)}
                    className="mt-1.5 w-full rounded-xl border border-[#1E2235] bg-[#090A14] px-3 py-2.5 font-mono text-xs font-semibold text-white"
                  >
                    <option value="NGN">NGN (₦) — Nigerian Naira</option>
                    <option value="USD">USD ($) — US Dollar</option>
                    <option value="CAD">CAD (CA$) — Canadian Dollar</option>
                    <option value="GBP">GBP (£) — British Pound</option>
                    <option value="EUR">EUR (€) — Euro</option>
                  </select>
                </div>
                <div className="flex flex-col gap-2.5 border-t border-[#1E2235] pt-3">
                  {user ? (
                    <Link
                      href="/dashboard"
                      className="w-full rounded-xl bg-gradient-to-r from-[#583DF2] to-[#6D4AFF] py-3 text-center text-sm font-bold text-white"
                    >
                      Go to Dashboard →
                    </Link>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setMobileMenuOpen(false);
                          openAuthModal('signin');
                        }}
                        className="w-full rounded-xl border border-[#1E2235] bg-[#090A14] py-3 text-center text-sm font-semibold text-white"
                      >
                        Sign In
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMobileMenuOpen(false);
                          openAuthModal('register', 'Growth');
                        }}
                        className="w-full rounded-xl bg-gradient-to-r from-[#583DF2] to-[#6D4AFF] py-3 text-center text-sm font-bold text-white"
                      >
                        Claim Founder Rate →
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </header>
      </div>

      {/* 2. HERO + 3. LIVE SANDBOX */}
      <section
        className="relative border-b border-[#1E2235] pt-14 pb-20 sm:pt-20 sm:pb-28"
        style={{
          backgroundImage:
            'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(88, 61, 242, 0.22) 0%, rgba(9, 10, 20, 0) 70%), radial-gradient(circle at 85% 20%, rgba(16, 185, 129, 0.08) 0%, transparent 45%), linear-gradient(to right, rgba(30, 34, 53, 0.35) 1px, transparent 1px), linear-gradient(to bottom, rgba(30, 34, 53, 0.35) 1px, transparent 1px)',
          backgroundSize: '100% 100%, 100% 100%, 52px 52px, 52px 52px'
        }}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#583DF2]/40 bg-[#0F111E]/90 px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-[#818CF8] shadow-[0_0_18px_rgba(88,61,242,0.35)]">
              <span className="h-2 w-2 rounded-full bg-[#10B981]" />
              <span>FOR RETAIL SHOPS, SUPERMARKETS, PHARMACIES &amp; MULTI-BRANCH CHAINS</span>
            </div>

            <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-[62px] lg:leading-[1.08]">
              Stop Losing{' '}
              <span className="bg-gradient-to-r from-[#818CF8] via-[#6D4AFF] to-[#10B981] bg-clip-text text-transparent">
                15% of Your Daily Revenue
              </span>{' '}
              to Stock Shrinkage, Slow Checkouts, and Blind Inventory.
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
              Kiralyte turns chaotic counters and messy spreadsheets into a locked-down, 3-second POS checkout and real-time Purchase Order engine—where every single item sold, restocked, or transferred is accounted for down to the kobo.
            </p>

            <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
              {user ? (
                <Link
                  href="/dashboard"
                  className="inline-flex w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-[#583DF2] to-[#6D4AFF] px-7 py-4 text-base font-bold text-white shadow-[0_0_32px_rgba(88,61,242,0.45)] transition-all hover:brightness-110 sm:w-auto"
                >
                  <span>Open Your Live Workspace</span>
                  <ArrowRight className="h-5 w-5" />
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => openAuthModal('register', 'Growth')}
                  className="inline-flex w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-[#583DF2] to-[#6D4AFF] px-7 py-4 text-base font-bold text-white shadow-[0_0_32px_rgba(88,61,242,0.45)] transition-all hover:brightness-110 active:scale-[0.99] sm:w-auto"
                >
                  <span>Start Your 14-Day Free Trial — No Card Needed</span>
                  <ArrowRight className="h-5 w-5" />
                </button>
              )}
              <a
                href="#live-sandbox"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#1E2235] bg-[#0F111E] px-7 py-4 text-base font-semibold text-slate-200 transition-all hover:border-[#583DF2]/60 hover:bg-[#131626] hover:text-white sm:w-auto"
              >
                <span>Test Live Sandbox Below ↓</span>
              </a>
            </div>

            <div className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-semibold text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <Check className="h-4 w-4 text-[#10B981]" />
                Works Offline
              </span>
              <span className="text-slate-600">•</span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="h-4 w-4 text-[#10B981]" />
                Any Barcode Scanner &amp; Thermal Printer
              </span>
              <span className="text-slate-600">•</span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="h-4 w-4 text-[#10B981]" />
                Setup in Under 12 Minutes
              </span>
            </div>
          </div>

          {/* 3. INTERACTIVE LIVE APP SANDBOX */}
          <div id="live-sandbox" className="mx-auto mt-14 max-w-5xl scroll-mt-28">
            <div className="overflow-hidden rounded-2xl border border-[#1E2235] bg-gradient-to-b from-[#0F111E]/95 to-[#0B0D18]/98 shadow-[0_24px_60px_rgba(0,0,0,0.65)] backdrop-blur-md">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1E2235] bg-[#0B0C17] px-4 py-3 sm:px-6">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-rose-500/80" />
                  <span className="h-3 w-3 rounded-full bg-amber-400/80" />
                  <span className="h-3 w-3 rounded-full bg-emerald-500/80" />
                  <span className="ml-2 rounded-lg border border-[#1E2235] bg-[#090A14] px-3 py-1 font-mono text-[11px] text-slate-400">
                    kiralyte.app/sandbox
                  </span>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#10B981]/15 px-2.5 py-1 font-mono text-[11px] font-semibold text-[#10B981]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#10B981] animate-pulse" />
                  CLOSED-LOOP LIVE SYNC
                </span>
              </div>

              <div className="p-5 sm:p-7">
                <div className="flex flex-col justify-between gap-4 border-b border-[#1E2235] pb-5 sm:flex-row sm:items-center">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <ShieldCheck className="h-5 w-5 text-[#818CF8]" />
                    <span className="text-xs font-extrabold uppercase tracking-wider text-[#818CF8]">DEMO ACCOUNTS</span>
                    <span className="rounded-lg border border-[#1E2235] bg-[#090A14] px-2.5 py-1 font-mono text-xs text-slate-300">
                      {roleEmailMap[role]}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={reseedSandbox}
                    className="inline-flex items-center gap-2 self-start rounded-xl border border-[#10B981]/50 bg-[#10B981]/10 px-3.5 py-2 text-xs font-bold text-[#10B981] shadow-[0_0_20px_rgba(16,185,129,0.25)] transition-all hover:bg-[#10B981]/20 active:scale-[0.98] sm:self-auto"
                  >
                    <Database className={`h-4 w-4 transition-transform duration-500 ${reseeding ? 'rotate-180' : ''}`} />
                    <span>{reseeding ? 'Seeding Demo Data...' : 'Re-Seed Demo Data'}</span>
                  </button>
                </div>

                <div className="mt-5 grid grid-cols-3 gap-3" role="tablist" aria-label="Sandbox Role Switcher">
                  {(['admin', 'manager', 'staff'] as SandboxRole[]).map((r) => {
                    const active = role === r;
                    return (
                      <button
                        key={r}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => setRole(r)}
                        className={
                          active
                            ? 'rounded-xl border border-[#583DF2] bg-[#583DF2]/25 py-3 px-2 sm:px-4 text-xs sm:text-sm font-bold capitalize text-white shadow-[0_0_18px_rgba(88,61,242,0.35)] transition-all'
                            : 'rounded-xl border border-[#1E2235] bg-[#090A14] py-3 px-2 sm:px-4 text-xs sm:text-sm font-bold capitalize text-slate-400 transition-all hover:border-[#583DF2]/40 hover:text-white'
                        }
                      >
                        {r}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-5 flex flex-col justify-between gap-3 rounded-xl border border-[#1E2235] bg-[#090A14] px-4 py-3 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={
                        role === 'admin'
                          ? 'rounded-md bg-[#583DF2]/20 px-2.5 py-0.5 font-mono text-[11px] font-bold text-[#818CF8]'
                          : role === 'manager'
                          ? 'rounded-md bg-purple-500/20 px-2.5 py-0.5 font-mono text-[11px] font-bold text-purple-300'
                          : 'rounded-md bg-sky-500/20 px-2.5 py-0.5 font-mono text-[11px] font-bold text-sky-300'
                      }
                    >
                      {role.toUpperCase()} VIEW
                    </span>
                    <p className="text-xs text-slate-300">
                      {role === 'admin'
                        ? 'Full ledger access: Wholesale cost prices, net profit margins & PO approvals unlocked.'
                        : role === 'manager'
                        ? 'Floor & Stock Ops: PO generation, GRN receiving & shift reconciliations unlocked.'
                        : 'Counter Lockdown Active: Wholesale cost prices, profit margins & PO approvals are hidden.'}
                    </p>
                  </div>
                  <span className="font-mono text-[11px] text-slate-400">
                    Try clicking <strong className="text-white">Simulate 1-Click POS Sale</strong> →
                  </span>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border border-[#1E2235] bg-[#090A14] p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-400">Today&apos;s POS Revenue</span>
                      <span className="rounded bg-[#10B981]/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#10B981]">LIVE</span>
                    </div>
                    <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-white">{formatFromNgn(revenueNgn)}</p>
                    <p className="mt-1 text-xs font-medium text-[#10B981]">{salesCount} completed checkouts</p>
                  </div>

                  <div
                    className={
                      skuStock <= 5
                        ? 'rounded-xl border border-[#F59E0B]/60 bg-[#1A140B] p-4 transition-colors'
                        : 'rounded-xl border border-[#1E2235] bg-[#090A14] p-4 transition-colors'
                    }
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-400">SKU-104: Scanner Pro</span>
                      <span
                        className={
                          skuStock <= 5
                            ? 'rounded bg-[#F59E0B]/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#F59E0B]'
                            : 'rounded bg-[#10B981]/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#10B981]'
                        }
                      >
                        {skuStock <= 5 ? 'LOW STOCK' : 'IN STOCK'}
                      </span>
                    </div>
                    <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-white">{skuStock} Units</p>
                    <p className="mt-1 text-xs text-slate-400">
                      Reorder alert triggers at <span className="font-mono text-slate-200">5 units</span>
                    </p>
                  </div>

                  <div className="rounded-xl border border-[#1E2235] bg-[#090A14] p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-400">Net Profit Margin</span>
                      <span
                        className={
                          role === 'staff'
                            ? 'rounded bg-rose-500/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-rose-400'
                            : 'rounded bg-[#583DF2]/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#818CF8]'
                        }
                      >
                        {role === 'staff' ? 'LOCKED' : 'VISIBLE'}
                      </span>
                    </div>
                    <p
                      className={
                        role === 'staff'
                          ? 'mt-2 font-mono text-2xl font-bold tabular-nums text-slate-500'
                          : 'mt-2 font-mono text-2xl font-bold tabular-nums text-[#10B981]'
                      }
                    >
                      {role === 'staff' ? '••.•%' : '38.4%'}
                    </p>
                    <p className="mt-1 font-mono text-xs text-slate-400">
                      {role === 'staff'
                        ? `Sell Price: ${formatFromNgn(skuSellNgn)} (Cost hidden)`
                        : `Cost: ${formatFromNgn(skuCostNgn)} | Sell: ${formatFromNgn(skuSellNgn)}`}
                    </p>
                  </div>

                  <div className="rounded-xl border border-[#1E2235] bg-[#090A14] p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-400">PO Replenishment</span>
                      <span
                        className={
                          poStage === 'alert'
                            ? 'rounded bg-[#F59E0B]/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#F59E0B]'
                            : poStage === 'pending_approval'
                            ? 'rounded bg-[#583DF2]/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#818CF8]'
                            : 'rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-300'
                        }
                      >
                        {poStage === 'alert' ? 'REORDER ALERT' : poStage === 'pending_approval' ? 'AWAITING APPROVAL' : 'STANDBY'}
                      </span>
                    </div>
                    <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-white">
                      {poStage === 'alert' ? '1 Alert Active' : poStage === 'pending_approval' ? 'PO #412 Draft' : '0 Open POs'}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {poStage === 'alert'
                        ? 'SKU-104 hit reorder threshold'
                        : poStage === 'pending_approval'
                        ? '+25 units ready to receive'
                        : 'Auto-triggers at ≤ 5 units'}
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex flex-col justify-between gap-4 rounded-xl border border-[#583DF2]/40 bg-gradient-to-r from-[#12142B] to-[#0F111E] p-4 lg:flex-row lg:items-center">
                  <div>
                    <p className="text-sm font-bold text-white">Interactive POS &amp; Auto-PO Loop</p>
                    <p className="text-xs text-slate-300">
                      Click <strong className="text-white">Simulate 1-Click POS Sale</strong> (
                      <span className="font-mono text-[#10B981]">{formatFromNgn(skuSellNgn)}</span>) twice to drop stock to 5 units and trigger an automated Low-Stock PO alert.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={simulatePosSale}
                      className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#583DF2] to-[#6D4AFF] px-4 py-2.5 text-xs font-bold text-white shadow-[0_0_18px_rgba(88,61,242,0.35)] transition-all hover:brightness-110 active:scale-[0.98]"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Simulate 1-Click POS Sale</span>
                    </button>

                    {poStage !== 'none' && (
                      <button
                        type="button"
                        onClick={handlePoWorkflowStep}
                        className={
                          poStage === 'alert'
                            ? 'inline-flex items-center gap-2 rounded-xl border border-[#F59E0B] bg-[#F59E0B]/15 px-4 py-2.5 text-xs font-bold text-[#F59E0B] animate-pulse transition-all hover:bg-[#F59E0B]/25'
                            : 'inline-flex items-center gap-2 rounded-xl border border-[#10B981] bg-[#10B981]/20 px-4 py-2.5 text-xs font-bold text-[#10B981] transition-all hover:bg-[#10B981]/30'
                        }
                      >
                        <span>
                          {poStage === 'alert'
                            ? 'Low Stock → 1-Click Generate PO'
                            : role === 'staff'
                            ? 'Approve PO #412 (Admin/Mgr Only)'
                            : 'Approve PO #412 (+25 Units)'}
                        </span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-5">
                  <div className="mb-2.5 flex items-center justify-between">
                    <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Live Immutable Audit Feed
                    </span>
                    <span className="font-mono text-[11px] text-slate-500">Every scan &amp; PO logged with user ID</span>
                  </div>
                  <div className="space-y-2">
                    {logs.slice(0, 4).map((entry, idx) => {
                      const text =
                        entry.detailNgn !== null
                          ? entry.textTemplate.replace('{AMOUNT}', formatFromNgn(entry.detailNgn))
                          : entry.textTemplate;
                      return (
                        <div
                          key={idx}
                          className="flex flex-col justify-between gap-1.5 rounded-xl border border-[#1E2235] bg-[#090A14] px-4 py-2.5 sm:flex-row sm:items-center"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="rounded bg-[#131626] px-2 py-0.5 font-mono text-[10px] font-bold text-[#818CF8]">
                              {entry.tag}
                            </span>
                            <span className="text-xs font-medium text-slate-200">{text}</span>
                          </div>
                          <div className="flex items-center gap-2 font-mono text-[11px] text-slate-500">
                            <span>{entry.actor}</span>
                            <span>•</span>
                            <span>{entry.time}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. COST OF INACTION COMPARISON */}
      <section id="profit-leak" className="scroll-mt-24 border-b border-[#1E2235] py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-rose-500/30 bg-rose-500/10 px-3.5 py-1 font-mono text-xs font-bold uppercase tracking-wider text-rose-400">
              THE SILENT PROFIT BLEED
            </span>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl">
              Every Month Without Real-Time Stock Control Costs More Than a Year of Kiralyte
            </h2>
            <p className="mt-4 text-base text-slate-400">
              Compare what happens at your counter today versus running on a closed-loop POS and Purchase Order ledger.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-8 lg:grid-cols-2">
            <div className="rounded-2xl border border-rose-500/30 bg-[#0F111E] p-7 sm:p-9">
              <div className="flex items-center justify-between border-b border-[#1E2235] pb-5">
                <div>
                  <span className="font-mono text-xs font-bold uppercase tracking-wider text-rose-400">THE OLD WAY</span>
                  <h3 className="mt-1 text-xl font-extrabold text-white">Running Blind on Notebooks, Excel, or Basic POS</h3>
                </div>
              </div>
              <ul className="mt-6 space-y-4 text-sm text-slate-300">
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-500/20 text-rose-400">✕</span>
                  <div>
                    <strong className="text-white">Unexplained Missing Stock at Closing:</strong> Items vanish from shelves with zero record of whether they were sold, damaged, or pocketed.
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-500/20 text-rose-400">✕</span>
                  <div>
                    <strong className="text-white">Unauthorized Cashier Discounts &amp; Voids:</strong> Staff see wholesale cost prices or delete receipts without manager approval.
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-500/20 text-rose-400">✕</span>
                  <div>
                    <strong className="text-white">Dead Capital &amp; Panic Restocking:</strong> Fast-moving items stock out on busy Saturdays while slow-moving goods expire unnoticed.
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-500/20 text-rose-400">✕</span>
                  <div>
                    <strong className="text-white">Hours Wasted Reconciling Supplier Invoices:</strong> Manually matching handwritten Purchase Orders against arriving cartons.
                  </div>
                </li>
              </ul>
            </div>

            <div className="rounded-2xl border-2 border-[#10B981]/60 bg-gradient-to-b from-[#0F1820] to-[#0F111E] p-7 shadow-[0_0_20px_rgba(16,185,129,0.25)] sm:p-9">
              <div className="flex items-center justify-between border-b border-[#1E2235] pb-5">
                <div>
                  <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#10B981]">THE KIRALYTE STANDARD</span>
                  <h3 className="mt-1 text-xl font-extrabold text-white">Running on Kiralyte&apos;s Closed-Loop Engine</h3>
                </div>
              </div>
              <ul className="mt-6 space-y-4 text-sm text-slate-200">
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#10B981]/20 text-[#10B981]">✓</span>
                  <div>
                    <strong className="text-white">Real-Time Stock Deduction on Every Scan:</strong> Every checkout deducts exact quantities immediately across registers and branches.
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#10B981]/20 text-[#10B981]">✓</span>
                  <div>
                    <strong className="text-white">Strict Role Lockdown &amp; Immutable Audit Logs:</strong> Staff never see wholesale cost margins and cannot delete completed transactions.
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#10B981]/20 text-[#10B981]">✓</span>
                  <div>
                    <strong className="text-white">Automated Low-Stock → 1-Click PO Triggers:</strong> Kiralyte flags bestsellers before they hit zero and generates supplier POs in one click.
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#10B981]/20 text-[#10B981]">✓</span>
                  <div>
                    <strong className="text-white">Live Net Profit Visible From Your Phone Anywhere:</strong> Know your exact daily revenue, COGS, and net margin in real time—even when away from the store.
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 5. 3-ENGINE ARCHITECTURE */}
      <section className="border-b border-[#1E2235] bg-[#0F111E]/40 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#1E2235] bg-[#090A14] px-3.5 py-1 font-mono text-xs font-bold uppercase tracking-wider text-[#818CF8]">
              3-ENGINE ARCHITECTURE
            </span>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">
              Three Mission-Critical Systems Fused Into One Interface
            </h2>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-7 lg:grid-cols-3">
            <div className="rounded-2xl border border-[#1E2235] bg-[#090A14] p-8 transition-all hover:border-[#583DF2]/70">
              <span className="rounded-lg bg-[#583DF2]/15 px-3 py-1 font-mono text-xs font-bold text-[#818CF8]">ENGINE 01</span>
              <h3 className="mt-6 text-2xl font-extrabold text-white">3-Second POS Terminal</h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-400">
                Built for peak-hour queues. Scan barcodes or tap quick-keys, accept Cash, Card, or Transfer, and keep selling even when internet drops.
              </p>
              <ul className="mt-6 space-y-2.5 border-t border-[#1E2235] pt-5 text-xs font-semibold text-slate-300">
                <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />Cash, Card &amp; Bank Transfer checkout</li>
                <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />Offline transaction queue with automatic cloud sync</li>
                <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />Custom branded thermal receipts</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-[#1E2235] bg-[#090A14] p-8 transition-all hover:border-[#583DF2]/70">
              <span className="rounded-lg bg-[#10B981]/15 px-3 py-1 font-mono text-xs font-bold text-[#10B981]">ENGINE 02</span>
              <h3 className="mt-6 text-2xl font-extrabold text-white">Zero-Shrinkage Inventory</h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-400">
                Every unit sold, returned, or adjusted is tied to a timestamped staff audit trail. Track stock movements and thresholds effortlessly.
              </p>
              <ul className="mt-6 space-y-2.5 border-t border-[#1E2235] pt-5 text-xs font-semibold text-slate-300">
                <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />Automated unit-by-unit deduction on checkout</li>
                <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />Low-stock &amp; out-of-stock real-time alerts</li>
                <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />Staff-stamped stock count &amp; shrinkage audit logs</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-[#1E2235] bg-[#090A14] p-8 transition-all hover:border-[#583DF2]/70">
              <span className="rounded-lg bg-[#F59E0B]/15 px-3 py-1 font-mono text-xs font-bold text-[#F59E0B]">ENGINE 03</span>
              <h3 className="mt-6 text-2xl font-extrabold text-white">1-Click Purchase Orders (PO)</h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-400">
                Convert low-stock warnings into supplier Purchase Orders in seconds. Receive deliveries and auto-update stock levels and cost prices.
              </p>
              <ul className="mt-6 space-y-2.5 border-t border-[#1E2235] pt-5 text-xs font-semibold text-slate-300">
                <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />PO generation &amp; supplier tracking</li>
                <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />Instant stock replenishment on PO receipt</li>
                <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />Supplier payment &amp; balance tracking</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 6. ROLE-BASED LOCKDOWN MATRIX */}
      <section id="role-control" className="scroll-mt-24 border-b border-[#1E2235] py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#1E2235] bg-[#0F111E] px-3.5 py-1 font-mono text-xs font-bold uppercase tracking-wider text-[#818CF8]">
              ROLE-BASED LOCKDOWN MATRIX
            </span>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">
              Give Every Team Member Only the Power They Need
            </h2>
            <p className="mt-4 text-base text-slate-400">
              Your cashiers ring up sales at top speed—while your wholesale margins, supplier POs, and profit analytics stay strictly locked to leadership.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-7 lg:grid-cols-3">
            <div className="rounded-2xl border border-[#583DF2]/60 bg-[#0F111E] p-7 shadow-[0_0_18px_rgba(88,61,242,0.35)]">
              <div className="flex items-center justify-between">
                <span className="rounded-xl bg-[#583DF2]/20 px-3.5 py-1.5 font-mono text-xs font-bold text-[#818CF8]">ADMIN</span>
                <span className="font-mono text-xs font-bold text-[#10B981]">100% MASTER CONTROL</span>
              </div>
              <h3 className="mt-5 text-xl font-extrabold text-white">Business Owner &amp; Executive</h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">Complete command across P&amp;L margins, supplier approvals, and user permissions.</p>
              <ul className="mt-6 space-y-3 border-t border-[#1E2235] pt-5 text-sm text-slate-200">
                <li className="flex items-center gap-2.5"><span className="text-[#10B981]">✓</span>Full P&amp;L, COGS &amp; net profit margin analytics</li>
                <li className="flex items-center gap-2.5"><span className="text-[#10B981]">✓</span>Master product catalog &amp; pricing control</li>
                <li className="flex items-center gap-2.5"><span className="text-[#10B981]">✓</span>Final approval on supplier Purchase Orders</li>
                <li className="flex items-center gap-2.5"><span className="text-[#10B981]">✓</span>Immutable audit trail &amp; staff role lockdowns</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-[#1E2235] bg-[#0F111E] p-7">
              <div className="flex items-center justify-between">
                <span className="rounded-xl bg-purple-500/20 px-3.5 py-1.5 font-mono text-xs font-bold text-purple-300">MANAGER</span>
                <span className="font-mono text-xs font-semibold text-slate-400">FLOOR &amp; STOCK OPS</span>
              </div>
              <h3 className="mt-5 text-xl font-extrabold text-white">Branch &amp; Inventory Manager</h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">Handles daily restocks, supplier deliveries, shift reports, and register overrides.</p>
              <ul className="mt-6 space-y-3 border-t border-[#1E2235] pt-5 text-sm text-slate-300">
                <li className="flex items-center gap-2.5"><span className="text-[#10B981]">✓</span>Draft &amp; submit supplier Purchase Orders</li>
                <li className="flex items-center gap-2.5"><span className="text-[#10B981]">✓</span>Verify incoming deliveries &amp; stock counts</li>
                <li className="flex items-center gap-2.5"><span className="text-[#10B981]">✓</span>Approve refunds &amp; review daily sales</li>
                <li className="flex items-center gap-2.5 text-slate-500"><span>✕</span>Cannot alter company settings or Admin roles</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-[#1E2235] bg-[#0F111E] p-7">
              <div className="flex items-center justify-between">
                <span className="rounded-xl bg-sky-500/20 px-3.5 py-1.5 font-mono text-xs font-bold text-sky-300">STAFF</span>
                <span className="font-mono text-xs font-semibold text-slate-400">COUNTER TERMINAL ONLY</span>
              </div>
              <h3 className="mt-5 text-xl font-extrabold text-white">Cashier &amp; Sales Associate</h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">Ultra-fast checkout terminal with zero exposure to sensitive business financials.</p>
              <ul className="mt-6 space-y-3 border-t border-[#1E2235] pt-5 text-sm text-slate-300">
                <li className="flex items-center gap-2.5"><span className="text-[#10B981]">✓</span>3-second barcode checkout &amp; receipt printing</li>
                <li className="flex items-center gap-2.5"><span className="text-[#10B981]">✓</span>Live stock &amp; selling price lookup</li>
                <li className="flex items-center gap-2.5 text-slate-500"><span>✕</span>Zero access to company settings or user management</li>
                <li className="flex items-center gap-2.5 text-slate-500"><span>✕</span>Cannot create or alter Purchase Orders</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 7. GRAND SLAM LAUNCH OFFER + PRICING */}
      <section id="launch-offer" className="scroll-mt-24 border-b border-[#1E2235] bg-[#0F111E]/35 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#10B981]/40 bg-[#10B981]/10 px-4 py-1 font-mono text-xs font-bold uppercase tracking-wider text-[#10B981]">
              EARLY-BIRD FOUNDERS LAUNCH OFFER
            </span>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl">
              Lock In Discounted Launch Pricing Before Standard{' '}
              <span className="font-mono text-[#818CF8]">{anchor29Formatted}/mo</span> Rates Apply
            </h2>
            <p className="mt-4 text-base text-slate-300">
              Every plan includes your 14-day free trial, zero hardware lock-in, and all 3 Done-For-You Founder Launch Bonuses.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <div className="inline-flex items-center gap-2.5 rounded-2xl border border-[#1E2235] bg-[#090A14] px-3.5 py-2">
                <span className="text-xs font-semibold text-slate-400">Currency:</span>
                <select
                  aria-label="Pricing Currency Selector"
                  value={selectedCurrency}
                  onChange={(e) => setSelectedCurrency(e.target.value as CurrencyCode)}
                  className="cursor-pointer bg-transparent font-mono text-xs font-bold text-white focus:outline-none"
                >
                  <option value="NGN" className="bg-[#0F111E]">NGN (₦)</option>
                  <option value="USD" className="bg-[#0F111E]">USD ($)</option>
                  <option value="CAD" className="bg-[#0F111E]">CAD (CA$)</option>
                  <option value="GBP" className="bg-[#0F111E]">GBP (£)</option>
                  <option value="EUR" className="bg-[#0F111E]">EUR (€)</option>
                </select>
              </div>

              <div className="inline-flex items-center gap-2 rounded-2xl border border-[#1E2235] bg-[#090A14] p-1.5">
                <button
                  type="button"
                  onClick={() => setBillingCycle('monthly')}
                  className={
                    billingCycle === 'monthly'
                      ? 'rounded-xl bg-[#583DF2] px-4 py-2 text-xs font-bold text-white shadow-[0_0_18px_rgba(88,61,242,0.35)] transition-all'
                      : 'rounded-xl px-4 py-2 text-xs font-bold text-slate-400 transition-all hover:text-white'
                  }
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setBillingCycle('yearly')}
                  className={
                    billingCycle === 'yearly'
                      ? 'inline-flex items-center gap-2 rounded-xl bg-[#583DF2] px-4 py-2 text-xs font-bold text-white shadow-[0_0_18px_rgba(88,61,242,0.35)] transition-all'
                      : 'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold text-slate-400 transition-all hover:text-white'
                  }
                >
                  <span>Yearly</span>
                  <span className="rounded-full bg-[#10B981]/20 px-2 py-0.5 font-mono text-[10px] font-bold text-[#10B981]">
                    Save 20%
                  </span>
                </button>
              </div>
            </div>

            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#1E2235] bg-[#090A14]/90 px-3.5 py-1 text-[11px] text-slate-400">
              <span className="h-2 w-2 rounded-full bg-[#10B981]" />
              <span className="font-mono">
                {selectedCurrency === 'NGN'
                  ? 'Showing native Naira (₦) Founders Launch rates'
                  : `${fxSourceLabel} — exact conversion from NGN base rates`}
              </span>
            </div>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-8 lg:grid-cols-3">
            {/* STARTER */}
            <div className="flex flex-col justify-between rounded-2xl border border-[#1E2235] bg-[#0F111E] p-8">
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-extrabold text-white">Starter</h3>
                  <span className="rounded-full bg-[#10B981]/15 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase text-[#10B981]">
                    88% Launch Savings
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-slate-400">Single-Register Shops &amp; Boutiques</p>

                <div className="mt-5 flex items-center gap-2 text-xs">
                  <span className="text-slate-500">Standard Retail:</span>
                  <span className="font-mono font-semibold text-slate-500 line-through">{anchor29Formatted}/mo</span>
                </div>

                <div className="mt-1.5 flex items-baseline gap-1.5">
                  <span className="font-mono text-4xl font-black tabular-nums tracking-tight text-white">
                    {formatFromNgn(billingCycle === 'monthly' ? BASE_PRICES_NGN.starterMonthly : BASE_PRICES_NGN.starterYearly)}
                  </span>
                  <span className="text-sm font-semibold text-slate-400">
                    {billingCycle === 'monthly' ? '/month' : '/year'}
                  </span>
                </div>
                <p className="mt-1.5 font-mono text-[11px] text-slate-400">
                  {billingCycle === 'monthly'
                    ? `Or ${formatFromNgn(BASE_PRICES_NGN.starterYearly)}/year billed annually`
                    : `Equivalent to ${formatFromNgn(BASE_PRICES_NGN.starterYearly / 12)}/mo billed annually`}
                </p>

                <ul className="mt-7 space-y-3 border-t border-[#1E2235] pt-6 text-sm text-slate-300">
                  <li className="flex items-center gap-2.5"><span className="text-[#10B981]">✓</span>1 POS Register / Checkout Terminal</li>
                  <li className="flex items-center gap-2.5"><span className="text-[#10B981]">✓</span>Real-Time Inventory Tracking (Up to 2,500 SKUs)</li>
                  <li className="flex items-center gap-2.5"><span className="text-[#10B981]">✓</span>Daily Sales &amp; Net Profit Reports</li>
                  <li className="flex items-center gap-2.5"><span className="text-[#10B981]">✓</span>Custom Branded Thermal Receipts</li>
                  <li className="flex items-center gap-2.5"><span className="text-[#10B981]">✓</span>Offline Checkout Mode Included</li>
                </ul>
              </div>

              <button
                type="button"
                onClick={() => openAuthModal('register', 'Starter')}
                className="mt-8 w-full rounded-xl border border-[#1E2235] bg-[#090A14] py-3.5 text-sm font-bold text-white transition-all hover:border-[#583DF2] hover:bg-[#131626]"
              >
                Start 14-Day Free Trial
              </button>
            </div>

            {/* GROWTH */}
            <div className="relative flex flex-col justify-between rounded-2xl border-2 border-[#583DF2] bg-[#0F111E] p-8 shadow-[0_0_32px_rgba(88,61,242,0.45)]">
              <div className="absolute -top-3.5 right-6 rounded-full bg-gradient-to-r from-[#583DF2] to-[#6D4AFF] px-3.5 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-white">
                Most Popular
              </div>

              <div>
                <h3 className="text-xl font-extrabold text-white">Growth</h3>
                <p className="mt-1.5 text-xs text-slate-400">Scaling Stores, Supermarkets &amp; Teams</p>

                <div className="mt-5 flex items-center gap-2 text-xs">
                  <span className="rounded bg-[#583DF2]/20 px-2 py-0.5 font-mono text-[10px] font-bold text-[#818CF8]">
                    FULL PO &amp; ROLE LOCKDOWN
                  </span>
                </div>

                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="font-mono text-4xl font-black tabular-nums tracking-tight text-white">
                    {formatFromNgn(billingCycle === 'monthly' ? BASE_PRICES_NGN.growthMonthly : BASE_PRICES_NGN.growthYearly)}
                  </span>
                  <span className="text-sm font-semibold text-slate-400">
                    {billingCycle === 'monthly' ? '/month' : '/year'}
                  </span>
                </div>
                <p className="mt-1.5 font-mono text-[11px] text-[#10B981]">
                  {billingCycle === 'monthly'
                    ? `Or ${formatFromNgn(BASE_PRICES_NGN.growthYearly)}/year (Save 20% vs ${formatFromNgn(BASE_PRICES_NGN.growthYearlyFull)}/yr)`
                    : `20% off ${formatFromNgn(BASE_PRICES_NGN.growthYearlyFull)}/yr (${formatFromNgn(BASE_PRICES_NGN.growthYearly / 12)}/mo)`}
                </p>

                <ul className="mt-7 space-y-3 border-t border-[#1E2235] pt-6 text-sm text-slate-200">
                  <li className="flex items-center gap-2.5"><span className="text-[#10B981]">✓</span>Multi-Register Support (Up to 10 Terminals)</li>
                  <li className="flex items-center gap-2.5"><span className="text-[#10B981]">✓</span>Unlimited Staff Roles (Admin / Manager / Staff)</li>
                  <li className="flex items-center gap-2.5"><span className="text-[#10B981]">✓</span>Automated Low-Stock Alerts &amp; Unlimited SKUs</li>
                  <li className="flex items-center gap-2.5"><span className="text-[#10B981]">✓</span>Full Supplier Purchase Order (PO) Workflows</li>
                  <li className="flex items-center gap-2.5"><span className="text-[#10B981]">✓</span>Immutable Staff Audit Logs &amp; Tax Reports</li>
                </ul>
              </div>

              <button
                type="button"
                onClick={() => openAuthModal('register', 'Growth')}
                className="mt-8 w-full rounded-xl bg-gradient-to-r from-[#583DF2] to-[#6D4AFF] py-3.5 text-sm font-bold text-white shadow-[0_0_18px_rgba(88,61,242,0.35)] transition-all hover:brightness-110"
              >
                Claim Growth Founder Rate →
              </button>
            </div>

            {/* MULTI-BRANCH */}
            <div className="flex flex-col justify-between rounded-2xl border border-[#1E2235] bg-[#0F111E] p-8">
              <div>
                <h3 className="text-xl font-extrabold text-white">Multi-Branch</h3>
                <p className="mt-1.5 text-xs text-slate-400">Chains, Supermarkets &amp; Central Warehouses</p>

                <div className="mt-5 flex items-center gap-2 text-xs">
                  <span className="rounded bg-[#10B981]/15 px-2 py-0.5 font-mono text-[10px] font-bold text-[#10B981]">
                    UNLIMITED LOCATIONS
                  </span>
                </div>

                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="font-mono text-4xl font-black tabular-nums tracking-tight text-white">
                    {formatFromNgn(billingCycle === 'monthly' ? BASE_PRICES_NGN.multiMonthly : BASE_PRICES_NGN.multiYearly)}
                  </span>
                  <span className="text-sm font-semibold text-slate-400">
                    {billingCycle === 'monthly' ? '/month' : '/year'}
                  </span>
                </div>
                <p className="mt-1.5 font-mono text-[11px] text-[#10B981]">
                  {billingCycle === 'monthly'
                    ? `Or ${formatFromNgn(BASE_PRICES_NGN.multiYearly)}/year (Save ${formatFromNgn(BASE_PRICES_NGN.multiYearlySavings)} vs ${formatFromNgn(BASE_PRICES_NGN.multiYearlyFull)}/yr)`
                    : `Save ${formatFromNgn(BASE_PRICES_NGN.multiYearlySavings)}/yr off ${formatFromNgn(BASE_PRICES_NGN.multiYearlyFull)}/yr`}
                </p>

                <ul className="mt-7 space-y-3 border-t border-[#1E2235] pt-6 text-sm text-slate-300">
                  <li className="flex items-center gap-2.5"><span className="text-[#10B981]">✓</span>Unlimited Branches, Warehouses &amp; Registers</li>
                  <li className="flex items-center gap-2.5"><span className="text-[#10B981]">✓</span>Inter-Branch Stock Transfers &amp; Transit Logs</li>
                  <li className="flex items-center gap-2.5"><span className="text-[#10B981]">✓</span>Centralized Master Product &amp; Pricing Catalog</li>
                  <li className="flex items-center gap-2.5"><span className="text-[#10B981]">✓</span>Consolidated Multi-Store P&amp;L Analytics</li>
                  <li className="flex items-center gap-2.5"><span className="text-[#10B981]">✓</span>Dedicated 24/7 Priority Onboarding Manager</li>
                </ul>
              </div>

              <button
                type="button"
                onClick={() => openAuthModal('register', 'Multi-Branch')}
                className="mt-8 w-full rounded-xl border border-[#1E2235] bg-[#090A14] py-3.5 text-sm font-bold text-white transition-all hover:border-[#583DF2] hover:bg-[#131626]"
              >
                Start Multi-Branch Trial
              </button>
            </div>
          </div>

          {/* 8. FOUNDER BONUS STACK + 30-DAY GUARANTEE */}
          <div className="mt-16 grid grid-cols-1 gap-8 lg:grid-cols-12">
            <div className="rounded-2xl border border-[#583DF2]/40 bg-[#090A14] p-7 sm:p-9 lg:col-span-7">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="rounded-lg bg-[#583DF2]/20 px-3 py-1 font-mono text-xs font-bold uppercase text-[#818CF8]">
                  INCLUDED FREE DURING LAUNCH
                </span>
                <span className="font-mono text-xs font-bold text-[#10B981]">
                  Total Bonus Value: {formatFromNgn(BASE_PRICES_NGN.bonusTotal)}+ (FREE)
                </span>
              </div>
              <h3 className="mt-4 text-2xl font-black text-white">Your 3 Done-For-You Founder Launch Bonuses</h3>
              <p className="mt-2 text-xs text-slate-400">
                Every trial or paid workspace activated during the Founders Launch Window automatically unlocks:
              </p>

              <div className="mt-6 space-y-4">
                <div className="flex items-start gap-3.5 rounded-xl border border-[#1E2235] bg-[#0F111E] p-4">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#10B981]/20 font-mono text-xs font-bold text-[#10B981]">#1</span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-bold text-white">Free Done-For-You Excel / CSV Product &amp; Stock Migration</h4>
                      <span className="font-mono text-[11px] font-semibold text-[#10B981]">(Value: {formatFromNgn(BASE_PRICES_NGN.bonus1)})</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">Send us your messy spreadsheet or supplier list—our team formats, cleans, and uploads every SKU, barcode, and cost price for you.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 rounded-xl border border-[#1E2235] bg-[#0F111E] p-4">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#10B981]/20 font-mono text-xs font-bold text-[#10B981]">#2</span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-bold text-white">Custom Branded Thermal Receipt &amp; Barcode Label Setup</h4>
                      <span className="font-mono text-[11px] font-semibold text-[#10B981]">(Value: {formatFromNgn(BASE_PRICES_NGN.bonus2)})</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">We configure your store logo, TIN/VAT footer, return policy, and barcode label dimensions on your existing thermal printers.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 rounded-xl border border-[#1E2235] bg-[#0F111E] p-4">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#10B981]/20 font-mono text-xs font-bold text-[#10B981]">#3</span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-bold text-white">1-on-1 Live Owner &amp; Cashier Onboarding Call</h4>
                      <span className="font-mono text-[11px] font-semibold text-[#10B981]">(Value: {formatFromNgn(BASE_PRICES_NGN.bonus3)})</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">A 30-minute live walkthrough setting up your Admin, Manager, and Staff permissions so your counter runs smoothly from Day 1.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-2xl border-2 border-[#10B981]/50 bg-gradient-to-b from-[#0E1B1A] to-[#090A14] p-7 sm:p-9 lg:col-span-5">
              <div>
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#10B981]/20 text-[#10B981] shadow-[0_0_20px_rgba(16,185,129,0.25)]">
                  <ShieldCheck className="h-8 w-8" />
                </div>
                <span className="mt-5 block font-mono text-xs font-bold uppercase tracking-wider text-[#10B981]">
                  IRONCLAD RISK REVERSAL
                </span>
                <h3 className="mt-2 text-2xl font-black text-white">30-Day &quot;Zero-Discrepancy&quot; Money-Back Guarantee</h3>
                <p className="mt-4 text-sm leading-relaxed text-slate-300">
                  Put Kiralyte to work at your counter for a full 30 days. If Kiralyte doesn&apos;t save you hours of manual stock counting, eliminate checkout bottlenecks, and give you crystal-clear visibility over every item sold and restocked—just send one message and we will refund <strong className="text-white">100% of your subscription</strong> immediately.
                </p>
              </div>

              <div className="mt-8 border-t border-[#1E2235] pt-5">
                <button
                  type="button"
                  onClick={() => openAuthModal('register', 'Growth')}
                  className="w-full rounded-xl bg-[#10B981] py-3.5 text-sm font-extrabold text-slate-950 transition-all hover:brightness-110"
                >
                  Try Kiralyte Risk-Free Today →
                </button>
                <p className="mt-2.5 text-center font-mono text-[11px] text-slate-400">No credit card required for 14-day trial</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 9. FAQ ACCORDION */}
      <section className="border-b border-[#1E2235] py-20 sm:py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#1E2235] bg-[#0F111E] px-3.5 py-1 font-mono text-xs font-bold uppercase tracking-wider text-[#818CF8]">
              STRAIGHT ANSWERS
            </span>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">
              Questions Store Owners Ask Before Switching
            </h2>
          </div>

          <div className="mt-10 space-y-3">
            {FAQS.map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div key={idx} className="overflow-hidden rounded-2xl border border-[#1E2235] bg-[#0F111E]">
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="flex w-full items-center justify-between px-6 py-4 text-left text-sm font-bold text-white sm:text-base"
                  >
                    <span>{item.q}</span>
                    <ChevronDown
                      className={`h-5 w-5 shrink-0 text-[#818CF8] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {isOpen && (
                    <div className="border-t border-[#1E2235] px-6 py-4 text-sm leading-relaxed text-slate-300">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* FINAL CTA + FOOTER */}
      <footer className="bg-[#090A14] pt-16 pb-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl border border-[#583DF2]/50 bg-gradient-to-br from-[#131136] via-[#0F111E] to-[#0B1718] p-8 text-center shadow-[0_0_32px_rgba(88,61,242,0.45)] sm:p-14">
            <span className="inline-flex items-center gap-2 rounded-full bg-[#F59E0B]/15 px-3.5 py-1 font-mono text-xs font-bold uppercase text-[#F59E0B]">
              ONLY 17 FOUNDER SPOTS REMAINING AT LAUNCH PRICING
            </span>
            <h2 className="mx-auto mt-4 max-w-2xl text-3xl font-black tracking-tight text-white sm:text-4xl">
              Lock In Your Founder Rate Today &amp; Stop Leaving Retail Profit on the Table
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-sm text-slate-300 sm:text-base">
              Start your 14-day free trial in 60 seconds. Includes free CSV inventory migration, custom receipt setup, and our 30-Day Zero-Discrepancy Guarantee.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <button
                type="button"
                onClick={() => openAuthModal('register', 'Growth')}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#583DF2] to-[#6D4AFF] px-8 py-4 text-base font-bold text-white shadow-[0_0_32px_rgba(88,61,242,0.45)] transition-all hover:brightness-110 sm:w-auto"
              >
                <span>Lock In Your Founder Rate Today →</span>
              </button>
              <button
                type="button"
                onClick={() => openAuthModal('signin')}
                className="w-full rounded-xl border border-[#1E2235] bg-[#090A14]/90 px-7 py-4 text-sm font-semibold text-slate-200 transition-colors hover:text-white sm:w-auto"
              >
                Sign In to Existing Workspace
              </button>
            </div>
          </div>

          <div className="mt-14 flex flex-col items-center justify-between gap-6 border-t border-[#1E2235] pt-8 sm:flex-row">
            <div className="flex items-center gap-3">
              <img src="/kiralyte-icon.png" alt="Kiralyte" className="h-8 w-8 rounded-lg object-contain" />
              <span className="text-base font-black text-white">Kiralyte</span>
              <span className="text-xs text-slate-500">© 2026 Kiralyte Technologies. All rights reserved.</span>
            </div>

            <div className="flex flex-wrap items-center gap-6 text-xs font-medium text-slate-400">
              <a href="#profit-leak" className="hover:text-white">The Profit Leak</a>
              <a href="#live-sandbox" className="hover:text-white">Live Sandbox</a>
              <a href="#role-control" className="hover:text-white">Role Control</a>
              <a href="#launch-offer" className="hover:text-white">Launch Offer</a>
              <button type="button" onClick={() => openAuthModal('signin')} className="font-semibold text-[#818CF8] hover:underline">
                Sign In
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* REAL AUTH MODAL (Connected to /api/auth/signup and /api/auth/login) */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false);
          }}
        >
          <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-[#1E2235] bg-[#0F111E] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.65)] sm:p-8">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              aria-label="Close modal"
              className="absolute top-4 right-4 rounded-xl border border-[#1E2235] bg-[#090A14] p-2 text-slate-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>

            <img src="/kiralyte-icon.png" alt="Kiralyte" className="mx-auto mb-4 h-12 w-12 rounded-xl object-contain" />

            <h3 className="text-center text-2xl font-black text-white">
              {modalMode === 'register' ? 'Claim Your Founder Rate' : 'Sign In to Kiralyte'}
            </h3>
            <p className="mt-1.5 text-center text-xs text-slate-400">
              {modalMode === 'register'
                ? 'Start your 14-day free trial with all 3 Done-For-You Launch Bonuses'
                : 'Access your live POS, inventory ledger & PO workflows'}
            </p>

            {authError && (
              <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-400">
                {authError}
              </div>
            )}

            <form onSubmit={handleAuthSubmit} className="mt-5 space-y-4">
              {modalMode === 'register' && (
                <>
                  <div>
                    <label className="block font-mono text-[11px] font-bold uppercase tracking-wider text-slate-300">
                      Business / Store Name
                    </label>
                    <input
                      type="text"
                      required
                      value={bizName}
                      onChange={(e) => setBizName(e.target.value)}
                      placeholder="e.g. PrimeMart Superstore"
                      className="mt-1.5 w-full rounded-xl border border-[#1E2235] bg-[#090A14] px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-[#583DF2] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-mono text-[11px] font-bold uppercase tracking-wider text-slate-300">
                      Your Full Name
                    </label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Jane Doe"
                      className="mt-1.5 w-full rounded-xl border border-[#1E2235] bg-[#090A14] px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-[#583DF2] focus:outline-none"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block font-mono text-[11px] font-bold uppercase tracking-wider text-slate-300">
                  Work Email Address
                </label>
                <input
                  type="email"
                  required
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="owner@yourbusiness.com"
                  className="mt-1.5 w-full rounded-xl border border-[#1E2235] bg-[#090A14] px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-[#583DF2] focus:outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="block font-mono text-[11px] font-bold uppercase tracking-wider text-slate-300">
                    Password
                  </label>
                  {modalMode === 'register' ? (
                    <span className="rounded bg-[#10B981]/15 px-2 py-0.5 font-mono text-[10px] font-bold text-[#10B981]">
                      {selectedPlan} Plan • 14d Free
                    </span>
                  ) : (
                    <Link href="/forgot-password" className="text-xs font-medium text-[#818CF8] hover:underline">
                      Forgot password?
                    </Link>
                  )}
                </div>
                <PasswordInput
                  required
                  minLength={6}
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="••••••••"
                  className="mt-1.5 w-full rounded-xl border border-[#1E2235] bg-[#090A14] px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-[#583DF2] focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={authSubmitting}
                className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#583DF2] to-[#6D4AFF] py-3.5 text-sm font-bold text-white shadow-[0_0_18px_rgba(88,61,242,0.35)] transition-all hover:brightness-110 disabled:opacity-50"
              >
                <span>
                  {authSubmitting
                    ? 'Please wait...'
                    : modalMode === 'register'
                    ? 'Activate 14-Day Free Trial →'
                    : 'Sign In to Business →'}
                </span>
              </button>
            </form>

            <div className="mt-5 border-t border-[#1E2235] pt-4 text-center text-xs text-slate-400">
              <span>{modalMode === 'register' ? 'Already have a Kiralyte account?' : "Don't have a business account?"}</span>
              <button
                type="button"
                onClick={() => {
                  setAuthError('');
                  setModalMode(modalMode === 'register' ? 'signin' : 'register');
                }}
                className="ml-1 font-bold text-[#818CF8] hover:underline"
              >
                {modalMode === 'register' ? 'Sign In to Business' : 'Claim Founder Rate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST BANNER */}
      {toastMsg && (
        <div className="pointer-events-none fixed right-5 bottom-5 z-50">
          <div className="flex items-center gap-3 rounded-xl border border-[#10B981]/50 bg-[#0F111E] px-4 py-3 shadow-[0_24px_60px_rgba(0,0,0,0.65)]">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#10B981]/20 text-[#10B981]">
              <Check className="h-4 w-4" />
            </span>
            <p className="text-xs font-semibold text-white">{toastMsg}</p>
          </div>
        </div>
      )}
    </div>
  );
};
