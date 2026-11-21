'use client';

import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { clsx } from 'clsx';

interface PasswordInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  buttonClassName?: string;
}

export const PasswordInput: React.FC<PasswordInputProps> = ({
  className,
  buttonClassName,
  ...props
}) => {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        {...props}
        type={visible ? 'text' : 'password'}
        className={clsx(className, 'pr-10')}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        tabIndex={-1}
        className={clsx(
          'absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors focus:outline-none',
          buttonClassName
        )}
      >
        {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
};
