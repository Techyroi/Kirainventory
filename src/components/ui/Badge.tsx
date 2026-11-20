import React from 'react';
import { clsx } from 'clsx';

interface BadgeProps {
  status: string;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ status, className }) => {
  const getStyle = (st: string) => {
    switch (st) {
      case 'In Stock':
      case 'Received':
      case 'Completed':
      case 'Paid':
      case 'active':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
      case 'Low Stock':
      case 'Ordered':
      case 'Partial':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
      case 'Out of Stock':
      case 'Cancelled':
      case 'Refunded':
      case 'disabled':
      case 'paused':
      case 'Overdue':
        return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20';
      case 'Trial':
        return 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20';
      case 'Draft':
      case 'Pending':
      case 'Inactive':
      default:
        return 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20';
    }
  };

  const getDot = (st: string) => {
    switch (st) {
      case 'In Stock':
      case 'Received':
      case 'Completed':
      case 'Paid':
      case 'active':
        return 'bg-emerald-500';
      case 'Low Stock':
      case 'Ordered':
      case 'Partial':
        return 'bg-amber-500';
      case 'Out of Stock':
      case 'Cancelled':
      case 'Refunded':
      case 'disabled':
      case 'paused':
      case 'Overdue':
        return 'bg-rose-500';
      case 'Trial':
        return 'bg-indigo-500';
      default:
        return 'bg-slate-400';
    }
  };

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors',
        getStyle(status),
        className
      )}
    >
      <span className={clsx('w-1.5 h-1.5 rounded-full', getDot(status))} />
      {status}
    </span>
  );
};
