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

// content: MD 渲染（统一处理所有 MD 支持的内容类型：标题、文字、列表、表格等）
// image: 图片 URL（MD 不支持的富媒体）
// data: 数据指标（纯数值/短文本，直接 textContent 注入）
export type SlotType = 'content' | 'image' | 'data' | 'text' | 'richtext';

export interface SlotDef {
  label: string;
  type: SlotType;
  description?: string;
  placeholder?: string;
}

export interface SlotValue {
  name: string;
  type: SlotType;
  content: string;  // content: MD 原文（渲染为 HTML）, image: URL, data: 数值/短文本
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

// 备用模式：无结束标记时，从 @slot:name 到下一个 @slot 或文档末尾
const MD_SLOT_PATTERN_OPEN = /<!-- @slot:(\w+) -->\n?([\s\S]*?)(?=<!-- @slot:\w+ -->|$)/g;

// DOMPurify 白名单标签（richtext 允许的 HTML 标签）
const ALLOWED_TAGS = [
  'strong', 'em', 'b', 'i', 'a', 'br', 'p', 'ul', 'ol', 'li', 'code', 'pre', 'span',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'hr', 'del',
  'table', 'thead', 'tbody', 'tr', 'td', 'th',
];
const ALLOWED_ATTRS = ['href', 'target', 'rel', 'class'];

// ===== MD → Slot 提取 =====

/**
 * 从 MD 内容中提取所有槽位值
 * 支持两种格式：
 * 1. 完整格式：<!-- @slot:name -->content<!-- @/slot -->
 * 2. 简化格式：<!-- @slot:name -->content（到下一个 slot 或文档末尾）
 */
export function extractSlotsFromMd(
  mdContent: string,
  slotDefs: Record<string, SlotDef>
): Map<string, SlotValue> {
  const slots = new Map<string, SlotValue>();

  // 先尝试完整格式（有结束标记）
  const closedMatches = [...mdContent.matchAll(MD_SLOT_PATTERN)];

  if (closedMatches.length > 0) {
    // 有结束标记的完整格式
    for (const match of closedMatches) {
      const name = match[1];
      const content = match[2].trim();
      const def = slotDefs[name];
      const type = def?.type || 'content';
      slots.set(name, { name, type, content });
    }
  } else {
    // 降级：无结束标记的简化格式
    const openMatches = mdContent.matchAll(MD_SLOT_PATTERN_OPEN);
    for (const match of openMatches) {
      const name = match[1];
      const content = match[2].trim();
      const def = slotDefs[name];
      const type = def?.type || 'content';
      slots.set(name, { name, type, content });
    }
  }

  return slots;
}

/**
 * 更新 MD 中指定槽位的内容
 * 支持有结束标记和无结束标记两种格式
 */
export function updateMdSlot(
  mdContent: string,
  slotName: string,
  newContent: string
): string {
  // 先尝试完整格式（有结束标记）
  const closedPattern = new RegExp(
    `(<!-- @slot:${escapeRegex(slotName)} -->)[\\s\\S]*?(<!-- @\\/slot -->)`,
    'g'
  );
  if (closedPattern.test(mdContent)) {
    // 重置 lastIndex（全局正则 test 后 lastIndex 不为 0）
    closedPattern.lastIndex = 0;
    return mdContent.replace(closedPattern, `$1\n${newContent}\n$2`);
  }

  // 降级：无结束标记格式（替换到下一个 slot 开始或文档末尾）
  const openPattern = new RegExp(
    `(<!-- @slot:${escapeRegex(slotName)} -->)\\n?[\\s\\S]*?(?=<!-- @slot:\\w+ -->|$)`,
    'g'
  );
  return mdContent.replace(openPattern, `$1\n${newContent}\n`);
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
    const type = typeAttr || def?.type || 'content';

    let content = '';
    switch (type) {
      case 'content':
      case 'richtext':
      case 'text':
        // 统一从 innerHTML 反解 MD（因为注入时统一用 innerHTML）
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
 * MD 渲染的 slot 容器内 HTML 标签的默认样式表
 * 使用 [data-slot-type="content"] 限定作用域
 * 同时保留 [data-slot-type="richtext"] 向后兼容
 */
export const MD_RICHTEXT_STYLES = `
[data-slot-type="content"] h1, [data-slot-type="content"] h2,
[data-slot-type="content"] h3, [data-slot-type="content"] h4,
[data-slot-type="content"] h5, [data-slot-type="content"] h6,
[data-slot-type="richtext"] h1, [data-slot-type="richtext"] h2,
[data-slot-type="richtext"] h3, [data-slot-type="richtext"] h4,
[data-slot-type="richtext"] h5, [data-slot-type="richtext"] h6 {
  margin: 0.6em 0 0.3em; font-weight: 600; line-height: 1.4;
}
[data-slot-type="content"] h1, [data-slot-type="richtext"] h1 { font-size: 1.4em; }
[data-slot-type="content"] h2, [data-slot-type="richtext"] h2 { font-size: 1.2em; }
[data-slot-type="content"] h3, [data-slot-type="richtext"] h3 { font-size: 1.1em; }
[data-slot-type="content"] ul, [data-slot-type="content"] ol,
[data-slot-type="richtext"] ul, [data-slot-type="richtext"] ol {
  margin: 0.4em 0; padding-left: 1.6em;
}
[data-slot-type="content"] li, [data-slot-type="richtext"] li {
  margin: 0.15em 0; line-height: 1.7;
}
[data-slot-type="content"] ul, [data-slot-type="richtext"] ul { list-style-type: disc; }
[data-slot-type="content"] ol, [data-slot-type="richtext"] ol { list-style-type: decimal; }
[data-slot-type="content"] blockquote, [data-slot-type="richtext"] blockquote {
  margin: 0.5em 0; padding: 0.4em 1em;
  border-left: 3px solid currentColor; opacity: 0.85;
}
[data-slot-type="content"] hr, [data-slot-type="richtext"] hr {
  border: none; border-top: 1px solid currentColor; opacity: 0.2; margin: 0.8em 0;
}
[data-slot-type="content"] code, [data-slot-type="richtext"] code {
  padding: 0.15em 0.4em; border-radius: 3px;
  background: rgba(0,0,0,0.06); font-size: 0.9em; font-family: 'SF Mono', 'Fira Code', monospace;
}
[data-slot-type="content"] pre, [data-slot-type="richtext"] pre {
  margin: 0.5em 0; padding: 0.8em 1em; border-radius: 6px;
  background: rgba(0,0,0,0.06); overflow-x: auto;
}
[data-slot-type="content"] pre code, [data-slot-type="richtext"] pre code {
  padding: 0; background: none; font-size: 0.85em;
}
[data-slot-type="content"] table, [data-slot-type="richtext"] table {
  width: 100%; border-collapse: collapse; margin: 0.5em 0; font-size: 0.9em;
}
[data-slot-type="content"] th, [data-slot-type="content"] td,
[data-slot-type="richtext"] th, [data-slot-type="richtext"] td {
  padding: 0.4em 0.6em; border: 1px solid rgba(0,0,0,0.1); text-align: left;
}
[data-slot-type="content"] th, [data-slot-type="richtext"] th {
  font-weight: 600; background: rgba(0,0,0,0.03);
}
[data-slot-type="content"] p, [data-slot-type="richtext"] p {
  margin: 0.3em 0; line-height: 1.7;
}
[data-slot-type="content"] a, [data-slot-type="richtext"] a {
  color: inherit; text-decoration: underline; text-underline-offset: 2px;
}
[data-slot-type="content"] del, [data-slot-type="richtext"] del {
  text-decoration: line-through; opacity: 0.6;
}
[data-slot-type="content"] strong, [data-slot-type="richtext"] strong { font-weight: 700; }
[data-slot-type="content"] em, [data-slot-type="richtext"] em { font-style: italic; }
[data-slot-type="content"] mark, [data-slot-type="richtext"] mark {
  background: rgba(255, 213, 79, 0.4); padding: 0.1em 0.2em; border-radius: 2px;
}
[data-slot-type="content"] img, [data-slot-type="richtext"] img {
  max-width: 100%; height: auto; border-radius: 4px; margin: 0.4em 0;
}
[data-slot-type="content"] input[type="checkbox"], [data-slot-type="richtext"] input[type="checkbox"] {
  margin-right: 6px; vertical-align: middle; accent-color: #3b82f6;
}
`.trim();

/**
 * 将 slot 值注入到 HTML 模板中
 * 保留模板结构，只替换 slot 元素的内容
 * content/richtext/text slot 的 MD 内容会经 simpleMdToHtml 转 HTML + DOMPurify 清洗
 * 自动注入 MD 渲染样式表
 */
export function injectSlotsToHtml(
  htmlTemplate: string,
  slots: Map<string, SlotValue>,
  cssTemplate?: string
): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlTemplate, 'text/html');
  const elements = doc.querySelectorAll('[data-slot]');

  let hasMdContent = false;

  elements.forEach((el) => {
    const name = el.getAttribute('data-slot') || '';
    const slot = slots.get(name);
    if (!slot) return;

    const type = (el.getAttribute('data-slot-type') as SlotType) || slot.type;

    switch (type) {
      case 'content':
      case 'richtext':
      case 'text':
        // 统一走 MD→HTML 渲染（核心变更：text 不再用 textContent）
        hasMdContent = true;
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

  // 注入 MD 渲染样式表（当存在 content/richtext/text slot 时）
  if (hasMdContent) {
    let mdStyleEl = doc.querySelector('style[data-md-styles]');
    if (!mdStyleEl) {
      mdStyleEl = doc.createElement('style');
      mdStyleEl.setAttribute('data-md-styles', 'true');
      doc.head.appendChild(mdStyleEl);
    }
    mdStyleEl.textContent = MD_RICHTEXT_STYLES;
  }

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
 * 内联 MD 格式转 HTML（加粗、斜体、删除线、代码、链接）
 * 先转义 HTML 实体，再处理 MD 语法
 */
function inlineMdToHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // 内联代码（先处理，防止内部被其他规则干扰）
    .replace(/`(.+?)`/g, '<code>$1</code>')
    // 图片（必须在链接之前处理，否则 ![alt](url) 会被链接规则匹配）
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%;height:auto;" />')
    // 加粗（**text** 和 __text__）
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    // 斜体（*text* 和 _text_，注意：_text_ 只匹配非空格包围的）
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/(?<!\w)_(.+?)_(?!\w)/g, '<em>$1</em>')
    // 删除线
    .replace(/~~(.+?)~~/g, '<del>$1</del>')
    // 高亮（==text==）
    .replace(/==(.+?)==/g, '<mark>$1</mark>')
    // 链接
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    // 自动链接（裸 URL）
    .replace(/(^|[\s(])((https?:\/\/)[^\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noopener noreferrer">$2</a>');
}

/**
 * MD → HTML（用于 richtext slot，支持常用 Markdown 块级和内联语法）
 *
 * 支持的块级元素：标题(h1-h6)、无序列表、有序列表、任务列表(- [x])、引用、水平线、代码块、表格
 * 支持的内联元素：加粗、斜体、删除线、高亮、内联代码、链接、图片、自动链接
 *
 *
 * 设计选择：自实现而非引入 marked/remark，因为只在 slot 注入场景使用，
 * 内容规模小、需配合 DOMPurify 清洗，无需完整解析器的复杂度和体积。
 */
export function simpleMdToHtml(md: string): string {
  if (!md) return '';

  const lines = md.split('\n');
  const html: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // --- 空行：跳过 ---
    if (line.trim() === '') {
      i++;
      continue;
    }

    // --- 水平线：--- 或 *** 或 ___ ---
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line.trim())) {
      html.push('<hr />');
      i++;
      continue;
    }

    // --- 标题：# ~ ###### ---
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      html.push(`<h${level}>${inlineMdToHtml(headingMatch[2])}</h${level}>`);
      i++;
      continue;
    }

    // --- 代码块：```...``` ---
    if (line.trim().startsWith('```')) {
      i++;
      const codeLines: string[] = [];
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i].replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'));
        i++;
      }
      if (i < lines.length) i++; // 跳过结束 ```
      html.push(`<pre><code>${codeLines.join('\n')}</code></pre>`);
      continue;
    }

    // --- 表格：| ... | ---
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      const tableRows: string[] = [];
      let isHeader = true;
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        const row = lines[i].trim();
        // 跳过分隔行 |---|---|
        if (/^\|[\s\-:]+\|$/.test(row.replace(/\|/g, m => m).replace(/[^|\-:\s]/g, ''))) {
          i++;
          isHeader = false;
          continue;
        }
        const cells = row.slice(1, -1).split('|').map(c => inlineMdToHtml(c.trim()));
        const tag = isHeader ? 'th' : 'td';
        tableRows.push(`<tr>${cells.map(c => `<${tag}>${c}</${tag}>`).join('')}</tr>`);
        if (isHeader) isHeader = false; // 第一行后不再是 header（除非遇到分隔行才转）
        i++;
      }
      html.push(`<table>${tableRows.join('')}</table>`);
      continue;
    }

    // --- 引用块：> ... ---
    if (line.trim().startsWith('> ') || line.trim() === '>') {
      const quoteLines: string[] = [];
      while (i < lines.length && (lines[i].trim().startsWith('> ') || lines[i].trim() === '>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      html.push(`<blockquote>${inlineMdToHtml(quoteLines.join('<br />'))}</blockquote>`);
      continue;
    }

    // --- 无序列表：- 或 * 开头（支持 - [x] / - [ ] 任务列表） ---
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      let hasCheckbox = false;
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        let itemText = lines[i].replace(/^\s*[-*]\s+/, '');
        // 任务列表：- [x] / - [ ]
        const checkMatch = itemText.match(/^\[([ xX])\]\s+(.*)/);
        if (checkMatch) {
          hasCheckbox = true;
          const checked = checkMatch[1].toLowerCase() === 'x';
          const checkbox = `<input type="checkbox" ${checked ? 'checked' : ''} disabled style="margin-right:6px;vertical-align:middle;" />`;
          items.push(`${checkbox}${inlineMdToHtml(checkMatch[2])}`);
        } else {
          items.push(inlineMdToHtml(itemText));
        }
        i++;
      }
      const listStyle = hasCheckbox ? ' style="list-style:none;padding-left:0.4em;"' : '';
      html.push(`<ul${listStyle}>${items.map(item => `<li>${item}</li>`).join('')}</ul>`);
      continue;
    }

    // --- 有序列表：1. 开头 ---
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(inlineMdToHtml(lines[i].replace(/^\s*\d+\.\s+/, '')));
        i++;
      }
      html.push(`<ol>${items.map(item => `<li>${item}</li>`).join('')}</ol>`);
      continue;
    }

    // --- 普通段落：连续非空行合并为一个 <p> ---
    const paraLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== '' &&
      !lines[i].trim().startsWith('#') &&
      !lines[i].trim().startsWith('```') &&
      !lines[i].trim().startsWith('> ') &&
      !lines[i].trim().startsWith('|') &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !/^(-{3,}|\*{3,}|_{3,})\s*$/.test(lines[i].trim())) {
      paraLines.push(inlineMdToHtml(lines[i]));
      i++;
    }
    if (paraLines.length > 0) {
      html.push(`<p>${paraLines.join('<br />')}</p>`);
    }
  }

  return html.join('\n');
}

/**
 * HTML → MD（从 richtext slot 提取 MD）
 * 反向转换 simpleMdToHtml 支持的标签，按块级→内联顺序处理
 */
export function htmlToSimpleMd(html: string): string {
  if (!html) return '';

  let md = html
    // 移除多余空白（但保留换行上下文）
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, ' ');

  // --- 块级元素（先处理，避免被后续内联规则干扰）---

  // 水平线
  md = md.replace(/<hr\s*\/?>/gi, '\n---\n');

  // 标题 h1-h6
  md = md.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_m, level, content) => {
    return '\n' + '#'.repeat(parseInt(level)) + ' ' + content.trim() + '\n';
  });

  // 代码块
  md = md.replace(/<pre[^>]*>\s*<code[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/gi, (_m, content) => {
    const decoded = content.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    return '\n```\n' + decoded + '\n```\n';
  });

  // 表格
  md = md.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (_m, tableContent) => {
    const rows: string[][] = [];
    const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch;
    while ((rowMatch = rowPattern.exec(tableContent)) !== null) {
      const cells: string[] = [];
      const cellPattern = /<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi;
      let cellMatch;
      while ((cellMatch = cellPattern.exec(rowMatch[1])) !== null) {
        cells.push(cellMatch[1].replace(/<[^>]+>/g, '').trim());
      }
      rows.push(cells);
    }
    if (rows.length === 0) return '';
    const lines: string[] = [];
    rows.forEach((row, idx) => {
      lines.push('| ' + row.join(' | ') + ' |');
      if (idx === 0) {
        lines.push('| ' + row.map(() => '---').join(' | ') + ' |');
      }
    });
    return '\n' + lines.join('\n') + '\n';
  });

  // 引用块
  md = md.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_m, content) => {
    const text = content.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim();
    return '\n' + text.split('\n').map((l: string) => '> ' + l).join('\n') + '\n';
  });

  // 有序列表
  md = md.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_m, content) => {
    const items: string[] = [];
    const liPattern = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    let liMatch;
    let num = 1;
    while ((liMatch = liPattern.exec(content)) !== null) {
      items.push(`${num}. ` + liMatch[1].replace(/<[^>]+>/g, '').trim());
      num++;
    }
    return '\n' + items.join('\n') + '\n';
  });

  // 无序列表（支持任务列表 checkbox）
  md = md.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_m, content) => {
    const items: string[] = [];
    const liPattern = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    let liMatch;
    while ((liMatch = liPattern.exec(content)) !== null) {
      let liContent = liMatch[1];
      // 检测 checkbox（任务列表）
      const checkedMatch = liContent.match(/<input[^>]*checked[^>]*>/i);
      const uncheckedMatch = !checkedMatch && liContent.match(/<input[^>]*type=["']checkbox["'][^>]*>/i);
      if (checkedMatch) {
        liContent = liContent.replace(/<input[^>]*>/gi, '').trim();
        items.push('- [x] ' + liContent.replace(/<[^>]+>/g, '').trim());
      } else if (uncheckedMatch) {
        liContent = liContent.replace(/<input[^>]*>/gi, '').trim();
        items.push('- [ ] ' + liContent.replace(/<[^>]+>/g, '').trim());
      } else {
        items.push('- ' + liContent.replace(/<[^>]+>/g, '').trim());
      }
    }
    return '\n' + items.join('\n') + '\n';
  });

  // --- 内联元素 ---

  // 换行
  md = md.replace(/<br\s*\/?>/gi, '\n');
  // 图片（在移除标签之前处理）
  md = md.replace(/<img[^>]+src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, '![$2]($1)');
  md = md.replace(/<img[^>]+alt="([^"]*)"[^>]*src="([^"]*)"[^>]*\/?>/gi, '![$1]($2)');
  // 高亮
  md = md.replace(/<mark>(.*?)<\/mark>/gi, '==$1==');
  // 加粗
  md = md.replace(/<strong>(.*?)<\/strong>/gi, '**$1**');
  md = md.replace(/<b>(.*?)<\/b>/gi, '**$1**');
  // 斜体
  md = md.replace(/<em>(.*?)<\/em>/gi, '*$1*');
  md = md.replace(/<i>(.*?)<\/i>/gi, '*$1*');
  // 删除线
  md = md.replace(/<del>(.*?)<\/del>/gi, '~~$1~~');
  // 内联代码
  md = md.replace(/<code>(.*?)<\/code>/gi, '`$1`');
  // 链接
  md = md.replace(/<a[^>]+href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)');
  // 段落
  md = md.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n');
  // 移除其他 HTML 标签
  md = md.replace(/<[^>]+>/g, '');
  // 解码 HTML 实体
  md = md.replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  // 清理多余空行（最多保留 2 个连续换行）
  md = md.replace(/\n{3,}/g, '\n\n');

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
      slotType: el.getAttribute('data-slot-type') || 'content',
      styles: getComputedStyles(el),
      content: getSlotContent(el),
    }, '*');
  }

  function handleDblClick(e) {
    e.stopPropagation();
    if (!editMode) return;

    const el = e.currentTarget;
    const slotType = el.getAttribute('data-slot-type') || 'content';

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

    // 实时同步编辑内容（input 事件，每次击键都通知父窗口）
    const onInput = () => {
      notifyChange();
    };
    el.addEventListener('input', onInput);

    // 监听编辑完成
    const onFinish = () => {
      el.removeAttribute('contenteditable');
      el.removeAttribute('data-editable');
      el.removeEventListener('blur', onFinish);
      el.removeEventListener('focusout', onFinish); // Safari 兼容
      el.removeEventListener('input', onInput);
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
    const type = el.getAttribute('data-slot-type') || 'content';
    switch (type) {
      case 'content':
      case 'richtext':
      case 'text':
        return el.innerHTML;
      case 'image': {
        const img = el.querySelector('img');
        return img ? img.src : '';
      }
      default: return el.innerHTML;
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
        const slotType = el.getAttribute('data-slot-type') || 'content';
        if (slotType === 'data') {
          el.textContent = value;
        } else {
          el.innerHTML = value;
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
  function init() {
    initElements();
    // 脚本只在编辑模式下注入，所以初始化后直接进入编辑模式
    editMode = true;
    document.body.classList.add('studio-edit-mode');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
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
