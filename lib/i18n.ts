/**
 * 国际化配置 - 异步加载优化版
 * 
 * 优化点：
 * 1. 语言包按需异步加载，减少首屏 ~50-100KB
 * 2. 使用动态 import 加载语言资源
 * 3. 保留原有 API 兼容性
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// 语言包加载器
const loadLanguageResources = async (lng: string): Promise<Record<string, unknown>> => {
  switch (lng) {
    case 'zh':
      return (await import('./locales/zh')).default;
    case 'en':
    default:
      return (await import('./locales/en')).default;
  }
};

// 检测语言
const detectLanguage = (): string => {
  if (typeof window === 'undefined') return 'en';
  
  const saved = localStorage.getItem('i18nextLng');
  if (saved) return saved;
  
  const browserLang = navigator.language || (navigator as { userLanguage?: string }).userLanguage;
  if (browserLang?.startsWith('zh')) return 'zh';
  
  return 'en';
};

// 初始化 i18n（异步）
export const initI18n = async (): Promise<typeof i18n> => {
  const lng = detectLanguage();
  
  try {
    const resources = await loadLanguageResources(lng);
    
    await i18n.use(initReactI18next).init({
      lng,
      fallbackLng: 'en',
      resources: {
        [lng]: { translation: resources }
      },
      interpolation: {
        escapeValue: false,
      },
    });
    
    return i18n;
  } catch (error) {
    console.error('[i18n] Failed to load resources:', error);
    // 回退初始化
    await i18n.use(initReactI18next).init({
      lng: 'en',
      fallbackLng: 'en',
      resources: {},
    });
    return i18n;
  }
};

// 切换语言
export const changeLanguage = async (lng: string): Promise<void> => {
  try {
    // 检查资源是否已加载
    if (!i18n.hasResourceBundle(lng, 'translation')) {
      const resources = await loadLanguageResources(lng);
      i18n.addResourceBundle(lng, 'translation', resources);
    }
    await i18n.changeLanguage(lng);
    if (typeof window !== 'undefined') {
      localStorage.setItem('i18nextLng', lng);
    }
  } catch (error) {
    console.error(`[i18n] Failed to change language to ${lng}:`, error);
  }
};

// 导出 i18n 实例（注意：此时可能还未初始化，需要调用 initI18n）
export default i18n;
