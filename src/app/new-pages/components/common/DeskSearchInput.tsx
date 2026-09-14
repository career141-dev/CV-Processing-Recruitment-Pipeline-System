'use client';

import React from 'react';
import { Search, X } from 'lucide-react';

export interface DeskSearchInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  containerClassName?: string;
  onClear?: () => void;
}

/**
 * DeskSearchInput: Standard search bar with search icon, clear button, and focus styling.
 */
export const DeskSearchInput: React.FC<DeskSearchInputProps> = ({
  value,
  onChange,
  placeholder = 'Search pipeline',
  className = '',
  containerClassName = 'relative w-full sm:w-[309px] h-[31px]',
  onClear,
  ...rest
}) => {
  const handleClear = () => {
    onChange('');
    if (onClear) onClear();
  };

  return (
    <div className={containerClassName}>
      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full h-full pl-8 pr-7 bg-white border border-[#8B9399] rounded-[5px] text-[13px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#165B42] focus:border-[#165B42] transition-all ${className}`}
        {...rest}
      />
      {value && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
          title="Clear search"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
