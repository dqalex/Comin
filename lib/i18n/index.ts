/**
 * 国际化配置 - 异步加载语言包
 * 
 * 优化前：所有语言包内联在代码中 (940 行)
 * 优化后：动态加载语言包，减少首屏 ~50-100KB
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// 语言包动态加载函数
const loadResources = async (lng: string) => {
  switch (lng) {
    case 'zh':
      return import('../locales/zh').then((m) => m.default);
    case 'en':
    default:
      return import('../locales/en').then((m) => m.default);
  }
};

// 检测浏览器语言
const detectLanguage = (): string => {
  if (typeof window === 'undefined') return 'en';
  
  // 1. 检查 localStorage
  const saved = localStorage.getItem('i18nextLng');
  if (saved) return saved;
  
  // 2. 检查浏览器语言
  const browserLang = navigator.language || (navigator as { userLanguage?: string }).userLanguage;
  if (browserLang?.startsWith('zh')) return 'zh';
  
  return 'en';
};

// 初始化 i18n
export const initI18n = async () => {
  const lng = detectLanguage();
  
  try {
    const resources = await loadResources(lng);
    
    await i18n.use(initReactI18next).init({
      lng,
      fallbackLng: 'en',
      resources: {
        [lng]: { translation: resources }
      },
      interpolation: {
        escapeValue: false, // React 已经处理了 XSS 防护
      },
    });
    
    return i18n;
  } catch (error) {
    console.error('[i18n] Failed to load language resources:', error);
    // 回退到英文
    await i18n.use(initReactI18next).init({
      lng: 'en',
      fallbackLng: 'en',
      resources: {},
    });
    return i18n;
  }
};

// 切换语言
export const changeLanguage = async (lng: string) => {
  try {
    const resources = await loadResources(lng);
    i18n.addResourceBundle(lng, 'translation', resources);
    await i18n.changeLanguage(lng);
    if (typeof window !== 'undefined') {
      localStorage.setItem('i18nextLng', lng);
    }
  } catch (error) {
    console.error(`[i18n] Failed to change language to ${lng}:`, error);
  }
};

export default i18n;
