'use client';

import { initI18n } from '@/lib/i18n';
import { useEffect, useState } from 'react';

export default function I18nProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initI18n();
    setReady(true);
  }, []);

  if (!ready) return null;
  return <>{children}</>;
}
