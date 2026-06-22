"use client";

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { clsx } from 'clsx';

interface CustomSelectProps {
  label: string;
  labelColorClass: string;
  hoverColorClass: string;
  gradientFromClass: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
}

export function CustomSelect({
  label,
  labelColorClass,
  hoverColorClass,
  gradientFromClass,
  options,
  value,
  onChange,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          "group relative flex items-center bg-surface/60 backdrop-blur-md border border-surface/40 shadow-[0_4px_16px_rgba(0,0,0,0.03)] rounded-full px-4 py-2 transition-all duration-300 w-[240px]",
          hoverColorClass,
          isOpen ? "bg-surface" : ""
        )}
      >
        <div className={clsx(
          "absolute inset-0 rounded-full transition-opacity duration-300 pointer-events-none",
          gradientFromClass,
          isOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        )} />
        
        <span className={clsx("text-xs font-semibold mr-3 uppercase tracking-wider relative z-10", labelColorClass)}>
          {label}
        </span>
        
        <span className="text-[14px] text-text-primary font-medium flex-1 text-left relative z-10 truncate">
          {value}
        </span>
        
        <ChevronDown 
          className={clsx(
            "w-4 h-4 text-text-secondary transition-transform duration-300 relative z-10",
            isOpen ? "rotate-180" : "group-hover:text-current"
          )} 
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-full bg-surface/90 backdrop-blur-xl border border-surface/40 shadow-xl rounded-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
          <div className="py-2">
            {options.map((option) => (
              <button
                key={option}
                onClick={() => {
                  onChange(option);
                  setIsOpen(false);
                }}
                className={clsx(
                  "w-full px-4 py-2.5 text-left text-[14px] flex items-center justify-between transition-colors",
                  value === option 
                    ? "bg-gray-50/80 font-semibold text-gray-900" 
                    : "text-text-secondary hover:bg-surface-container-high transition-colors hover:text-gray-900 font-medium"
                )}
              >
                <span className="truncate">{option}</span>
                {value === option && (
                  <Check className={clsx("w-4 h-4", labelColorClass)} />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
