import { type ReactNode } from 'react'
import { cn } from '../utils'

export interface BadgeProps {
  children: ReactNode
  variant?: 'success' | 'danger' | 'warning' | 'neutral'
  className?: string
  dot?: boolean
}

export const Badge = ({ 
  children, 
  variant = 'neutral',
  className,
  dot = false
}: BadgeProps) => {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5',
        'px-2.5 py-1 rounded-md',
        'text-[10px] font-normal leading-relaxed whitespace-nowrap',
        variant === 'success' && 'bg-emerald-50 text-emerald-700',
        variant === 'danger' && 'bg-danger-soft text-danger',
        variant === 'warning' && 'bg-amber-soft text-amber',
        variant === 'neutral' && 'bg-gray-100 text-gray-600',
        className
      )}
    >
      {dot && (
        <span className="w-1.5 h-1.5 rounded-full bg-current flex-shrink-0" />
      )}
      {children}
    </span>
  )
}
