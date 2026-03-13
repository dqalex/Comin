'use client';

import { initI18n } from '@/lib/i18n';
import { useEffect, useState } from 'react';

export default function I18nProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initI18n().then(() => {
      setReady(true);
    });
  }, []);

  if (!ready) {
    // 可以返回一个加载状态或 null
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-slate-400">Loading...</div>
      </div>
    );
  }
  
  return <>{children}</>;
}
