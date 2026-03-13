'use client';

import { useMemo, memo } from 'react';
import { parseFrontmatter, parseCollapsibleSections } from './parsers';
import CollapsibleSection from './CollapsibleSection';
import MarkdownContent from './MarkdownContent';
import FrontmatterBadges from './FrontmatterBadges';
import type { Section } from './types';

function renderSection(section: Section, key: number): React.ReactNode {
  if (section.type === 'content') {
    return (
      <div key={key} data-source-line={section.startLine ?? 0}>
        <MarkdownContent content={section.rawContent} />
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

interface CollapsibleMarkdownProps {
  content: string;
}

/**
 * 可折叠 Markdown 渲染组件
 * 支持 frontmatter 标签和可折叠章节
 */
function CollapsibleMarkdown({ content }: CollapsibleMarkdownProps) {
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

export default memo(CollapsibleMarkdown);
