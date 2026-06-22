import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  icon?: React.ReactNode;
}

export function Button({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  className = '', 
  icon,
  ...props 
}: ButtonProps) {
  
  const baseStyles = 'inline-flex items-center justify-center font-bold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
  
  const sizeStyles = {
    sm: 'text-xs py-1 px-3 rounded',
    md: 'text-[13px] py-[7px] px-4 rounded-md',
    lg: 'text-sm py-2 px-5 rounded-lg',
    icon: 'p-2 rounded-full w-8 h-8 flex items-center justify-center',
  };

  const variantStyles = {
    primary: 'bg-primary-container text-on-primary hover:bg-[#144718] border-none',
    secondary: 'bg-accent-teal text-on-primary hover:bg-[#00504d] border border-solid border-border',
    ghost: 'bg-transparent text-text-secondary hover:text-gray-900 hover:bg-surface-container-high transition-colors border-none',
    outline: 'bg-transparent text-text-primary border border-solid border-border hover:bg-surface-container-high transition-colors',
    danger: 'bg-transparent text-[#BA1A1A] hover:bg-red-50 border-none underline',
  };

  return (
    <button 
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {icon && <span className="mr-2 flex items-center justify-center">{icon}</span>}
      {children}
    </button>
  );
}
