import { forwardRef, type HTMLAttributes } from 'react';
import clsx from 'clsx';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'ai';
}

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={clsx('tag', className)}
        style={{
          background: variant === 'default' ? 'var(--surface-hover)' :
            variant === 'primary' ? 'var(--brand-light)' :
            variant === 'success' ? 'var(--success-light)' :
            variant === 'warning' ? 'var(--warning-light)' :
            variant === 'danger' ? 'var(--danger-light)' :
            variant === 'info' ? 'var(--info-light)' :
            variant === 'ai' ? 'var(--ai-light)' :
            undefined,
          color: variant === 'default' ? 'var(--text-secondary)' :
            variant === 'primary' ? 'var(--brand)' :
            variant === 'success' ? 'var(--success)' :
            variant === 'warning' ? 'var(--warning)' :
            variant === 'danger' ? 'var(--danger)' :
            variant === 'info' ? 'var(--info)' :
            variant === 'ai' ? 'var(--ai)' :
            undefined,
        }}
        {...props}
      />
    );
  }
);

Badge.displayName = 'Badge';

export { Badge };
