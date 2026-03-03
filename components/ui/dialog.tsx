'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { X } from 'lucide-react';
import clsx from 'clsx';

interface DialogContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DialogContext = createContext<DialogContextValue | null>(null);

function useDialog() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('Dialog components must be used within Dialog');
  return ctx;
}

interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}

export function Dialog({ open: controlledOpen, onOpenChange, children }: DialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const handleOpenChange = onOpenChange ?? setUncontrolledOpen;

  return (
    <DialogContext.Provider value={{ open, onOpenChange: handleOpenChange }}>
      {children}
    </DialogContext.Provider>
  );
}

interface DialogTriggerProps {
  children: ReactNode;
  asChild?: boolean;
}

export function DialogTrigger({ children }: DialogTriggerProps) {
  const { onOpenChange } = useDialog();
  return (
    <span onClick={() => onOpenChange(true)}>
      {children}
    </span>
  );
}

interface DialogContentProps {
  children: ReactNode;
  className?: string;
  showClose?: boolean;
}

export function DialogContent({ children, className, showClose = true }: DialogContentProps) {
  const { open, onOpenChange } = useDialog();

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center z-50">
      <div
        className={clsx('rounded-2xl p-6 shadow-float w-full max-w-md animate-slideUp border', className)}
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        {showClose && (
          <button
            onClick={() => onOpenChange(false)}
            className="absolute top-4 right-4 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition-all duration-200"
            style={{ color: 'var(--text-tertiary)' }}
          >
            <X className="w-4 h-4" />
          </button>
        )}
        {children}
      </div>
    </div>
  );
}

export function DialogHeader({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx('mb-4', className)}>{children}</div>;
}

export function DialogTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h3 className={clsx('font-display font-bold text-lg', className)} style={{ color: 'var(--text-primary)' }}>
      {children}
    </h3>
  );
}

export function DialogDescription({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={clsx('text-xs mt-1', className)} style={{ color: 'var(--text-tertiary)' }}>
      {children}
    </p>
  );
}

export function DialogFooter({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx('flex justify-end gap-2 mt-4', className)}>
      {children}
    </div>
  );
}
