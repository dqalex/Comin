import { forwardRef, type LabelHTMLAttributes } from 'react';
import clsx from 'clsx';

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

const Label = forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, required, children, ...props }, ref) => {
    return (
      <label
        className={clsx('text-xs font-medium block mb-1', className)}
        style={{ color: 'var(--text-tertiary)' }}
        ref={ref}
        {...props}
      >
        {children}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
    );
  }
);

Label.displayName = 'Label';

export { Label };
