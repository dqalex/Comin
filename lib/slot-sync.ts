/**
 * 槽位同步核心库（移植自 GrowthPilot useSync.js）
 *
 * 负责 MD ↔ HTML 的双向槽位同步：
 * - MD 中使用 <!-- @slot:name -->...<!-- @/slot --> 标记槽位
 * - HTML 中使用 data-slot="name" data-slot-type="text|richtext|image" 标记槽位
 *
 * 设计要点（来自 GrowthPilot 踩坑经验）：
 * - 使用 matchAll 而非全局正则（避免 lastIndex 不重置问题）
 * - syncLock 互斥锁防止 MD→HTML→MD 无限循环
 * - richtext 内容经 DOMPurify 清洗（XSS 防护）
 * - 模板引用分离：同步只替换 slot 内容，不修改模板结构
 */

import DOMPurify from 'dompurify';

// ===== 类型定义 =====

export type SlotType = 'text' | 'richtext' | 'image' | 'data';

export interface SlotDef {
  label: string;
  type: SlotType;
  description?: string;
  placeholder?: string;
}

export interface SlotValue {
  name: string;
  type: SlotType;
  content: string;  // text: 纯文本, richtext: 简易MD, image: URL, data: JSON 字符串
}

export interface SlotSyncResult {
  html: string;
  slots: Map<string, SlotValue>;
  errors: string[];
}

// ===== 常量 =====

// MD 槽位标记：<!-- @slot:name -->content<!-- @/slot -->
// 使用非全局正则 + matchAll（GrowthPilot 踩坑：全局正则 lastIndex 不重置）
const MD_SLOT_PATTERN = /<!-- @slot:(\w+) -->([\s\S]*?)<!-- @\/slot -->/g;

// DOMPurify 白名单标签（richtext 允许的 HTML 标签）
const ALLOWED_TAGS = ['strong', 'em', 'b', 'i', 'a', 'br', 'p', 'ul', 'ol', 'li', 'code', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote'];
const ALLOWED_ATTRS = ['href', 'target', 'rel', 'class'];

// ===== MD → Slot 提取 =====

/**
 * 从 MD 内容中提取所有槽位值
 */
export function extractSlotsFromMd(
  mdContent: string,
  slotDefs: Record<string, SlotDef>
): Map<string, SlotValue> {
  const slots = new Map<string, SlotValue>();
  const matches = mdContent.matchAll(MD_SLOT_PATTERN);

  for (const match of matches) {
    const name = match[1];
    const content = match[2].trim();
    const def = slotDefs[name];
    const type = def?.type || 'text';

    slots.set(name, { name, type, content });
  }

  return slots;
}

/**
 * 更新 MD 中指定槽位的内容
 */
export function updateMdSlot(
  mdContent: string,
  slotName: string,
  newContent: string
): string {
  const pattern = new RegExp(
    `(<!-- @slot:${escapeRegex(slotName)} -->)[\\s\\S]*?(<!-- @\\/slot -->)`,
    'g'
  );
  return mdContent.replace(pattern, `$1\n${newContent}\n$2`);
}

/**
 * 批量更新 MD 中的多个槽位
 */
export function updateMdSlots(
  mdContent: string,
  updates: Record<string, string>
): string {
  let result = mdContent;
  for (const [name, content] of Object.entries(updates)) {
    result = updateMdSlot(result, name, content);
  }
  return result;
}

// ===== HTML → Slot 提取 =====

/**
 * 从 HTML 文档中提取所有槽位值
 */
export function extractSlotsFromHtml(
  htmlContent: string,
  slotDefs: Record<string, SlotDef>
): Map<string, SlotValue> {
  const slots = new Map<string, SlotValue>();

  // 使用 DOMParser 解析 HTML（比正则更可靠）
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, 'text/html');
  const elements = doc.querySelectorAll('[data-slot]');

  elements.forEach((el) => {
    const name = el.getAttribute('data-slot') || '';
    const typeAttr = el.getAttribute('data-slot-type') as SlotType | null;
    const def = slotDefs[name];
    const type = typeAttr || def?.type || 'text';

    let content = '';
    switch (type) {
      case 'text':
        content = el.textContent || '';
        break;
      case 'richtext':
        content = htmlToSimpleMd(el.innerHTML);
        break;
      case 'image': {
        const img = el.querySelector('img');
        content = img?.getAttribute('src') || el.getAttribute('data-src') || '';
        break;
      }
      case 'data':
        content = el.getAttribute('data-value') || el.textContent || '';
        break;
    }

    slots.set(name, { name, type, content: content.trim() });
  });

  return slots;
}

/**
 * 将 slot 值注入到 HTML 模板中
 * 保留模板结构，只替换 slot 元素的内容
 */
export function injectSlotsToHtml(
  htmlTemplate: string,
  slots: Map<string, SlotValue>,
  cssTemplate?: string
): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlTemplate, 'text/html');
  const elements = doc.querySelectorAll('[data-slot]');

  elements.forEach((el) => {
    const name = el.getAttribute('data-slot') || '';
    const slot = slots.get(name);
    if (!slot) return;

    const type = (el.getAttribute('data-slot-type') as SlotType) || slot.type;

    switch (type) {
      case 'text':
        el.textContent = slot.content;
        break;
      case 'richtext':
        // 必须经 DOMPurify 清洗（v3.0 强制）
        el.innerHTML = sanitizeHtml(simpleMdToHtml(slot.content));
        break;
      case 'image': {
        const img = el.querySelector('img');
        if (img) {
          img.setAttribute('src', slot.content);
        } else if (slot.content) {
          el.innerHTML = `<img src="${escapeAttr(slot.content)}" alt="" style="width:100%;height:auto;" />`;
        }
        break;
      }
      case 'data':
        el.setAttribute('data-value', slot.content);
        el.textContent = slot.content;
        break;
    }
  });

  // 注入自定义 CSS
  if (cssTemplate) {
    let styleEl = doc.querySelector('style[data-studio-css]');
    if (!styleEl) {
      styleEl = doc.createElement('style');
      styleEl.setAttribute('data-studio-css', 'true');
      doc.head.appendChild(styleEl);
    }
    styleEl.textContent = cssTemplate;
  }

  // 手动拼接 DOCTYPE（DOMParser 不保留 doctype，GrowthPilot 踩坑）
  return '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
}

// ===== MD ↔ HTML 双向同步 =====

/**
 * 从 MD 内容同步到 HTML：提取 MD 槽位 → 注入到 HTML 模板
 */
export function syncMdToHtml(
  mdContent: string,
  htmlTemplate: string,
  slotDefs: Record<string, SlotDef>,
  cssTemplate?: string
): SlotSyncResult {
  const errors: string[] = [];
  const slots = extractSlotsFromMd(mdContent, slotDefs);

  // 检查是否所有 slot 都有值
  for (const [name, def] of Object.entries(slotDefs)) {
    if (!slots.has(name)) {
      errors.push(`MD 中缺少槽位 @slot:${name} (${def.label})`);
    }
  }

  const html = injectSlotsToHtml(htmlTemplate, slots, cssTemplate);
  return { html, slots, errors };
}

/**
 * 从 HTML 内容同步到 MD：提取 HTML 槽位 → 更新 MD 中对应标记
 */
export function syncHtmlToMd(
  htmlContent: string,
  mdContent: string,
  slotDefs: Record<string, SlotDef>
): { md: string; slots: Map<string, SlotValue>; errors: string[] } {
  const errors: string[] = [];
  const slots = extractSlotsFromHtml(htmlContent, slotDefs);

  const updates: Record<string, string> = {};
  for (const [name, slot] of slots) {
    updates[name] = slot.content;
  }

  const md = updateMdSlots(mdContent, updates);
  return { md, slots, errors };
}

// ===== 简易 MD ↔ HTML 转换 =====

/**
 * 简易 MD → HTML（仅用于 richtext slot，不是完整 Markdown 解析器）
 * 支持：bold, italic, links, line breaks, code
 */
export function simpleMdToHtml(md: string): string {
  if (!md) return '';

  let html = md
    // 转义 HTML 实体
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // 加粗
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // 斜体
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // 内联代码
    .replace(/`(.+?)`/g, '<code>$1</code>')
    // 链接
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    // 换行
    .replace(/\n/g, '<br />');

  return html;
}

/**
 * 简易 HTML → MD（从 richtext slot 提取 MD）
 * 反向转换 simpleMdToHtml 支持的标签
 */
export function htmlToSimpleMd(html: string): string {
  if (!html) return '';

  let md = html
    // 移除多余空白
    .replace(/\s+/g, ' ')
    // 换行
    .replace(/<br\s*\/?>/gi, '\n')
    // 加粗
    .replace(/<strong>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<b>(.*?)<\/b>/gi, '**$1**')
    // 斜体
    .replace(/<em>(.*?)<\/em>/gi, '*$1*')
    .replace(/<i>(.*?)<\/i>/gi, '*$1*')
    // 内联代码
    .replace(/<code>(.*?)<\/code>/gi, '`$1`')
    // 链接
    .replace(/<a[^>]+href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
    // 段落
    .replace(/<p>(.*?)<\/p>/gi, '$1\n')
    // 移除其他 HTML 标签
    .replace(/<[^>]+>/g, '')
    // 解码 HTML 实体
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  return md.trim();
}

// ===== 安全 =====

/**
 * HTML 内容清洗（DOMPurify）
 */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ALLOWED_ATTRS,
  });
}

/**
 * 清理 iframe 注入的编辑属性（GrowthPilot 经验）
 * 导出/保存前必须调用
 */
export function cleanEditorAttributes(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // 移除编辑相关属性（用 DOMParser 操作 classList，不用正则 — GrowthPilot 踩坑）
  doc.querySelectorAll('[contenteditable]').forEach((el) => {
    el.removeAttribute('contenteditable');
  });
  doc.querySelectorAll('[data-editable]').forEach((el) => {
    el.removeAttribute('data-editable');
  });
  doc.querySelectorAll('.element-selected, .element-hover').forEach((el) => {
    el.classList.remove('element-selected', 'element-hover');
  });

  // 清理空 class 属性（GrowthPilot 踩坑：清理后产生 class="" 空属性）
  doc.querySelectorAll('[class=""]').forEach((el) => {
    el.removeAttribute('class');
  });

  // 移除注入的脚本
  doc.querySelectorAll('script[data-studio-inject]').forEach((el) => {
    el.remove();
  });

  return '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
}

// ===== 模板生成 =====

/**
 * 从渲染模板生成初始 MD 内容（含 slot 标记）
 */
export function generateMdFromTemplate(
  mdTemplate: string,
  slotDefs: Record<string, SlotDef>
): string {
  if (mdTemplate) return mdTemplate;

  // 无 MD 模板时，自动生成骨架
  const lines: string[] = [];
  for (const [name, def] of Object.entries(slotDefs)) {
    lines.push(`<!-- @slot:${name} -->`);
    lines.push(def.placeholder || `[${def.label}]`);
    lines.push(`<!-- @/slot -->`);
    lines.push('');
  }
  return lines.join('\n');
}

/**
 * 生成 iframe 注入脚本（用于 HtmlPreview 组件）
 * 处理：元素选中、内容编辑、样式修改、图片替换
 */
export function generateIframeScript(): string {
  return `
(function() {
  'use strict';

  let selectedElement = null;
  let editMode = false;
  const DEBOUNCE_MS = 100;
  let notifyTimer = null;

  // 初始化：为所有 slot 元素绑定事件
  function initElements() {
    const elements = document.querySelectorAll('[data-slot]');
    elements.forEach(el => {
      el.style.cursor = 'pointer';
      el.addEventListener('click', handleClick);
      el.addEventListener('dblclick', handleDblClick);
      el.addEventListener('mouseover', handleMouseOver);
      el.addEventListener('mouseout', handleMouseOut);

      // 图片容器子元素统一设 pointerEvents: none（GrowthPilot 踩坑）
      const slotType = el.getAttribute('data-slot-type');
      if (slotType === 'image') {
        Array.from(el.children).forEach(child => {
          child.style.pointerEvents = 'none';
        });
      }
    });
  }

  function handleClick(e) {
    e.stopPropagation();
    const el = e.currentTarget;

    if (editMode) return;

    // 取消之前的选中
    deselectElement();

    // 选中当前元素
    selectedElement = el;
    el.classList.add('element-selected');

    window.parent.postMessage({
      type: 'elementSelected',
      slotName: el.getAttribute('data-slot'),
      slotType: el.getAttribute('data-slot-type') || 'text',
      styles: getComputedStyles(el),
      content: getSlotContent(el),
    }, '*');
  }

  function handleDblClick(e) {
    e.stopPropagation();
    if (!editMode) return;

    const el = e.currentTarget;
    const slotType = el.getAttribute('data-slot-type') || 'text';

    if (slotType === 'image') {
      // 图片：通知父窗口弹出替换对话框
      window.parent.postMessage({
        type: 'requestImageReplace',
        slotName: el.getAttribute('data-slot'),
      }, '*');
      return;
    }

    // 文字编辑：判断是否含块级子元素（GrowthPilot 踩坑：编辑块级容器会破坏 DOM 结构）
    const hasBlockChildren = el.querySelector('div,p,h1,h2,h3,h4,h5,h6,ul,ol,blockquote');
    if (hasBlockChildren) return;

    el.setAttribute('contenteditable', 'true');
    el.setAttribute('data-editable', 'true');
    el.focus();

    // 监听编辑完成
    const onFinish = () => {
      el.removeAttribute('contenteditable');
      el.removeAttribute('data-editable');
      el.removeEventListener('blur', onFinish);
      el.removeEventListener('focusout', onFinish); // Safari 兼容
      notifyChange();
    };
    el.addEventListener('blur', onFinish);
    el.addEventListener('focusout', onFinish);
  }

  function handleMouseOver(e) {
    if (selectedElement === e.currentTarget) return;
    e.currentTarget.classList.add('element-hover');
  }

  function handleMouseOut(e) {
    e.currentTarget.classList.remove('element-hover');
  }

  function deselectElement() {
    if (selectedElement) {
      selectedElement.classList.remove('element-selected');
      selectedElement = null;
      window.parent.postMessage({ type: 'elementDeselected' }, '*');
    }
  }

  function getSlotContent(el) {
    const type = el.getAttribute('data-slot-type') || 'text';
    switch (type) {
      case 'text': return el.textContent || '';
      case 'richtext': return el.innerHTML;
      case 'image': {
        const img = el.querySelector('img');
        return img ? img.src : '';
      }
      default: return el.textContent || '';
    }
  }

  function getComputedStyles(el) {
    const cs = window.getComputedStyle(el);
    return {
      fontSize: cs.fontSize,
      fontWeight: cs.fontWeight,
      color: cs.color,
      backgroundColor: cs.backgroundColor,
      textAlign: cs.textAlign,
      fontFamily: cs.fontFamily,
      letterSpacing: cs.letterSpacing,
      lineHeight: cs.lineHeight,
    };
  }

  // 通知父窗口内容变更（防抖 100ms — GrowthPilot 经验）
  function notifyChange() {
    if (notifyTimer) clearTimeout(notifyTimer);
    notifyTimer = setTimeout(() => {
      // 收集所有 slot 当前值
      const slotValues = {};
      document.querySelectorAll('[data-slot]').forEach(el => {
        slotValues[el.getAttribute('data-slot')] = getSlotContent(el);
      });
      window.parent.postMessage({ type: 'contentChanged', slotValues }, '*');
    }, DEBOUNCE_MS);
  }

  // 接收父窗口指令
  window.addEventListener('message', (e) => {
    const { type, slotName, value, styles } = e.data || {};

    switch (type) {
      case 'setStyle': {
        const el = slotName ? document.querySelector('[data-slot="' + slotName + '"]') : selectedElement;
        if (!el || !styles) return;
        Object.entries(styles).forEach(([prop, val]) => {
          el.style[prop] = val;
        });
        notifyChange();
        break;
      }
      case 'setText': {
        const el = document.querySelector('[data-slot="' + slotName + '"]');
        if (!el) return;
        const slotType = el.getAttribute('data-slot-type') || 'text';
        if (slotType === 'richtext') {
          el.innerHTML = value;
        } else {
          el.textContent = value;
        }
        notifyChange();
        break;
      }
      case 'replaceImage': {
        const el = document.querySelector('[data-slot="' + slotName + '"]');
        if (!el) return;
        const img = el.querySelector('img');
        if (img) {
          img.src = value;
        } else {
          el.innerHTML = '<img src="' + value + '" alt="" style="width:100%;height:auto;" />';
        }
        notifyChange();
        break;
      }
      case 'toggleEditMode':
        editMode = !!value;
        document.body.classList.toggle('studio-edit-mode', editMode);
        break;
      case 'deselectAll':
        deselectElement();
        break;
    }
  });

  // 点击空白区域取消选中
  document.addEventListener('click', (e) => {
    if (!e.target.closest('[data-slot]')) {
      deselectElement();
    }
  });

  // 注入选中/悬停样式
  const style = document.createElement('style');
  style.setAttribute('data-studio-inject', 'true');
  style.textContent = \`
    .element-selected {
      outline: 2px solid #3b82f6 !important;
      outline-offset: 2px;
    }
    .element-hover {
      outline: 1px dashed #93c5fd !important;
      outline-offset: 1px;
    }
    .studio-edit-mode [data-slot] {
      cursor: text !important;
    }
    .studio-edit-mode [data-slot][data-slot-type="image"] {
      cursor: pointer !important;
    }
    [contenteditable="true"] {
      outline: 2px solid #f59e0b !important;
      outline-offset: 2px;
    }
  \`;
  document.head.appendChild(style);

  // 初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initElements);
  } else {
    initElements();
  }
})();
  `.trim();
}

// ===== 工具函数 =====

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeAttr(str: string): string {
  return str.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
