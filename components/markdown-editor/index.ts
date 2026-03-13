/**
 * MarkdownEditor 组件模块
 * 
 * 拆分为小组件以提高可维护性：
 * - MarkdownEditor: 主编辑器组件（原 1000+ 行简化到 ~400 行）
 * - CollapsibleSection: 可折叠章节标题
 * - MarkdownContent: Markdown 渲染（动态加载 react-markdown）
 * - FrontmatterBadges: YAML frontmatter 标签展示
 * - CollapsibleMarkdown: 带折叠功能的 Markdown 渲染
 * - MarkdownToolbar: 编辑器工具栏
 * - HtmlPreview: HTML 模板预览（设备模式、编辑模式）
 * 
 * 工具函数：
 * - parsers.ts: parseCollapsibleSections, parseFrontmatter, escapeHtml
 * - types.ts: 所有类型定义
 */

// 主组件
export { default as MarkdownEditor } from './MarkdownEditor';
export { default } from './MarkdownEditor';

// 子组件
export { default as CollapsibleSection } from './CollapsibleSection';
export { default as MarkdownContent } from './MarkdownContent';
export { default as FrontmatterBadges } from './FrontmatterBadges';
export { default as CollapsibleMarkdown } from './CollapsibleMarkdown';
export { default as MarkdownToolbar } from './MarkdownToolbar';
export { default as HtmlPreview } from './HtmlPreview';

// 工具函数
export { parseCollapsibleSections, parseFrontmatter, escapeHtml } from './parsers';

// 类型
export type {
  EditorTextSelection,
  MarkdownEditorProps,
  ViewMode,
  Section,
  CollapsibleSectionProps,
  MarkdownContentProps,
  FrontmatterBadgesProps,
  CollapsibleMarkdownProps,
  DeviceMode,
  DevicePreset,
  HtmlPreviewProps,
  MarkdownToolbarProps,
} from './types';
