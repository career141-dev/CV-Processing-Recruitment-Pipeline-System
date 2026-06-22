import React from 'react';

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'default' | 'outline' | 'purple';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function Badge({ children, variant = 'default', size = 'md', className = '', ...props }: BadgeProps) {
  const baseStyles = 'inline-flex items-center justify-center font-bold rounded';
  
  const sizeStyles = {
    sm: 'text-[10px] py-0.5 px-1.5',
    md: 'text-[11px] py-1 px-2',
    lg: 'text-xs py-1.5 px-3',
  };

  const variantStyles = {
    success: 'bg-primary-container/15 text-primary-container', // Used for LinkedIn
    warning: 'bg-yellow-500/15 text-yellow-700', // Used for WhatsApp
    error: 'bg-tertiary-fixed text-tertiary', // For red initials
    info: 'bg-blue-500/15 text-blue-700', // For Headhunting
    purple: 'bg-purple-500/15 text-purple-700', // For EmailCampaign
    default: 'bg-surface-container text-text-secondary', // Standard pill
    outline: 'bg-transparent border border-solid border-border text-text-secondary',
  };

  return (
    <span 
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}

// Avatar Initials Badge
export function AvatarBadge({ initials, colorClass = 'bg-primary-fixed text-on-primary-fixed', size = 'w-10 h-10 text-lg' }: { initials: string, colorClass?: string, size?: string }) {
  return (
    <div className={`flex items-center justify-center shrink-0 rounded-full font-bold ${colorClass} ${size}`}>
      {initials}
    </div>
  );
}
