'use client';

import { useState, useEffect, memo } from 'react';
import dynamic from 'next/dynamic';
import type { PluggableList } from 'unified';
import type { MarkdownContentProps } from './types';

// 动态导入 react-markdown 及其插件，减少首屏加载 ~200KB
const ReactMarkdown = dynamic(
  () => import('react-markdown').then((mod) => mod.default),
  { ssr: false, loading: () => <div>Loading preview...</div> }
);

// 插件动态导入
const remarkPluginsPromise = Promise.all([
  import('remark-gfm').then((m) => m.default),
]);

const rehypePluginsPromise = Promise.all([
  import('rehype-highlight').then((m) => m.default),
  import('rehype-raw').then((m) => m.default),
  import('rehype-sanitize').then((m) => m.default),
]);

// 插件缓存，避免重复加载
let cachedRemarkPlugins: PluggableList | null = null;
let cachedRehypePlugins: PluggableList | null = null;

async function loadPlugins() {
  if (!cachedRemarkPlugins) {
    cachedRemarkPlugins = await remarkPluginsPromise as PluggableList;
  }
  if (!cachedRehypePlugins) {
    cachedRehypePlugins = await rehypePluginsPromise as PluggableList;
  }
  return { remarkPlugins: cachedRemarkPlugins, rehypePlugins: cachedRehypePlugins };
}

function MarkdownContent({ content }: MarkdownContentProps) {
  const [plugins, setPlugins] = useState<{ remark: PluggableList; rehype: PluggableList } | null>(null);

  useEffect(() => {
    loadPlugins().then(({ remarkPlugins, rehypePlugins }) => {
      setPlugins({ remark: remarkPlugins, rehype: rehypePlugins });
    });
  }, []);

  if (!plugins) {
    return <div className="text-sm text-gray-400">Loading preview...</div>;
  }

  return (
    <ReactMarkdown
      remarkPlugins={plugins.remark}
      rehypePlugins={plugins.rehype}
    >
      {content}
    </ReactMarkdown>
  );
}

export default memo(MarkdownContent);
