'use client';

import { useUIStore } from '@/store';
import Sidebar from './Sidebar';
import clsx from 'clsx';

/**
 * 应用外壳：Sidebar + 主内容区
 * 根据 sidebar 展开/收起状态动态调整左边距
 * - 展开态：w-[248px] / lg:w-[264px]
 * - 收起态：w-[60px]
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const { sidebarOpen, hydrated } = useUIStore();
  const isOpen = hydrated ? sidebarOpen : true;

  return (
    <>
      <Sidebar />
      <main
        className={clsx(
          'min-h-screen transition-all duration-300 ease-out',
          isOpen ? 'ml-[248px] lg:ml-[264px]' : 'ml-[60px]'
        )}
      >
        {children}
      </main>
    </>
  );
}
