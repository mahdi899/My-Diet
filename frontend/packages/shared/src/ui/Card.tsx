import { type ReactNode } from 'react'
import { cn } from '../utils'

export interface CardProps {
  children: ReactNode
  className?: string
}

export const Card = ({ children, className }: CardProps) => {
  return (
    <div
      className={cn(
        'bg-white border border-line rounded-mydiet shadow-sm',
        className
      )}
    >
      {children}
    </div>
  )
}

export const CardHeader = ({ children, className }: CardProps) => {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4',
        'px-6 py-5 border-b border-line',
        className
      )}
    >
      {children}
    </div>
  )
}

export const CardBody = ({ children, className }: CardProps) => {
  return (
    <div className={cn('px-6 py-5', className)}>
      {children}
    </div>
  )
}

export const CardFooter = ({ children, className }: CardProps) => {
  return (
    <div
      className={cn(
        'px-6 py-4 border-t border-line bg-cream/50',
        className
      )}
    >
      {children}
    </div>
  )
}
