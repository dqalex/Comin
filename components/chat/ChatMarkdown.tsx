'use client';

import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { Copy, Check, ChevronDown, ChevronRight, Bot } from 'lucide-react';
import clsx from 'clsx';

interface ChatMarkdownProps {
  content: string;
  className?: string;
}

/**
 * 解析 YAML frontmatter 为键值对
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
 * Frontmatter 标签渲染组件（聊天面板版，更紧凑）
 */
function FrontmatterBadges({ meta }: { meta: Record<string, string> }) {
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

  const title = meta.title;
  const restEntries = Object.entries(meta).filter(([k]) => k !== 'title');

  return (
    <div className="mb-2 pb-2 border-b border-slate-200 dark:border-slate-700">
      {title && (
        <div className="mb-1.5 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          {title}
        </div>
      )}
      <div className="flex flex-wrap gap-1">
        {restEntries.map(([key, value]) => {
          if (key === 'tags') {
            const tagValues = value.replace(/^\[|\]$/g, '').split(',').map(t => t.trim()).filter(Boolean);
            return tagValues.map(tag => (
              <span
                key={`tag-${tag}`}
                className={clsx('inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px]', fieldStyles.tags)}
              >
                <span className="opacity-60">#</span>
                {tag}
              </span>
            ));
          }
          return (
            <span
              key={key}
              className={clsx('inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px]', fieldStyles[key] || defaultStyle)}
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

/**
 * Extract thinking content from message
 * Supports:
 *   - <thinking>...</thinking> tags
 *   - Tags with attributes
 */
export function extractThinking(content: string): { thinking: string | null; body: string } {
  const thinkingRegex = /<thinking[^>]*>([\s\S]*?)<\/thinking>/i;
  const match = content.match(thinkingRegex);
  
  if (match) {
    return {
      thinking: match[1].trim(),
      body: content.replace(thinkingRegex, '').trim(),
    };
  }
  
  return { thinking: null, body: content };
}

/**
 * Copy button for code blocks
 */
function CodeCopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);
  
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = code;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
    }
  }, [code]);
  
  return (
    <button
      onClick={handleCopy}
      className="absolute top-2 right-2 p-1.5 rounded-md bg-white/10 hover:bg-white/20 transition-colors"
      title={copied ? 'Copied!' : 'Copy code'}
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 text-green-400" />
      ) : (
        <Copy className="w-3.5 h-3.5 text-gray-400" />
      )}
    </button>
  );
}

/**
 * Thinking block - collapsible section for AI reasoning
 */
export function ThinkingBlock({ content }: { content: string }) {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className="my-2 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-100/50 dark:hover:bg-blue-900/30 transition-colors rounded-t-lg"
      >
        <Bot className="w-3.5 h-3.5" />
        <span>Thinking</span>
        {isOpen ? (
          <ChevronDown className="w-3.5 h-3.5 ml-auto" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 ml-auto" />
        )}
      </button>
      {isOpen && (
        <div className="px-3 py-2 text-xs text-blue-700 dark:text-blue-300 border-t border-blue-200 dark:border-blue-800 whitespace-pre-wrap">
          {content}
        </div>
      )}
    </div>
  );
}

/**
 * Custom pre component wrapping code blocks with copy button
 */
function PreBlock({ children, ...props }: React.HTMLAttributes<HTMLPreElement>) {
  // 从 children 中提取 code 元素的文本内容和语言
  let codeString = '';
  let language = '';
  
  if (children && typeof children === 'object' && 'props' in (children as React.ReactElement)) {
    const codeElement = children as React.ReactElement<{ className?: string; children?: React.ReactNode }>;
    codeString = String(codeElement.props?.children || '').replace(/\n$/, '');
    const match = /language-(\w+)/.exec(codeElement.props?.className || '');
    if (match) language = match[1];
  }

  return (
    <pre className="relative group my-2" {...props}>
      {language && (
        <span className="absolute top-2 left-3 text-[10px] font-mono text-gray-400 uppercase">
          {language}
        </span>
      )}
      {children}
      {codeString && <CodeCopyButton code={codeString} />}
    </pre>
  );
}

/**
 * Custom code component (inline only, block handled by PreBlock)
 */
function CodeBlock({ 
  inline, 
  className, 
  children, 
  ...props 
}: {
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <code className={className} {...props}>
      {children}
    </code>
  );
}

/**
 * Main ChatMarkdown component
 * Renders markdown with syntax highlighting, copy buttons, and thinking block support
 */
export default function ChatMarkdown({ content, className }: ChatMarkdownProps) {
  const { thinking, body } = useMemo(() => extractThinking(content), [content]);
  const parsed = useMemo(() => parseFrontmatter(body), [body]);
  const markdownBody = parsed ? parsed.body : body;
  
  return (
    <div className={clsx('md-preview chat-markdown', className)}>
      {thinking && <ThinkingBlock content={thinking} />}
      {parsed && <FrontmatterBadges meta={parsed.meta} />}
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight, rehypeRaw, rehypeSanitize]}
        components={{
          pre: PreBlock as React.ComponentType<React.HTMLAttributes<HTMLPreElement>>,
          code: CodeBlock as React.ComponentType<React.HTMLAttributes<HTMLElement> & { inline?: boolean }>,
        }}
      >
        {markdownBody}
      </ReactMarkdown>
    </div>
  );
}
