/**
 * 空状态组件
 * 
 * 统一的空状态展示，支持自定义图标、标题和操作按钮
 * 替代各页面内联的空状态实现
 */

import { ReactNode } from 'react';
import { FolderOpen, Search, FileText, Users, CheckSquare, MessageSquare } from 'lucide-react';
import { Button } from './ui/button';

// ============================================================
// 类型定义
// ============================================================

export type EmptyStateType = 
  | 'default'
  | 'search'
  | 'tasks'
  | 'documents'
  | 'projects'
  | 'members'
  | 'messages'
  | 'sessions'
  | 'custom';

export interface EmptyStateProps {
  /** 预设类型 */
  type?: EmptyStateType;
  /** 自定义图标 */
  icon?: ReactNode;
  /** 标题 */
  title?: string;
  /** 描述 */
  description?: string;
  /** 操作按钮文本 */
  actionText?: string;
  /** 操作按钮点击事件 */
  onAction?: () => void;
  /** 自定义内容 */
  children?: ReactNode;
  /** 尺寸 */
  size?: 'sm' | 'md' | 'lg';
  /** 是否居中 */
  centered?: boolean;
}

// ============================================================
// 预设配置
// ============================================================

const PRESETS: Record<EmptyStateType, {
  icon: ReactNode;
  title: string;
  description: string;
}> = {
  default: {
    icon: <FolderOpen className="w-12 h-12 text-muted-foreground" />,
    title: '暂无数据',
    description: '这里还没有任何内容',
  },
  search: {
    icon: <Search className="w-12 h-12 text-muted-foreground" />,
    title: '未找到结果',
    description: '尝试使用不同的搜索条件',
  },
  tasks: {
    icon: <CheckSquare className="w-12 h-12 text-muted-foreground" />,
    title: '暂无任务',
    description: '创建第一个任务开始工作',
  },
  documents: {
    icon: <FileText className="w-12 h-12 text-muted-foreground" />,
    title: '暂无文档',
    description: '创建第一个文档记录知识',
  },
  projects: {
    icon: <FolderOpen className="w-12 h-12 text-muted-foreground" />,
    title: '暂无项目',
    description: '创建第一个项目组织工作',
  },
  members: {
    icon: <Users className="w-12 h-12 text-muted-foreground" />,
    title: '暂无成员',
    description: '添加成员开始协作',
  },
  messages: {
    icon: <MessageSquare className="w-12 h-12 text-muted-foreground" />,
    title: '暂无消息',
    description: '开始新的对话',
  },
  sessions: {
    icon: <MessageSquare className="w-12 h-12 text-muted-foreground" />,
    title: '暂无会话',
    description: '创建新会话开始对话',
  },
  custom: {
    icon: <FolderOpen className="w-12 h-12 text-muted-foreground" />,
    title: '暂无数据',
    description: '这里还没有任何内容',
  },
};

const SIZE_CLASSES = {
  sm: {
    container: 'py-6',
    icon: 'w-8 h-8',
    title: 'text-sm font-medium',
    description: 'text-xs',
  },
  md: {
    container: 'py-12',
    icon: 'w-12 h-12',
    title: 'text-base font-medium',
    description: 'text-sm',
  },
  lg: {
    container: 'py-20',
    icon: 'w-16 h-16',
    title: 'text-lg font-medium',
    description: 'text-base',
  },
};

// ============================================================
// 组件实现
// ============================================================

export function EmptyState({
  type = 'default',
  icon,
  title,
  description,
  actionText,
  onAction,
  children,
  size = 'md',
  centered = true,
}: EmptyStateProps) {
  const preset = PRESETS[type];
  const sizeClasses = SIZE_CLASSES[size];
  
  // 合并预设和自定义配置
  const displayIcon = icon || (
    <div className={sizeClasses.icon}>
      {preset.icon}
    </div>
  );
  
  const displayTitle = title || preset.title;
  const displayDescription = description || preset.description;

  return (
    <div
      className={`
        flex flex-col items-center justify-center text-center text-muted-foreground
        ${sizeClasses.container}
        ${centered ? 'w-full' : ''}
      `}
    >
      {/* 图标 */}
      <div className="mb-4 opacity-50">
        {displayIcon}
      </div>
      
      {/* 标题 */}
      <h3 className={`${sizeClasses.title} mb-2`}>
        {displayTitle}
      </h3>
      
      {/* 描述 */}
      <p className={`${sizeClasses.description} max-w-sm mb-4`}>
        {displayDescription}
      </p>
      
      {/* 操作按钮 */}
      {actionText && onAction && (
        <Button
          variant="secondary"
          size="sm"
          onClick={onAction}
          className="mt-2"
        >
          {actionText}
        </Button>
      )}
      
      {/* 自定义内容 */}
      {children}
    </div>
  );
}

// ============================================================
// 便捷变体
// ============================================================

export function EmptyTasks({ onAdd }: { onAdd?: () => void }) {
  return (
    <EmptyState
      type="tasks"
      actionText={onAdd ? '创建任务' : undefined}
      onAction={onAdd}
    />
  );
}

export function EmptyDocuments({ onAdd }: { onAdd?: () => void }) {
  return (
    <EmptyState
      type="documents"
      actionText={onAdd ? '创建文档' : undefined}
      onAction={onAdd}
    />
  );
}

export function EmptyProjects({ onAdd }: { onAdd?: () => void }) {
  return (
    <EmptyState
      type="projects"
      actionText={onAdd ? '创建项目' : undefined}
      onAction={onAdd}
    />
  );
}

export function EmptySearch({ query }: { query?: string }) {
  return (
    <EmptyState
      type="search"
      description={query ? `未找到 "${query}" 相关结果` : '未找到匹配的结果'}
    />
  );
}
