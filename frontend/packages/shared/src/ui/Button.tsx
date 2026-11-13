import { type ReactNode, type ButtonHTMLAttributes } from 'react'
import { cn } from '../utils'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'secondary' | 'ghost' | 'danger'
  iconLeft?: ReactNode
  iconRight?: ReactNode
}

export const Button = ({ 
  variant = 'default', 
  iconLeft, 
  iconRight,
  children, 
  className,
  ...props 
}: ButtonProps) => {
  return (
    <button
      className={cn(
        // Base styles
        'inline-flex items-center justify-center gap-2',
        'min-h-[44px] px-[18px] py-2.5',
        'rounded-[10px] font-semibold text-sm',
        'transition-all duration-200',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        // Variants
        variant === 'default' && [
          'bg-green text-white',
          'hover:bg-green-hover hover:shadow-md',
          'active:shadow-inner',
          'focus-visible:ring-green'
        ],
        variant === 'secondary' && [
          'bg-white text-ink border border-line',
          'hover:bg-soft hover:border-line-strong',
          'focus-visible:ring-line-strong'
        ],
        variant === 'ghost' && [
          'bg-transparent text-green',
          'hover:bg-soft',
          'focus-visible:ring-green'
        ],
        variant === 'danger' && [
          'bg-danger-soft text-danger border border-red-200',
          'hover:bg-red-100',
          'focus-visible:ring-danger'
        ],
        className
      )}
      {...props}
    >
      {iconLeft}
      {children}
      {iconRight}
    </button>
  )
}
