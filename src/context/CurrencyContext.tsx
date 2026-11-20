'use client';

import React, { createContext, useContext } from 'react';
import { useAuth } from './AuthContext';

interface CurrencyContextType {
  symbol: string;
  formatCurrency: (amount: number) => string;
}

const CurrencyContext = createContext<CurrencyContextType>({
  symbol: '$',
  formatCurrency: (val) => `$${val.toFixed(2)}`
});

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const { business } = useAuth();
  const symbol = business?.currency || '$';

  const formatCurrency = (amount: number) => {
    const safeAmount = Number(amount) || 0;
    return `${symbol}${safeAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <CurrencyContext.Provider value={{ symbol, formatCurrency }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export const useCurrency = () => useContext(CurrencyContext);
