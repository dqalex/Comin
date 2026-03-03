'use client';

import { useState, useRef, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { Eye, Columns, Maximize2, ChevronRight, ChevronDown } from 'lucide-react';
import clsx from 'clsx';

// 选中文本信息
export interface EditorTextSelection {
  text: string;
  lineIndex: number;
}

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  onSelectionChange?: (selection: EditorTextSelection | null) => void;
}

type ViewMode = 'edit' | 'preview' | 'split';

function CollapsibleSection({ title, level, children, defaultOpen = true }: {
  title: string;
  level: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const headingSize = {
    1: 'text-2xl',
    2: 'text-xl',
    3: 'text-lg',
    4: 'text-base',
    5: 'text-sm',
    6: 'text-xs',
  }[level] || 'text-base';

  return (
    <div className="md-collapsible">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          'flex items-center gap-1 font-semibold hover:text-primary-500 transition-colors w-full text-left group',
          headingSize
        )}
      >
        <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center opacity-40 group-hover:opacity-100 transition-opacity">
          {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </span>
        <span>{title}</span>
      </button>
      {isOpen && (
        <div className="ml-5 mt-1">
          {children}
        </div>
      )}
    </div>
  );
}

interface Section {
  type: 'heading' | 'content';
  level?: number;
  title?: string;
  rawContent: string;
  children: Section[];
  startLine?: number; // 源码行号（用于批注定位）
}

function parseCollapsibleSections(content: string): Section[] {
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

function renderSection(section: Section, key: number): React.ReactNode {
  if (section.type === 'content') {
    return (
      <div key={key} data-source-line={section.startLine ?? 0}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeHighlight, rehypeRaw, rehypeSanitize]}
        >
          {section.rawContent}
        </ReactMarkdown>
      </div>
    );
  }

  return (
    <div key={key} data-source-line={section.startLine ?? 0}>
      <CollapsibleSection title={section.title!} level={section.level!} defaultOpen={true}>
        {section.children.map((child, idx) => renderSection(child, idx))}
      </CollapsibleSection>
    </div>
  );
}

/**
 * 解析 YAML frontmatter 为键值对
 * 支持 --- 包围的 frontmatter 和行首无 --- 的纯 key: value 格式
 */
function parseFrontmatter(content: string): { meta: Record<string, string>; body: string } | null {
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
 * Frontmatter 标签渲染组件
 * 将 YAML 元数据以标签（badge）样式展示
 */
function FrontmatterBadges({ meta }: { meta: Record<string, string> }) {
  // 特殊字段样式映射
  const fieldStyles: Record<string, string> = {
    title: 'bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-300 font-medium',
    type: 'bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
    project: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
    tags: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
    version: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
    status: 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
    priority: 'bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
  };
  const defaultStyle = 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';

  // title 单独一行显示
  const title = meta.title;
  const restEntries = Object.entries(meta).filter(([k]) => k !== 'title');

  return (
    <div className="mb-4 pb-3 border-b border-slate-200 dark:border-slate-700">
      {title && (
        <div className="mb-2 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          {title}
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {restEntries.map(([key, value]) => {
          // tags 字段特殊处理：拆分为多个标签
          if (key === 'tags') {
            const tagValues = value.replace(/^\[|\]$/g, '').split(',').map(t => t.trim()).filter(Boolean);
            return tagValues.map(tag => (
              <span
                key={`tag-${tag}`}
                className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px]', fieldStyles.tags)}
              >
                <span className="opacity-60">#</span>
                {tag}
              </span>
            ));
          }
          return (
            <span
              key={key}
              className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px]', fieldStyles[key] || defaultStyle)}
            >
              <span className="opacity-60">{key}:</span>
              {value}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function CollapsibleMarkdown({ content }: { content: string }) {
  const parsed = useMemo(() => parseFrontmatter(content), [content]);
  const bodyContent = parsed ? parsed.body : content;
  const sections = useMemo(() => parseCollapsibleSections(bodyContent), [bodyContent]);
  return (
    <div className="md-preview-content">
      {parsed && <FrontmatterBadges meta={parsed.meta} />}
      {sections.map((section, idx) => renderSection(section, idx))}
    </div>
  );
}

/**
 * HTML 转义函数
 * 仅转义 HTML 结构性字符（& < >），保留 Markdown 语法字符（` " ' = /）
 * 这样后续正则可以正确匹配代码块等 Markdown 语法
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export default function MarkdownEditor({ value, onChange, placeholder, readOnly, onSelectionChange }: MarkdownEditorProps) {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<ViewMode>(readOnly ? 'preview' : 'split');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);

  // 预览区文本选中处理
  const handlePreviewMouseUp = useCallback(() => {
    if (!onSelectionChange) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) {
      onSelectionChange(null);
      return;
    }

    const selectedText = sel.toString().trim();

    // 计算选中文本在原始 Markdown 中的行号
    // 在 Markdown 源中搜索选中文本片段
    const lines = value.split('\n');
    let lineIndex = -1;
    const normalizedSelected = selectedText.replace(/\s+/g, ' ').slice(0, 100);

    for (let i = 0; i < lines.length; i++) {
      const normalizedLine = lines[i].replace(/\s+/g, ' ');
      // 尝试匹配行内容（去除 Markdown 标记）
      const plainLine = normalizedLine.replace(/^#+\s+/, '').replace(/[*_~`[\]()]/g, '');
      if (plainLine && normalizedSelected.includes(plainLine.trim().slice(0, 30))) {
        lineIndex = i;
        break;
      }
      if (normalizedLine && normalizedSelected.includes(normalizedLine.trim().slice(0, 30))) {
        lineIndex = i;
        break;
      }
    }

    // 如果没找到精确匹配，尝试在 DOM 中寻找 data-source-line
    if (lineIndex < 0) {
      let node: Node | null = sel.anchorNode;
      while (node && node !== document) {
        if (node instanceof HTMLElement && node.dataset.sourceLine) {
          lineIndex = parseInt(node.dataset.sourceLine, 10);
          break;
        }
        node = node.parentNode;
      }
    }

    if (lineIndex < 0) lineIndex = 0;

    onSelectionChange({ text: selectedText, lineIndex });
  }, [onSelectionChange, value]);

  const handleEditorScroll = useCallback(() => {
    if (!textareaRef.current || !highlightRef.current) return;
    highlightRef.current.scrollTop = textareaRef.current.scrollTop;
    highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;

    if (viewMode === 'split' && previewRef.current) {
      const textarea = textareaRef.current;
      const ratio = textarea.scrollTop / (textarea.scrollHeight - textarea.clientHeight || 1);
      const preview = previewRef.current;
      preview.scrollTop = ratio * (preview.scrollHeight - preview.clientHeight);
    }
  }, [viewMode]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newValue = value.substring(0, start) + '  ' + value.substring(end);
      onChange(newValue);
      requestAnimationFrame(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      });
    }
  }, [value, onChange]);

  const highlightedContent = useMemo(() => {
    if (!value) return '';
    let html = escapeHtml(value);

    const codeBlocks: string[] = [];
    html = html.replace(/```[\s\S]*?```/g, (match) => {
      codeBlocks.push(`<span class="md-code-block">${match}</span>`);
      return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
    });

    html = html.replace(/`([^`\n]+)`/g, '<span class="md-inline-code">`$1`</span>');
    html = html.replace(/^(#{1,6}\s)(.*)$/gm, '<span class="md-heading-marker">$1</span><span class="md-heading">$2</span>');
    html = html.replace(/(\*\*|__)(.+?)\1/g, '<span class="md-bold">$1$2$1</span>');
    html = html.replace(/(?<!\*)(\*)(?!\*)(.+?)(?<!\*)\1(?!\*)/g, '<span class="md-italic">$1$2$1</span>');
    html = html.replace(/(\[\[.*?\]\])/g, '<span class="md-wiki-link">$1</span>');
    html = html.replace(/(\[.*?\]\(.*?\))/g, '<span class="md-link">$1</span>');
    html = html.replace(/(!\[.*?\]\(.*?\))/g, '<span class="md-image">$1</span>');
    html = html.replace(/^(\s*[-*+]\s)/gm, '<span class="md-list">$1</span>');
    html = html.replace(/^(\s*\d+\.\s)/gm, '<span class="md-list">$1</span>');
    html = html.replace(/^(&gt;\s)/gm, '<span class="md-blockquote">$1</span>');
    html = html.replace(/(~~.*?~~)/g, '<span class="md-strikethrough">$1</span>');
    html = html.replace(/^(---|___|(\*\s*){3,})\s*$/gm, '<span class="md-hr">$1</span>');

    codeBlocks.forEach((block, i) => {
      html = html.replace(`__CODE_BLOCK_${i}__`, block);
    });

    return html;
  }, [value]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
        <div className="flex items-center gap-1 text-xs text-slate-500">
          <span className="font-medium">Markdown</span>
          <span className="text-slate-300 dark:text-slate-600">|</span>
          <span>{value.length} 字符</span>
        </div>
        <div className="flex items-center gap-1">
          {!readOnly && (
            <button
              onClick={() => setViewMode('edit')}
              className={clsx(
                'p-1.5 rounded text-xs flex items-center gap-1 transition-colors',
                viewMode === 'edit'
                  ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
                  : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'
              )}
              title={t('common.editMode')}
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t('common.edit')}</span>
            </button>
          )}
          {!readOnly && (
            <button
              onClick={() => setViewMode('split')}
              className={clsx(
                'p-1.5 rounded text-xs flex items-center gap-1 transition-colors',
                viewMode === 'split'
                  ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
                  : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'
              )}
              title="分屏模式"
            >
              <Columns className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">分屏</span>
            </button>
          )}
          <button
            onClick={() => setViewMode('preview')}
            className={clsx(
              'p-1.5 rounded text-xs flex items-center gap-1 transition-colors',
              viewMode === 'preview'
                ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
                : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'
            )}
            title="预览模式"
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">预览</span>
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {(viewMode === 'edit' || viewMode === 'split') && !readOnly && (
          <div className={clsx(
            'relative overflow-hidden',
            viewMode === 'split' ? 'w-1/2 border-r border-slate-200 dark:border-slate-700' : 'w-full'
          )}>
            {viewMode === 'split' && (
              <div className="absolute top-0 left-0 right-0 px-3 py-1 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 z-10">
                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">{t('common.edit')}</span>
              </div>
            )}
            <div
              ref={highlightRef}
              className={clsx(
                'absolute inset-0 p-6 overflow-auto pointer-events-none font-mono text-sm leading-relaxed whitespace-pre-wrap break-words md-highlight-layer',
                viewMode === 'split' && 'pt-12'
              )}
              dangerouslySetInnerHTML={{ __html: highlightedContent }}
            />
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onScroll={handleEditorScroll}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              spellCheck={false}
              className={clsx(
                'absolute inset-0 w-full h-full p-6 resize-none focus:outline-none bg-transparent font-mono text-sm leading-relaxed text-transparent caret-slate-700 dark:caret-slate-200 z-[1]',
                viewMode === 'split' && 'pt-12'
              )}
            />
          </div>
        )}

        {(viewMode === 'preview' || viewMode === 'split') && (
          <div
            className={clsx(
              'overflow-y-auto',
              viewMode === 'split' ? 'w-1/2' : 'w-full'
            )}
            onMouseUp={handlePreviewMouseUp}
          >
            {viewMode === 'split' && (
              <div className="sticky top-0 px-3 py-1 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 z-10">
                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">预览</span>
              </div>
            )}
            <div
              ref={previewRef}
              className="p-6 prose prose-stone dark:prose-invert prose-sm max-w-none md-preview"
            >
              {value ? (
                <CollapsibleMarkdown content={value} />
              ) : (
                <p className="text-slate-400 italic">暂无内容</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
