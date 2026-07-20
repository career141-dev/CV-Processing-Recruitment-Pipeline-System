"use client";

import React from 'react';

interface ToggleProps {
  enabled: boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
}

function Toggle({ enabled, onChange, disabled }: ToggleProps) {
  return (
    <button
      role="switch"
      aria-checked={enabled}
      disabled={disabled}
      onClick={(e) => { e.stopPropagation(); if (!disabled) onChange(!enabled); }}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
        disabled ? 'opacity-40 cursor-not-allowed' : ''
      } ${enabled ? 'bg-green-500' : 'bg-border'}`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
          enabled ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

interface ChannelStatusCardProps {
  title: string;
  status: string;
  statusColor: string;
  icon: React.ReactNode;
  stats: { label: string; value: string | React.ReactNode }[];
  borderClass?: string;
  pulse?: boolean;
  actionButton?: React.ReactNode;
  children?: React.ReactNode;
  onClick?: () => void;
  isSelected?: boolean;
  toggle?: {
    enabled: boolean;
    onChange: (val: boolean) => void;
    disabled?: boolean;
    label?: string;
  };
  errorCount?: number;
}

export function ChannelStatusCard({
  title,
  status,
  statusColor,
  icon,
  stats,
  borderClass = 'border-border',
  pulse = false,
  actionButton,
  children,
  onClick,
  isSelected = false,
  toggle,
  errorCount = 0,
}: ChannelStatusCardProps) {
  const isPaused = status === 'Paused';

  return (
    <div
      onClick={onClick}
      className={`relative bg-surface border rounded-xl p-4 flex flex-col gap-3 transition-all duration-200 overflow-hidden ${
        onClick ? 'cursor-pointer hover:shadow-md' : ''
      } ${isSelected ? 'ring-2 ring-primary shadow-md border-primary/20' : borderClass} ${
        isPaused ? 'opacity-75' : ''
      }`}
    >
      {/* Top row: icon + status + toggle */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          {/* Status dot + icon */}
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
            isPaused ? 'bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-500' :
            status === 'Active' ? 'bg-green-500/10 dark:bg-green-500/20 text-green-600 dark:text-green-500' :
            status === 'Error' ? 'bg-red-500/10 dark:bg-red-500/20 text-red-500 dark:text-red-400' :
            'bg-surface-container text-text-secondary'
          }`}>
            {icon}
          </div>
          <div>
            <h3 className="text-[13px] font-semibold text-text-primary leading-tight">{title}</h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className={`w-1.5 h-1.5 rounded-full ${
                isPaused ? 'bg-amber-500' :
                status === 'Active' ? 'bg-green-500' :
                status === 'Error' ? 'bg-red-500' :
                'bg-text-secondary/40'
              } ${pulse && !isPaused ? 'animate-pulse' : ''}`} />
              <span className={`text-[11px] font-medium ${
                isPaused ? 'text-amber-600 dark:text-amber-500' :
                status === 'Active' ? 'text-green-600 dark:text-green-500' :
                status === 'Error' ? 'text-red-500 dark:text-red-400' :
                'text-text-secondary'
              }`}>{status}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Error badge */}
          {errorCount > 0 && (
            <span className="text-[10px] font-bold bg-red-500/10 dark:bg-red-500/20 text-red-500 dark:text-red-400 border border-red-200 dark:border-red-500/30 px-1.5 py-0.5 rounded-full">
              {errorCount} error{errorCount !== 1 ? 's' : ''}
            </span>
          )}
          {/* Toggle */}
          {toggle && (
            <div className="flex items-center gap-1.5">
              {toggle.disabled && (
                <span className="text-[10px] text-text-secondary/60 font-medium hidden sm:block">
                  Always on
                </span>
              )}
              <Toggle
                enabled={toggle.enabled}
                onChange={toggle.onChange}
                disabled={toggle.disabled}
              />
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="border-t border-border pt-3 space-y-1.5">
        {stats.map((stat, i) => (
          <div key={i} className="flex justify-between items-center">
            <span className="text-[12px] text-text-secondary">{stat.label}</span>
            {typeof stat.value === 'string' ? (
              <span className="text-[13px] font-semibold text-text-primary tabular-nums">
                {stat.value}
              </span>
            ) : (
              stat.value
            )}
          </div>
        ))}
      </div>

      {children && <div>{children}</div>}
      {actionButton}
    </div>
  );
}
