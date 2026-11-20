import React from 'react';
import { LucideIcon } from 'lucide-react';
import { clsx } from 'clsx';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: string;
    positive: boolean;
  };
  color?: 'indigo' | 'emerald' | 'amber' | 'rose' | 'violet' | 'cyan';
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  color = 'indigo'
}) => {
  const colorMap = {
    indigo: 'from-indigo-500/10 to-indigo-500/5 text-indigo-600 dark:text-indigo-400 border-indigo-500/20 icon-bg:bg-indigo-500/10',
    emerald: 'from-emerald-500/10 to-emerald-500/5 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 icon-bg:bg-emerald-500/10',
    amber: 'from-amber-500/10 to-amber-500/5 text-amber-600 dark:text-amber-400 border-amber-500/20 icon-bg:bg-amber-500/10',
    rose: 'from-rose-500/10 to-rose-500/5 text-rose-600 dark:text-rose-400 border-rose-500/20 icon-bg:bg-rose-500/10',
    violet: 'from-violet-500/10 to-violet-500/5 text-violet-600 dark:text-violet-400 border-violet-500/20 icon-bg:bg-violet-500/10',
    cyan: 'from-cyan-500/10 to-cyan-500/5 text-cyan-600 dark:text-cyan-400 border-cyan-500/20 icon-bg:bg-cyan-500/10'
  };

  const iconColor = {
    indigo: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
    violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
    cyan: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400'
  };

  return (
    <div className={clsx(
      'relative overflow-hidden p-6 rounded-2xl border bg-white dark:bg-slate-900 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5',
      'border-slate-200/80 dark:border-slate-800'
    )}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
          <h3 className="mt-2 text-3xl font-bold text-slate-900 dark:text-white tracking-tight">{value}</h3>
          {subtitle && (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
          )}
          {trend && (
            <div className="mt-2 flex items-center gap-1 text-xs font-semibold">
              <span className={trend.positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                {trend.positive ? '↑' : '↓'} {trend.value}
              </span>
              <span className="text-slate-400 font-normal">vs last period</span>
            </div>
          )}
        </div>
        <div className={clsx('p-3.5 rounded-xl flex items-center justify-center', iconColor[color])}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
};
