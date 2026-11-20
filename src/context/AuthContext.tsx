'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { User, Business } from '@/types';

interface AuthContextType {
  user: User | null;
  business: Business | null;
  loading: boolean;
  login: (token: string, user: User, business?: Business) => void;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  business: null,
  loading: true,
  login: () => {},
  logout: async () => {},
  refreshSession: async () => {}
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const publicRoutes = ['/login', '/signup', '/forgot-password', '/reset-password'];

  const refreshSession = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setBusiness(data.business);
      } else {
        const errData = await res.json().catch(() => ({}));
        setUser(null);
        setBusiness(null);
        if (!publicRoutes.includes(pathname)) {
          router.push(errData?.paused ? '/login?paused=1' : '/login');
        }
      }
    } catch (error) {
      setUser(null);
      setBusiness(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshSession();
  }, [pathname]);

  const login = (token: string, userData: User, bizData?: Business) => {
    setUser(userData);
    if (bizData) setBusiness(bizData);
    router.push('/dashboard');
  };

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    setBusiness(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, business, loading, login, logout, refreshSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
