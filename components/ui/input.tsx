import { forwardRef, type InputHTMLAttributes } from 'react';
import clsx from 'clsx';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, icon, style, ...props }, ref) => {
    if (icon) {
      return (
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-tertiary)' }}>
            {icon}
          </span>
          <input
            className={clsx('input !pl-10', className)}
            ref={ref}
            style={style}
            {...props}
          />
        </div>
      );
    }
    return (
      <input
        className={clsx('input', className)}
        ref={ref}
        style={style}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';

export { Input };
