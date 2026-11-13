import { type InputHTMLAttributes, forwardRef } from 'react'
import { cn } from '../utils'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <div className="w-full">
        <input
          ref={ref}
          className={cn(
            'w-full min-h-[46px]',
            'px-3.5 py-3',
            'border rounded-[9px]',
            'bg-white text-ink text-[13px]',
            'transition-colors duration-200',
            'placeholder:text-muted/60 placeholder:text-xs',
            error 
              ? 'border-danger focus:border-danger focus:ring-2 focus:ring-danger/20' 
              : 'border-line-strong focus:border-green focus:ring-2 focus:ring-green/20',
            'disabled:bg-soft disabled:text-muted disabled:cursor-not-allowed',
            'focus:outline-none',
            className
          )}
          {...props}
        />
        {error && (
          <p className="text-danger text-xs mt-2 leading-relaxed">
            {error}
          </p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'
