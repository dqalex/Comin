/**
 * Markdown 解析工具函数
 */

import type { Section } from './types';

/**
 * 解析可折叠章节
 * 根据标题层级构建树形结构
 */
export function parseCollapsibleSections(content: string): Section[] {
  const lines = content.split('\n');
  const root: Section[] = [];
  const stack: { level: number; section: Section }[] = [];
  let currentContent = '';
  let currentContentStartLine = 0;
  let inCodeBlock = false;

  function flushContent(target: Section[]) {
    if (currentContent.trim()) {
      target.push({ type: 'content', rawContent: currentContent, children: [], startLine: currentContentStartLine });
    }
    currentContent = '';
  }

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    // 检测代码块的开始和结束（支持 ``` 和 ```` 等）
    if (/^(`{3,})/.test(line)) {
      inCodeBlock = !inCodeBlock;
      if (!currentContent) currentContentStartLine = lineIdx;
      currentContent += line + '\n';
      continue;
    }

    // 在代码块内，不解析标题
    if (inCodeBlock) {
      currentContent += line + '\n';
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const title = headingMatch[2];
      const currentParent = stack.length > 0 ? stack[stack.length - 1].section.children : root;
      flushContent(currentParent);

      const newSection: Section = { type: 'heading', level, title, rawContent: line, children: [], startLine: lineIdx };
      while (stack.length > 0 && stack[stack.length - 1].level >= level) {
        stack.pop();
      }
      const parent = stack.length > 0 ? stack[stack.length - 1].section.children : root;
      parent.push(newSection);
      stack.push({ level, section: newSection });
    } else {
      if (!currentContent) currentContentStartLine = lineIdx;
      currentContent += line + '\n';
    }
  }

  const finalParent = stack.length > 0 ? stack[stack.length - 1].section.children : root;
  flushContent(finalParent);
  return root;
}

/**
 * 解析 YAML frontmatter 为键值对
 * 支持 --- 包围的 frontmatter 和行首无 --- 的纯 key: value 格式
 */
export function parseFrontmatter(content: string): { meta: Record<string, string>; body: string } | null {
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!fmMatch) return null;

  const meta: Record<string, string> = {};
  const lines = fmMatch[1].split('\n');
  for (const line of lines) {
    const kvMatch = line.match(/^(\w[\w\s]*?):\s*(.+)$/);
    if (kvMatch) {
      meta[kvMatch[1].trim()] = kvMatch[2].trim();
    }
  }

  if (Object.keys(meta).length === 0) return null;
  return { meta, body: fmMatch[2] };
}

/**
 * HTML 转义函数
 * 仅转义 HTML 结构性字符（& < >），保留 Markdown 语法字符（` " ' = /）
 * 这样后续正则可以正确匹配代码块等 Markdown 语法
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
