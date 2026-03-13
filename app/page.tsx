'use client';

import { useEffect, useState, useMemo, Suspense, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/landing/Navbar';
import { syncMdToHtml, SlotDef } from '@/lib/slot-sync';
import { 
  CheckSquare, FileText, Wrench, ClipboardList, Users, Bot, 
  Send, Clock, MessageSquare, LayoutDashboard 
} from 'lucide-react';
import { renderToString } from 'react-dom/server';

interface LandingData {
  document: { id: string; content: string };
  template: { 
    id: string; 
    htmlTemplate: string; 
    cssTemplate: string | null;
    slots: Record<string, SlotDef>;
  };
}

// Lucide 图标名称到组件的映射
const iconMap: Record<string, React.ComponentType<any>> = {
  'check-square': CheckSquare,
  'file-text': FileText,
  'wrench': Wrench,
  'clipboard-list': ClipboardList,
  'users': Users,
  'bot': Bot,
  'send': Send,
  'clock': Clock,
  'message-square': MessageSquare,
  'layout-dashboard': LayoutDashboard,
};

export default function HomePage() {
  const router = useRouter();
  const [locale, setLocale] = useState<'en' | 'zh'>('en');
  const [landingData, setLandingData] = useState<LandingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [initChecked, setInitChecked] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // 渲染 Lucide 图标
  const renderLucideIcons = () => {
    if (!contentRef.current) return;
    
    const iconElements = contentRef.current.querySelectorAll('[data-lucide]');
    iconElements.forEach((el) => {
      const iconName = el.getAttribute('data-lucide');
      const IconComponent = iconMap[iconName || ''];
      if (IconComponent) {
        // 创建 SVG 字符串
        const svgString = renderToString(
          <IconComponent size={22} strokeWidth={2} color="#0056ff" />
        );
        el.innerHTML = svgString;
      }
    });
  };

  // 检查是否需要初始化
  useEffect(() => {
    fetch('/api/init')
      .then(res => res.json())
      .then(data => {
        if (data.needed) {
          // 需要初始化，跳转到初始化页面
          router.push('/init');
        } else {
          setInitChecked(true);
        }
      })
      .catch(() => {
        setInitChecked(true);
      });
  }, [router]);

  // 获取 landing 数据（公开 API，无需登录）
  const fetchLandingData = async (loc: 'en' | 'zh') => {
    try {
      const res = await fetch(`/api/landing?locale=${loc}`);
      if (res.ok) {
        const data = await res.json();
        setLandingData(data);
      }
    } catch (err) {
      console.error('Failed to fetch landing data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!initChecked) return;
    const savedLocale = localStorage.getItem('teamclaw-language') || 'en';
    const loc = savedLocale as 'en' | 'zh';
    setLocale(loc);
    fetchLandingData(loc);
  }, [initChecked]);

  const handleLocaleChange = (newLocale: 'en' | 'zh') => {
    setLocale(newLocale);
    localStorage.setItem('teamclaw-language', newLocale);
    window.dispatchEvent(new CustomEvent('language-change', { detail: { locale: newLocale } }));
    // 重新获取对应语言的内容
    setLoading(true);
    fetchLandingData(newLocale);
  };

  // 使用模板渲染 HTML
  const renderedHtml = useMemo(() => {
    if (!landingData?.document?.content || !landingData?.template) return '';
    
    const { html } = syncMdToHtml(
      landingData.document.content,
      landingData.template.htmlTemplate || '',
      landingData.template.slots || {},
      landingData.template.cssTemplate || undefined
    );
    return html;
  }, [landingData]);

  // 渲染图标
  useEffect(() => {
    if (!loading && renderedHtml) {
      // 延迟渲染图标，确保 DOM 已更新
      const timer = setTimeout(renderLucideIcons, 50);
      return () => clearTimeout(timer);
    }
  }, [loading, renderedHtml]);

  // 初始化检查中，显示加载状态
  if (!initChecked) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <div className="animate-pulse text-slate-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-white selection:bg-[#0056ff]/30">
      {/* 导航栏固定渲染 */}
      <Suspense fallback={<div className="h-20" />}>
        <Navbar locale={locale} onLocaleChange={handleLocaleChange} />
      </Suspense>
      
      {/* 主内容区：使用模板渲染 */}
      <main>
        {loading ? (
          // 加载中显示骨架屏
          <div className="pt-32 pb-20 text-center">
            <div className="animate-pulse">
              <div className="h-8 bg-slate-800 rounded w-64 mx-auto mb-4"></div>
              <div className="h-4 bg-slate-800 rounded w-96 mx-auto"></div>
            </div>
          </div>
        ) : renderedHtml ? (
          <div 
            ref={contentRef}
            className="landing-content"
            dangerouslySetInnerHTML={{ __html: renderedHtml }}
          />
        ) : (
          // 无内容时显示提示
          <div className="pt-32 pb-20 text-center text-slate-500">
            <p>Landing page content not available.</p>
          </div>
        )}
      </main>
    </div>
  );
}
