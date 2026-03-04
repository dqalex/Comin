'use client';

import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { useConfirmAction } from '@/hooks/useConfirmAction';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useSearchParams } from 'next/navigation';

import { useDocumentStore, useProjectStore, useMemberStore, useTaskStore, useDeliveryStore, useChatStore } from '@/store';
import { useRenderTemplateStore } from '@/store/render-template.store';
import AppShell from '@/components/AppShell';
import Header from '@/components/Header';
import { Button, Input, Select } from '@/components/ui';
import DeliveryStatusCard from '@/components/wiki/DeliveryStatusCard';
import AnnotationPanel from '@/components/wiki/AnnotationPanel';
import type { TextSelection } from '@/components/wiki/AnnotationPanel';
import type { Document } from '@/db/schema';
import dynamic from 'next/dynamic';
import {
  FileText, Plus, Search, Trash2, ExternalLink, Globe, File,
  FolderOpen, Tag, X, ChevronDown, ChevronRight, ClipboardList,
  BookOpen, FileQuestion, Calendar, CheckSquare, Users, Link2, Briefcase,
  Share2, Copy, Check, Edit2, Save, XCircle, MessageSquare, Send,
  Download, Eye, LayoutTemplate,
} from 'lucide-react';
import clsx from 'clsx';
import { DOC_TEMPLATES } from '@/lib/doc-templates';
import { syncMdToHtml as directSyncMdToHtml } from '@/lib/slot-sync';

// 导出对话框（保留导出能力，在「模板可视化」全屏模式下可用）
const ExportModal = dynamic(() => import('@/components/studio/ExportModal'), { ssr: false });

const MarkdownEditor = dynamic(() => import('@/components/MarkdownEditor'), { 
  ssr: false,
  loading: () => <div className="flex-1" />,
});
const typeIcons: Record<string, typeof FileText> = {
  guide: BookOpen, reference: FileText, report: ClipboardList, note: BookOpen, decision: FileText, scheduled_task: Calendar, task_list: CheckSquare, other: FileQuestion,
};
const typeColors: Record<string, string> = {
  guide: 'text-teal-500', reference: 'text-sky-500', report: 'text-blue-500', note: 'text-emerald-500', decision: 'text-amber-500',
  scheduled_task: 'text-violet-500', task_list: 'text-indigo-500', other: 'text-slate-400',
};
const tagColors = [
  'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300',
  'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300',
  'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300',
  'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300',
  'bg-pink-100 text-pink-700 dark:bg-pink-900/50 dark:text-pink-300',
];
const typeOrder = ['guide', 'reference', 'note', 'report', 'decision', 'scheduled_task', 'task_list', 'other'];

export default function WikiPage() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const typeLabels: Record<string, string> = {
    guide: t('wiki.guide'), reference: t('wiki.reference'),
    report: t('wiki.report'), note: t('wiki.note'), decision: t('wiki.decision'),
    scheduled_task: t('wiki.scheduledTask'), task_list: t('wiki.taskList'), other: t('wiki.other'),
  };
  const { documents, createDocument, updateDocumentAsync, deleteDocumentAsync } = useDocumentStore();
  const { projects, currentProjectId } = useProjectStore();
  const { members } = useMemberStore();
  const { tasks } = useTaskStore();
  const { deliveries, fetchDeliveries } = useDeliveryStore();
  const { openChatWithMessage } = useChatStore();

  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [showNewDocDialog, setShowNewDocDialog] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState('');
  const [newDocSource, setNewDocSource] = useState<'local' | 'external'>('local');
  const [newDocType, setNewDocType] = useState('note');
  const [newDocProjectTags, setNewDocProjectTags] = useState<string[]>([]);
  const deleteAction = useConfirmAction<boolean>();
  const [filterType, setFilterType] = useState('all');
  const [showTagEditor, setShowTagEditor] = useState(false);

  // Escape key support for dialogs
  useEscapeKey(showNewDocDialog, useCallback(() => setShowNewDocDialog(false), []));
  const [collapsedTypes, setCollapsedTypes] = useState<Set<string>>(new Set());
  const [showKnowledgeGraph, setShowKnowledgeGraph] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const titleSavingRef = useRef(false);

  // openclaw 文档编辑状态
  const [isEditingOpenclaw, setIsEditingOpenclaw] = useState(false);
  const [openclawFileId, setOpenclawFileId] = useState<string | null>(null);
  const [openclawFileVersion, setOpenclawFileVersion] = useState<number | null>(null);
  const [openclawEditContent, setOpenclawEditContent] = useState('');
  const [savingOpenclaw, setSavingOpenclaw] = useState(false);

  // 交付对话框状态
  const [showDeliverDialog, setShowDeliverDialog] = useState(false);
  const [deliverReviewerId, setDeliverReviewerId] = useState('');
  const [deliverDescription, setDeliverDescription] = useState('');
  const [submittingDelivery, setSubmittingDelivery] = useState(false);

  // 预览区文本选中状态（用于批注定位）
  const [textSelection, setTextSelection] = useState<TextSelection | null>(null);

  // === 渲染模板相关状态 ===
  const { templates: renderTemplates } = useRenderTemplateStore();
  const [showExportModal, setShowExportModal] = useState(false);
  const [studioHtmlContent, setStudioHtmlContent] = useState('');
  const [newDocRenderTemplateId, setNewDocRenderTemplateId] = useState('');
  const [templatePreviewMode, setTemplatePreviewMode] = useState<'html' | 'md'>('html');

  const selectedDoc = documents.find(d => d.id === selectedDocId);

  // 获取关联的渲染模板
  const currentRenderTemplate = useMemo(() => {
    if (!selectedDoc?.renderTemplateId) return null;
    return renderTemplates.find(t => t.id === selectedDoc.renderTemplateId) || null;
  }, [selectedDoc?.renderTemplateId, renderTemplates]);

  // MD 变更时同步到 HTML（有渲染模板时持续同步）
  const syncDebounceRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (!currentRenderTemplate || !editContent) return;
    if (syncDebounceRef.current) clearTimeout(syncDebounceRef.current);
    syncDebounceRef.current = setTimeout(() => {
      try {
        const result = directSyncMdToHtml(
          editContent,
          currentRenderTemplate.htmlTemplate || '',
          (currentRenderTemplate.slots || {}) as Record<string, import('@/lib/slot-sync').SlotDef>,
          currentRenderTemplate.cssTemplate || undefined,
        );
        if (result.html) setStudioHtmlContent(result.html);
      } catch (err) {
        console.error('[wiki] MD→HTML 同步失败:', err);
      }
    }, 300);
    return () => { if (syncDebounceRef.current) clearTimeout(syncDebounceRef.current); };
  }, [editContent, currentRenderTemplate]);

  // 切换文档时，初始化 HTML 内容（直接调用 syncMdToHtml，不走互斥锁）
  useEffect(() => {
    if (selectedDoc?.htmlContent && currentRenderTemplate) {
      setStudioHtmlContent(selectedDoc.htmlContent);
    } else if (currentRenderTemplate && editContent) {
      try {
        const result = directSyncMdToHtml(
          editContent,
          currentRenderTemplate.htmlTemplate || '',
          (currentRenderTemplate.slots || {}) as Record<string, import('@/lib/slot-sync').SlotDef>,
          currentRenderTemplate.cssTemplate || undefined,
        );
        if (result.html) setStudioHtmlContent(result.html);
      } catch (err) {
        console.error('[wiki] 初始化 HTML 失败:', err);
      }
    } else {
      setStudioHtmlContent('');
    }
  }, [selectedDocId]); // eslint-disable-line react-hooks/exhaustive-deps

  // 内容变更（防抖保存）— 移至此处供 Content Studio 回调引用
  const handleContentChange = useCallback((value: string) => {
    setEditContent(value);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      if (selectedDocId) updateDocumentAsync(selectedDocId, { content: value });
    }, 500);
  }, [selectedDocId, updateDocumentAsync]);

  // 保存 HTML 内容（有渲染模板时可用）
  const handleSaveStudioHtml = useCallback(async () => {
    if (!selectedDocId || !studioHtmlContent) return;
    await updateDocumentAsync(selectedDocId, { htmlContent: studioHtmlContent });
  }, [selectedDocId, studioHtmlContent, updateDocumentAsync]);

  const currentProject = projects.find(p => p.id === currentProjectId);

  const filteredDocs = useMemo(() => {
    let docs = documents;
    if (currentProjectId && currentProject) {
      docs = docs.filter(d =>
        d.projectId === currentProjectId ||
        (Array.isArray(d.projectTags) && (
          d.projectTags.includes(currentProjectId) || d.projectTags.includes(currentProject.name)
        ))
      );
    }
    if (filterType !== 'all') docs = docs.filter(d => d.type === filterType);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      docs = docs.filter(d => d.title.toLowerCase().includes(term));
    }
    return docs;
  }, [documents, currentProjectId, currentProject, searchTerm, filterType]);

  const docsByType = useMemo(() => {
    const groups: Record<string, Document[]> = {};
    for (const tp of typeOrder) {
      const typed = filteredDocs.filter(d => d.type === tp);
      if (typed.length > 0) groups[tp] = typed;
    }
    return groups;
  }, [filteredDocs]);

  // URL 参数支持：自动选中 URL 中指定的文档
  useEffect(() => {
    const docIdFromUrl = searchParams.get('doc');
    if (docIdFromUrl && !selectedDocId) {
      // 使用 normalizeId 兼容旧的 UUID 格式
      const normalizedId = docIdFromUrl; // URL 中的 ID 已经是 Base58 格式
      const doc = documents.find(d => d.id === normalizedId);
      if (doc) {
        setSelectedDocId(normalizedId);
      }
    }
  }, [searchParams, documents, selectedDocId]);

  // 确保交付物数据已加载（用于 DeliveryStatusCard）
  useEffect(() => {
    if (deliveries.length === 0) {
      fetchDeliveries();
    }
  }, [deliveries.length, fetchDeliveries]);

  // 知识图谱：计算当前文档的关联关系
  const docRelations = useMemo(() => {
    if (!selectedDoc) return null;
    const content = typeof editContent === 'string' ? editContent : String(editContent || '');
    // 引用的文档（通过 [[文档标题]] 语法）
    const docRefs = [...content.matchAll(/\[\[(.+?)\]\]/g)].map(m => m[1]);
    const linkedDocs = docRefs.map(title => documents.find(d => d.title === title)).filter(Boolean);
    // 被哪些文档引用（使用持久化的 backlinks 字段，兼容 Obsidian）
    const backlinkIds = Array.isArray(selectedDoc.backlinks) ? selectedDoc.backlinks : [];
    const backlinkDocs = backlinkIds.map(id => documents.find(d => d.id === id)).filter(Boolean) as typeof documents;
    // 关联的项目
    const relatedProjects = projects.filter(p =>
      selectedDoc.projectId === p.id ||
      (Array.isArray(selectedDoc.projectTags) && (selectedDoc.projectTags.includes(p.name) || selectedDoc.projectTags.includes(p.id)))
    );
    // 关联的人员（通过 @提及）
    const mentionedNames = [...content.matchAll(/@(\S+)/g)].map(m => m[1]);
    const relatedMembers = mentionedNames.map(name => members.find(m => m.name === name)).filter(Boolean);
    // 关联的任务（通过 attachments 包含此文档）
    const relatedTasks = tasks.filter(task =>
      Array.isArray(task.attachments) && (task.attachments as string[]).includes(selectedDoc.id)
    );
    return { linkedDocs, backlinkDocs, relatedProjects, relatedMembers, relatedTasks };
  }, [selectedDoc, editContent, documents, projects, members, tasks]);

  // 清理 saveTimerRef
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!selectedDocId) return;
    // 先用 store 中已有的数据（可能不含 content）
    if (selectedDoc) {
      setEditTitle(selectedDoc.title);
    }
    // 重置 openclaw 编辑状态
    setIsEditingOpenclaw(false);
    setOpenclawFileId(null);
    setOpenclawFileVersion(null);
    // 按需从 API 加载完整文档（含 content），使用 AbortController 防止竞态
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(`/api/documents/${selectedDocId}`, { signal: controller.signal });
        if (res.ok) {
          const fullDoc = await res.json();
          setEditContent(fullDoc.content || '');
          setEditTitle(fullDoc.title || '');
          // 如果是 openclaw 文档，保存 openclawFileId 和 version
          if (fullDoc.source === 'openclaw') {
            setOpenclawFileId(fullDoc.openclawFileId || null);
            setOpenclawFileVersion(fullDoc.openclawFileVersion ?? null);
            setOpenclawEditContent(fullDoc.content || '');
          }
        } else {
          setEditContent(selectedDoc?.content || '');
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setEditContent(selectedDoc?.content || '');
      }
    })();
    return () => controller.abort();
  }, [selectedDocId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTitleSave = useCallback(() => {
    if (titleSavingRef.current) return;
    titleSavingRef.current = true;
    if (selectedDocId && editTitle.trim()) updateDocumentAsync(selectedDocId, { title: editTitle.trim() });
    setTimeout(() => { titleSavingRef.current = false; }, 100);
  }, [selectedDocId, editTitle, updateDocumentAsync]);

  const handleCreateDoc = useCallback(async () => {
    if (!newDocTitle.trim()) return;
    // 如果选择了渲染模板，用模板的 mdTemplate 作为初始内容（含示例数据）
    let template = DOC_TEMPLATES[newDocType] || '';
    if (newDocRenderTemplateId) {
      const rt = renderTemplates.find(t => t.id === newDocRenderTemplateId);
      if (rt?.mdTemplate) template = rt.mdTemplate;
    }
    const doc = await createDocument({
      title: newDocTitle.trim(),
      content: template,
      source: newDocSource,
      type: newDocType as any,
      projectId: currentProjectId || undefined,
      projectTags: newDocProjectTags,
      renderTemplateId: newDocRenderTemplateId || undefined,
    });
    if (doc) {
      setSelectedDocId(doc.id);
      setEditContent(template);
    }
    setNewDocTitle('');
    setNewDocType('note');
    setNewDocProjectTags([]);
    setShowNewDocDialog(false);
  }, [newDocTitle, newDocType, newDocSource, newDocProjectTags, newDocRenderTemplateId, currentProjectId, createDocument, renderTemplates]);

  const handleDelete = useCallback(async () => {
    if (selectedDocId) {
      await deleteDocumentAsync(selectedDocId);
      setSelectedDocId(null);
    }
  }, [selectedDocId, deleteDocumentAsync]);

  // openclaw 文档保存
  const handleSaveOpenclaw = useCallback(async () => {
    if (!openclawFileId) return;
    setSavingOpenclaw(true);
    try {
      const res = await fetch(`/api/openclaw-files/${openclawFileId}/push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: openclawEditContent,
          expectedVersion: openclawFileVersion,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setEditContent(openclawEditContent);
        setOpenclawFileVersion(data.data?.version ?? openclawFileVersion);
        setIsEditingOpenclaw(false);
        // 更新 document 表的 content
        if (selectedDocId) {
          await updateDocumentAsync(selectedDocId, { content: openclawEditContent });
        }
      } else {
        const err = await res.json();
        if (err.error === 'CONFLICT') {
          alert(t('wiki.conflictError') || '文件已被其他程序修改，请刷新后重试');
        } else {
          alert(err.error || '保存失败');
        }
      }
    } catch (e) {
      console.error('Save openclaw error:', e);
      alert('保存失败');
    } finally {
      setSavingOpenclaw(false);
    }
  }, [openclawFileId, openclawFileVersion, openclawEditContent, selectedDocId, updateDocumentAsync, t]);

  const handleCancelOpenclawEdit = useCallback(() => {
    setOpenclawEditContent(editContent);
    setIsEditingOpenclaw(false);
  }, [editContent]);

  // 与 AI 讨论当前文档
  const handleChatAboutDoc = useCallback(() => {
    if (!selectedDoc) return;
    const project = selectedDoc.projectId ? projects.find(p => p.id === selectedDoc.projectId) : null;
    const contentPreview = editContent ? editContent.slice(0, 500) + (editContent.length > 500 ? '\n...(内容已截断)' : '') : '';

    const lines = [
      '**这是一条引用讨论消息，请先不要执行任何操作，我们只需要讨论方案。**',
      '',
      '---',
      '',
      '## 来源信息',
      '- **数据来源**: CoMind 协作平台',
      '- **服务类型**: 本地 SQLite 数据库（通过 CoMind MCP 工具访问）',
      '',
      '## 引用的文档',
      `- **文档 ID**: ${selectedDoc.id}`,
      `- **文档标题**: ${selectedDoc.title}`,
      `- **文档类型**: ${typeLabels[selectedDoc.type] || selectedDoc.type}`,
      `- **来源**: ${selectedDoc.source === 'openclaw' ? 'OpenClaw 同步' : selectedDoc.source === 'external' ? '外部链接' : '本地创建'}`,
      `- **创建时间**: ${selectedDoc.createdAt ? new Date(selectedDoc.createdAt).toLocaleString('zh-CN') : '未知'}`,
      '',
    ];

    if (project) {
      lines.push(
        '## 所属项目',
        `- **项目名称**: ${project.name}`,
        ''
      );
    }

    if (contentPreview) {
      lines.push('### 文档内容预览', '```', contentPreview, '```', '');
    }

    lines.push(
      '---',
      '',
      '## 访问方式',
      '- 文档: `get_document` 或 `list_documents`',
      '- 任务: `get_task` 或 `list_tasks`',
      '',
      '**请分析这篇文档，给出你的建议，但暂时不要执行任何修改操作。**'
    );

    openChatWithMessage(lines.join('\n'));
  }, [selectedDoc, editContent, projects, typeLabels, openChatWithMessage]);

  const handleToggleProjectTag = async (projectName: string) => {
    if (!selectedDoc) return;
    const tags = Array.isArray(selectedDoc.projectTags) ? [...selectedDoc.projectTags] : [];
    const idx = tags.indexOf(projectName);
    if (idx >= 0) tags.splice(idx, 1); else tags.push(projectName);
    await updateDocumentAsync(selectedDoc.id, { projectTags: tags });
  };

  const handleTypeChange = async (newType: string) => {
    if (!selectedDoc || selectedDoc.type === newType) return;
    await updateDocumentAsync(selectedDoc.id, { type: newType as any });
  };

  // 更换渲染模板
  const handleRenderTemplateChange = async (templateId: string) => {
    if (!selectedDoc) return;
    const newTemplateId = templateId || null;
    const updates: Record<string, unknown> = { renderTemplateId: newTemplateId };
    // 移除模板时清空关联数据
    if (!newTemplateId) {
      updates.htmlContent = null;
      updates.slotData = null;
    }
    await updateDocumentAsync(selectedDoc.id, updates as any);
  };

  // 提交文档交付
  const { createDelivery } = useDeliveryStore();
  const handleSubmitDelivery = useCallback(async () => {
    if (!selectedDoc || !deliverReviewerId || submittingDelivery) return;
    setSubmittingDelivery(true);
    try {
      await createDelivery({
        memberId: members.find(m => m.type === 'human')?.id || 'member-default',
        title: selectedDoc.title,
        description: deliverDescription || null,
        platform: 'local' as const,
        documentId: selectedDoc.id,
        status: 'pending' as const,
        reviewerId: deliverReviewerId,
      });
      setShowDeliverDialog(false);
      setDeliverReviewerId('');
      setDeliverDescription('');
    } catch {
      // 错误由 store 处理
    } finally {
      setSubmittingDelivery(false);
    }
  }, [selectedDoc, deliverReviewerId, deliverDescription, submittingDelivery, createDelivery, members]);

  const toggleCollapse = (type: string) => {
    setCollapsedTypes(prev => {
      const next = new Set(prev);
      next.has(type) ? next.delete(type) : next.add(type);
      return next;
    });
  };

  const getShareUrl = useCallback(() => {
    if (!selectedDocId) return '';
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    return `${baseUrl}/wiki?doc=${selectedDocId}`;
  }, [selectedDocId]);

  const handleCopyLink = useCallback(async () => {
    const url = getShareUrl();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      navigator.clipboard.writeText(url);
      document.body.removeChild(textArea);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  }, [getShareUrl]);

  const renderDocItem = (doc: Document) => {
    const Icon = typeIcons[doc.type] || FileQuestion;
    return (
      <button
        key={doc.id}
        onClick={() => setSelectedDocId(doc.id)}
        className={clsx(
          'w-full text-left px-3 py-2 rounded-lg text-[13px] transition-colors flex items-center gap-2',
          selectedDocId === doc.id
            ? 'bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-300 font-medium'
            : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
        )}
        style={{ color: selectedDocId === doc.id ? undefined : 'var(--text-secondary)' }}
      >
        {doc.source === 'external'
          ? <ExternalLink className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }} />
          : doc.source === 'openclaw'
            ? <Globe className="w-3 h-3 flex-shrink-0 text-blue-500" />
            : <Icon className={clsx('w-3 h-3 flex-shrink-0', typeColors[doc.type])} />}
        <span className="truncate flex-1">{doc.title}</span>
        {doc.source === 'openclaw' && (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300">
            {t('wiki.openclaw')}
          </span>
        )}
        {Array.isArray(doc.projectTags) && doc.projectTags.length > 0 && (
          <span className="text-[9px] px-1 rounded bg-slate-100 dark:bg-slate-800" style={{ color: 'var(--text-tertiary)' }}>
            {doc.projectTags.length}
          </span>
        )}
      </button>
    );
  };

  return (
    <AppShell>
      <Header title={t('wiki.title')} showProjectSelector />
      <div className="flex h-[calc(100vh-45px)]">
        {/* 左侧列表 */}
        <div className="w-72 border-r flex flex-col" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <div className="p-3 border-b space-y-2" style={{ borderColor: 'var(--border)' }}>
            <Input
              icon={<Search className="w-3.5 h-3.5" />}
              value={searchInput}
              onChange={e => {
                setSearchInput(e.target.value);
                if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
                searchTimerRef.current = setTimeout(() => setSearchTerm(e.target.value), 300);
              }}
              placeholder={t('wiki.search')}
              className="py-1.5 text-[13px]"
            />
            {/* 类型筛选 */}
            <div className="flex flex-wrap gap-1">
              <button onClick={() => setFilterType('all')}
                className={clsx('text-[10px] px-1.5 py-0.5 rounded-full transition-colors',
                  filterType === 'all' ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                )} style={filterType !== 'all' ? { color: 'var(--text-tertiary)' } : undefined}>
                {t('wiki.all')} ({filteredDocs.length})
              </button>
              {typeOrder.map(tp => {
                const count = documents.filter(d => d.type === tp).length;
                if (count === 0 && tp !== 'scheduled_task') return null;
                return (
                  <button key={tp} onClick={() => setFilterType(filterType === tp ? 'all' : tp)}
                    className={clsx('text-[10px] px-1.5 py-0.5 rounded-full transition-colors',
                      filterType === tp ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                    )} style={filterType !== tp ? { color: 'var(--text-tertiary)' } : undefined}>
                    {typeLabels[tp]} ({count})
                  </button>
                );
              })}
            </div>
            <Button size="sm" className="w-full" onClick={() => setShowNewDocDialog(true)}>
              <Plus className="w-3.5 h-3.5" /> {t('wiki.newDoc')}
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filterType !== 'all' ? (
              filteredDocs.map(renderDocItem)
            ) : (
              Object.entries(docsByType).map(([type, docs]) => (
                <div key={type}>
                  <button onClick={() => toggleCollapse(type)}
                    className="flex items-center gap-1.5 px-2 py-1 w-full text-left">
                    {collapsedTypes.has(type)
                      ? <ChevronRight className="w-3 h-3" style={{ color: 'var(--text-tertiary)' }} />
                      : <ChevronDown className="w-3 h-3" style={{ color: 'var(--text-tertiary)' }} />}
                    {(() => { const I = typeIcons[type] || FileQuestion; return <I className={clsx('w-3 h-3', typeColors[type])} />; })()}
                    <span className="section-title text-[10px]">{typeLabels[type]} ({docs.length})</span>
                  </button>
                  {!collapsedTypes.has(type) && docs.map(renderDocItem)}
                </div>
              ))
            )}
            {filteredDocs.length === 0 && (
              <div className="text-center py-8">
                <FileText className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--text-tertiary)' }} />
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('wiki.noDocs')}</p>
              </div>
            )}
          </div>
        </div>

        {/* 右侧编辑区 */}
        <div className="flex-1 flex flex-col">
          {selectedDoc ? (
            <>
              {/* 标题栏 */}
              <div className="px-6 py-3 border-b flex items-center justify-between gap-3" style={{ borderColor: 'var(--border)' }}>
                <Input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                  onBlur={handleTitleSave} onKeyDown={e => e.key === 'Enter' && handleTitleSave()}
                  className="text-lg font-display font-bold bg-transparent border-none outline-none flex-1" />
                <div className="flex items-center gap-2">
                  {selectedDoc.source === 'external' && selectedDoc.externalUrl && (
                    <a
                      href={selectedDoc.externalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-2 py-1 text-xs rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> {t('wiki.openExternal')}
                    </a>
                  )}
                  {/* 有渲染模板时显示保存和导出 */}
                  {selectedDoc.renderTemplateId && studioHtmlContent && (
                    <>
                      <Button size="sm" variant="ghost" className="text-xs" onClick={handleSaveStudioHtml}>
                        <Save className="w-3.5 h-3.5" /> {t('common.save')}
                      </Button>
                      <Button size="sm" variant="ghost" className="text-xs text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950" onClick={() => setShowExportModal(true)}>
                        <Download className="w-3.5 h-3.5" /> {t('studio.export')}
                      </Button>
                    </>
                  )}
                  <Button size="sm" variant="ghost" className="text-xs" onClick={() => setShowShareDialog(true)}>
                    <Share2 className="w-3.5 h-3.5" /> {t('wiki.share')}
                  </Button>
                  <Button size="sm" variant="ghost" className="text-xs" onClick={handleChatAboutDoc}>
                    <MessageSquare className="w-3.5 h-3.5" style={{ color: 'var(--ai)' }} /> {t('wiki.chatWithAI')}
                  </Button>
                  <Button size="sm" variant="ghost" className="text-xs text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950" onClick={() => setShowDeliverDialog(true)}>
                    <Send className="w-3.5 h-3.5" /> {t('wiki.submitDelivery', { defaultValue: '提交交付' })}
                  </Button>
                  {/* openclaw 文档的编辑按钮 */}
                  {selectedDoc.source === 'openclaw' && (
                    isEditingOpenclaw ? (
                      <>
                        <Button size="sm" className="text-xs" disabled={savingOpenclaw} onClick={handleSaveOpenclaw}>
                          {savingOpenclaw ? <span className="animate-spin">⏳</span> : <Save className="w-3.5 h-3.5" />}
                          {t('common.save')}
                        </Button>
                        <Button size="sm" variant="secondary" className="text-xs" onClick={handleCancelOpenclawEdit}>
                          <XCircle className="w-3.5 h-3.5" /> {t('common.cancel')}
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" variant="secondary" className="text-xs" onClick={() => setIsEditingOpenclaw(true)}>
                        <Edit2 className="w-3.5 h-3.5" /> {t('common.edit')}
                      </Button>
                    )
                  )}
                  <Button size="sm" variant="ghost" className="text-red-500 hover:bg-red-50 dark:hover:bg-red-950" onClick={() => deleteAction.requestConfirm(true)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {/* 元数据栏：类型 + 项目标签 */}
              <div className="px-6 py-2 border-b flex items-center gap-4 flex-wrap" style={{ borderColor: 'var(--border)', background: 'var(--surface-hover)' }}>
                {/* 文档类型选择 */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>{t('wiki.type')}</span>
                  <Select value={selectedDoc.type} onChange={e => handleTypeChange(e.target.value)} className="text-xs bg-transparent">
                    {typeOrder.map(tp => <option key={tp} value={tp}>{typeLabels[tp]}</option>)}
                  </Select>
                </div>

                {/* 渲染模板选择（已绑定模板的文档锁死不可切换，因为不同模板 slot 定义不通用） */}
                <div className="w-px h-4" style={{ background: 'var(--border)' }} />
                <div className="flex items-center gap-1.5">
                  <LayoutTemplate className="w-3 h-3" style={{ color: 'var(--text-tertiary)' }} />
                  <Select
                    value={selectedDoc.renderTemplateId || ''}
                    onChange={e => handleRenderTemplateChange(e.target.value)}
                    disabled={!!selectedDoc.renderTemplateId}
                    className="text-xs bg-transparent"
                    title={selectedDoc.renderTemplateId ? t('wiki.templateLocked') : ''}
                  >
                    <option value="">{t('wiki.noTemplate')}</option>
                    {renderTemplates.map(rt => (
                      <option key={rt.id} value={rt.id}>{rt.name}</option>
                    ))}
                  </Select>
                </div>

                {/* 分隔线 */}
                <div className="w-px h-4" style={{ background: 'var(--border)' }} />

                {/* 项目标签 */}
                <div className="flex items-center gap-1.5 flex-wrap flex-1">
                  <button onClick={() => setShowTagEditor(!showTagEditor)}
                    className={clsx(
                      'flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded transition-colors',
                      showTagEditor
                        ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                    )}
                    style={!showTagEditor ? { color: 'var(--text-tertiary)' } : undefined}>
                    <Tag className="w-3 h-3" />
                    {(!Array.isArray(selectedDoc.projectTags) || selectedDoc.projectTags.length === 0) && !selectedDoc.projectId
                      ? t('wiki.clickToLinkProject')
                      : t('wiki.linkedProjects')
                    }
                  </button>
                  {Array.isArray(selectedDoc.projectTags) && selectedDoc.projectTags.map((tag, i) => (
                    <span key={tag} className={clsx('inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full', tagColors[i % tagColors.length])}>
                      {tag}
                      <button onClick={() => handleToggleProjectTag(tag)} className="hover:opacity-70"><X className="w-2.5 h-2.5" /></button>
                    </span>
                  ))}
                  {selectedDoc.projectId && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800" style={{ color: 'var(--text-tertiary)' }}>
                      {t('wiki.primaryProject')}: {projects.find(p => p.id === selectedDoc.projectId)?.name || t('wiki.unknownProject')}
                    </span>
                  )}
                  {(!Array.isArray(selectedDoc.projectTags) || selectedDoc.projectTags.length === 0) && !selectedDoc.projectId && (
                    <span className="text-[10px] italic" style={{ color: 'var(--text-tertiary)' }}>{t('wiki.notLinked')}</span>
                  )}
                </div>

                {/* 知识图谱入口 */}
                <div className="w-px h-4" style={{ background: 'var(--border)' }} />
                <button onClick={() => setShowKnowledgeGraph(!showKnowledgeGraph)}
                  className={clsx(
                    'flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded transition-colors',
                    showKnowledgeGraph
                      ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                  )}
                  style={!showKnowledgeGraph ? { color: 'var(--text-tertiary)' } : undefined}>
                  <Link2 className="w-3 h-3" />
                  {t('wiki.relations')}
                  {docRelations && (docRelations.linkedDocs.length + docRelations.backlinkDocs.length + docRelations.relatedTasks.length) > 0 && (
                    <span className="ml-0.5 px-1 rounded-full bg-primary-100 text-primary-600 dark:bg-primary-900 dark:text-primary-400 text-[9px]">
                      {docRelations.linkedDocs.length + docRelations.backlinkDocs.length + docRelations.relatedTasks.length}
                    </span>
                  )}
                </button>
              </div>

              {/* 交付状态卡片 - 仅当文档有 delivery_status 字段时显示 */}
              <DeliveryStatusCard document={selectedDoc} />

              {/* 项目标签编辑面板 */}
              {showTagEditor && (
                <div className="px-6 py-2 border-b" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                  <div className="text-[10px] mb-1.5" style={{ color: 'var(--text-tertiary)' }}>{t('wiki.clickProjectToToggle')}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {projects.map(p => {
                      const isTagged = Array.isArray(selectedDoc.projectTags) && selectedDoc.projectTags.includes(p.name);
                      const isPrimary = selectedDoc.projectId === p.id;
                      return (
                        <button key={p.id} onClick={() => handleToggleProjectTag(p.name)}
                          className={clsx(
                            'text-[11px] px-2 py-1 rounded-lg border transition-colors',
                            isTagged ? 'border-primary-300 bg-primary-50 text-primary-700 dark:border-primary-700 dark:bg-primary-950 dark:text-primary-300'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                          )}
                          style={!isTagged ? { borderColor: 'var(--border)', color: 'var(--text-secondary)' } : undefined}>
                          {p.name} {isPrimary && `(${t('wiki.primaryProject')})`}
                          {isTagged && <span className="ml-1">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 知识图谱面板 */}
              {showKnowledgeGraph && docRelations && (
                <div className="px-6 py-3 border-b" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {/* 关联项目 */}
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-1" style={{ color: 'var(--text-tertiary)' }}>
                        <Briefcase className="w-3 h-3" /> {t('wiki.projectCount')} ({docRelations.relatedProjects.length})
                      </div>
                      {docRelations.relatedProjects.length > 0 ? (
                        <div className="space-y-1">
                          {docRelations.relatedProjects.map(p => (
                            <div key={p.id} className="text-xs px-2 py-1 rounded" style={{ background: 'var(--surface-hover)', color: 'var(--text-primary)' }}>
                              {p.name}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-[10px] italic" style={{ color: 'var(--text-tertiary)' }}>-</div>
                      )}
                    </div>

                    {/* 关联人员 */}
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-1" style={{ color: 'var(--text-tertiary)' }}>
                        <Users className="w-3 h-3" /> {t('wiki.memberCount')} ({docRelations.relatedMembers.length})
                      </div>
                      {docRelations.relatedMembers.length > 0 ? (
                        <div className="space-y-1">
                          {docRelations.relatedMembers.map(m => (
                            <div key={m!.id} className="text-xs px-2 py-1 rounded flex items-center gap-1" style={{ background: 'var(--surface-hover)', color: 'var(--text-primary)' }}>
                              <span className={clsx('w-4 h-4 rounded-full flex items-center justify-center text-[8px]', m!.type === 'ai' ? 'member-ai' : 'bg-primary-100 text-primary-600')}>
                                {m!.name[0]}
                              </span>
                              {m!.name}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-[10px] italic" style={{ color: 'var(--text-tertiary)' }}>{t('wiki.noMembers')}</div>
                      )}
                    </div>

                    {/* 引用文档 */}
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-1" style={{ color: 'var(--text-tertiary)' }}>
                        <FileText className="w-3 h-3" /> {t('wiki.refs')} ({docRelations.linkedDocs.length})
                      </div>
                      {docRelations.linkedDocs.length > 0 ? (
                        <div className="space-y-1">
                          {docRelations.linkedDocs.map(d => (
                            <button key={d!.id} onClick={() => setSelectedDocId(d!.id)}
                              className="w-full text-left text-xs px-2 py-1 rounded text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors truncate"
                              style={{ background: 'var(--surface-hover)' }}>
                              {d!.title}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="text-[10px] italic" style={{ color: 'var(--text-tertiary)' }}>{t('wiki.noRefs')}</div>
                      )}
                    </div>

                    {/* 被引用 + 关联任务 */}
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-1" style={{ color: 'var(--text-tertiary)' }}>
                        <Link2 className="w-3 h-3" /> {t('wiki.backrefs')} ({docRelations.backlinkDocs.length + docRelations.relatedTasks.length})
                      </div>
                      {docRelations.backlinkDocs.length > 0 && docRelations.backlinkDocs.map(d => (
                        <button key={d.id} onClick={() => setSelectedDocId(d.id)}
                          className="w-full text-left text-xs px-2 py-1 rounded text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors truncate mb-1"
                          style={{ background: 'var(--surface-hover)' }}>
                          📄 {d.title}
                        </button>
                      ))}
                      {docRelations.relatedTasks.length > 0 && docRelations.relatedTasks.map(task => (
                        <div key={task.id} className="text-xs px-2 py-1 rounded mb-1 flex items-center gap-1 truncate"
                          style={{ background: 'var(--surface-hover)', color: 'var(--text-primary)' }}>
                          <CheckSquare className="w-3 h-3 text-primary-500 flex-shrink-0" /> {task.title}
                        </div>
                      ))}
                      {docRelations.backlinkDocs.length === 0 && docRelations.relatedTasks.length === 0 && (
                        <div className="text-[10px] italic" style={{ color: 'var(--text-tertiary)' }}>-</div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex-1 overflow-hidden">
                <MarkdownEditor
                  key={selectedDocId}
                  value={selectedDoc.source === 'openclaw' && isEditingOpenclaw ? openclawEditContent : editContent}
                  onChange={selectedDoc.source === 'openclaw' && isEditingOpenclaw ? setOpenclawEditContent : handleContentChange}
                  placeholder={t('wiki.startWriting')}
                  readOnly={selectedDoc.source === 'openclaw' && !isEditingOpenclaw}
                  onSelectionChange={(sel) => setTextSelection(sel ? { text: sel.text, lineIndex: sel.lineIndex } : null)}
                  renderHtml={currentRenderTemplate ? (studioHtmlContent || currentRenderTemplate.htmlTemplate || undefined) : undefined}
                  renderCss={currentRenderTemplate?.cssTemplate || undefined}
                />
              </div>

              {/* 批注面板 - 始终可添加批注（不受编辑模式限制） */}
              <AnnotationPanel
                content={selectedDoc.source === 'openclaw' && isEditingOpenclaw ? openclawEditContent : editContent}
                onChange={selectedDoc.source === 'openclaw' && isEditingOpenclaw ? setOpenclawEditContent : handleContentChange}
                readOnly={selectedDoc.source === 'openclaw' && !isEditingOpenclaw}
                selection={textSelection}
              />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <FolderOpen className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--text-tertiary)' }} />
                <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{t('wiki.selectToEdit')}</p>
                <Button size="sm" className="mt-3" onClick={() => setShowNewDocDialog(true)}>
                  <Plus className="w-3.5 h-3.5" /> {t('wiki.newDoc')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 新建文档对话框 */}
      {showNewDocDialog && (() => {
        const selectedRt = newDocRenderTemplateId ? renderTemplates.find(t => t.id === newDocRenderTemplateId) : null;
        const hasTemplate = !!selectedRt?.htmlTemplate;
        // 将 mdTemplate 示例内容注入到 HTML 骨架中，用于预览
        let previewHtml = selectedRt?.htmlTemplate || '';
        if (hasTemplate && selectedRt?.mdTemplate) {
          try {
            const result = directSyncMdToHtml(
              selectedRt.mdTemplate,
              selectedRt.htmlTemplate!,
              (selectedRt.slots || {}) as Record<string, import('@/db/schema').SlotDef>,
              selectedRt.cssTemplate || undefined,
            );
            previewHtml = result.html;
          } catch { /* 降级到原始 htmlTemplate */ }
        }
        return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50" role="dialog" aria-modal="true" aria-labelledby="create-doc-title">
          <div className={clsx('rounded-2xl shadow-float flex', hasTemplate ? 'w-[840px] max-h-[85vh]' : 'w-96')} style={{ background: 'var(--surface)' }}>
            {/* 左侧：表单 */}
            <div className={clsx('p-6 flex flex-col', hasTemplate ? 'w-[380px] flex-shrink-0 border-r overflow-y-auto' : 'w-full')} style={hasTemplate ? { borderColor: 'var(--border)' } : undefined}>
            <h3 id="create-doc-title" className="font-display font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>{t('wiki.createDocTitle')}</h3>
            <div className="space-y-3 flex-1">
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--text-tertiary)' }}>{t('wiki.docTitle')}</label>
                <Input value={newDocTitle} onChange={e => setNewDocTitle(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreateDoc()} placeholder={t('wiki.docTitlePlaceholder')} autoFocus />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--text-tertiary)' }}>{t('wiki.source')}</label>
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1" variant={newDocSource === 'local' ? 'primary' : 'secondary'} onClick={() => setNewDocSource('local')}>
                    <File className="w-3.5 h-3.5" /> {t('wiki.local')}
                  </Button>
                  <Button size="sm" className="flex-1" variant={newDocSource === 'external' ? 'primary' : 'secondary'} onClick={() => setNewDocSource('external')}>
                    <Globe className="w-3.5 h-3.5" /> {t('wiki.external')}
                  </Button>
                </div>
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--text-tertiary)' }}>{t('wiki.docType')}</label>
                <div className="flex flex-wrap gap-1.5">
                  {typeOrder.map(tp => {
                    const Icon = typeIcons[tp];
                    return (
                      <button key={tp} onClick={() => setNewDocType(tp)}
                        className={clsx('text-xs px-2 py-1 rounded-lg border flex items-center gap-1 transition-colors',
                          newDocType === tp
                            ? 'border-primary-300 bg-primary-50 text-primary-700 dark:border-primary-700 dark:bg-primary-950 dark:text-primary-300'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                        )} style={newDocType !== tp ? { borderColor: 'var(--border)', color: 'var(--text-secondary)' } : undefined}>
                        <Icon className={clsx('w-3 h-3', typeColors[tp])} /> {typeLabels[tp]}
                      </button>
                    );
                  })}
                </div>
                {DOC_TEMPLATES[newDocType] && (
                  <div className="text-[10px] px-2 py-1 rounded mt-1" style={{ background: 'var(--surface-hover)', color: 'var(--text-tertiary)' }}>
                    {t('wiki.willAutoFill', { type: typeLabels[newDocType] })}
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--text-tertiary)' }}>{t('wiki.linkProjects')}</label>
                <div className="flex flex-wrap gap-1.5">
                  {projects.map(p => {
                    const selected = newDocProjectTags.includes(p.name);
                    return (
                      <button key={p.id} onClick={() => {
                        setNewDocProjectTags(prev => selected ? prev.filter(n => n !== p.name) : [...prev, p.name]);
                      }}
                        className={clsx('text-xs px-2 py-1 rounded-lg border transition-colors',
                          selected ? 'border-primary-300 bg-primary-50 text-primary-700 dark:border-primary-700 dark:bg-primary-950 dark:text-primary-300'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                        )} style={!selected ? { borderColor: 'var(--border)', color: 'var(--text-secondary)' } : undefined}>
                        {p.name} {selected && '✓'}
                      </button>
                    );
                  })}
                  {projects.length === 0 && <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('wiki.noProjects')}</span>}
                </div>
              </div>
              {/* 渲染模板选择 */}
              {renderTemplates.filter(t => t.status === 'active').length > 0 && (
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--text-tertiary)' }}>{t('studio.renderTemplate')}</label>
                  <Select
                    value={newDocRenderTemplateId}
                    onChange={(e) => { setNewDocRenderTemplateId(e.target.value); setTemplatePreviewMode('html'); }}
                    className="text-xs"
                  >
                    <option value="">{t('studio.noTemplate')}</option>
                    {renderTemplates.filter(t => t.status === 'active').map(tpl => (
                      <option key={tpl.id} value={tpl.id}>{tpl.name} ({tpl.category})</option>
                    ))}
                  </Select>
                  <p className="text-[10px] mt-1" style={{ color: 'var(--text-tertiary)' }}>
                    {newDocRenderTemplateId ? t('studio.templateWithExample') : t('studio.templateHint')}
                  </p>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button size="sm" variant="secondary" onClick={() => { setShowNewDocDialog(false); setNewDocProjectTags([]); setNewDocType('note'); setNewDocRenderTemplateId(''); }}>{t('common.cancel')}</Button>
              <Button size="sm" onClick={handleCreateDoc}>{t('common.create')}</Button>
            </div>
            </div>
            {/* 右侧：模板预览（选中渲染模板时显示） */}
            {hasTemplate && selectedRt && (
              <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* 预览 tab 栏 */}
                <div className="flex items-center gap-1 px-3 py-2 border-b" style={{ borderColor: 'var(--border)', background: 'var(--surface-hover)' }}>
                  <Eye className="w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }} />
                  <span className="text-xs font-medium mr-2" style={{ color: 'var(--text-secondary)' }}>{t('studio.templatePreview')}</span>
                  <div className="flex items-center gap-0.5 bg-[var(--bg-tertiary)] rounded-md p-0.5">
                    <button
                      onClick={() => setTemplatePreviewMode('html')}
                      className={clsx(
                        'px-2 py-0.5 rounded text-[11px] transition-colors',
                        templatePreviewMode === 'html'
                          ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm font-medium'
                          : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                      )}
                    >
                      {t('studio.htmlView')}
                    </button>
                    <button
                      onClick={() => setTemplatePreviewMode('md')}
                      className={clsx(
                        'px-2 py-0.5 rounded text-[11px] transition-colors',
                        templatePreviewMode === 'md'
                          ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm font-medium'
                          : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                      )}
                    >
                      {t('studio.mdView')}
                    </button>
                  </div>
                  <span className="text-[10px] ml-auto" style={{ color: 'var(--text-tertiary)' }}>
                    {selectedRt.slots ? `${Object.keys(selectedRt.slots).length} ${t('renderTemplate.slots')}` : ''}
                  </span>
                </div>
                {/* 预览内容 */}
                <div className="flex-1 overflow-auto" style={{ background: templatePreviewMode === 'html' ? '#f8fafc' : 'var(--surface)' }}>
                  {templatePreviewMode === 'html' ? (
                    <iframe
                      srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;padding:0;background:#f8fafc;overflow:auto;}${selectedRt.cssTemplate || ''}</style></head><body>${previewHtml}</body></html>`}
                      className="w-full h-full"
                      style={{ border: 'none', minHeight: '400px' }}
                      sandbox="allow-same-origin"
                      title="template-preview"
                    />
                  ) : (
                    <div className="p-4">
                      <pre className="text-xs leading-relaxed whitespace-pre-wrap break-words font-mono" style={{ color: 'var(--text-secondary)' }}>
                        {selectedRt.mdTemplate || '(无 MD 模板)'}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        );
      })()}

      {/* 删除确认 */}
      <ConfirmDialog
        isOpen={deleteAction.isOpen}
        onClose={deleteAction.cancel}
        onConfirm={() => deleteAction.confirm(handleDelete)}
        title={t('wiki.confirmDelete')}
        message={t('wiki.deleteWarning')}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        isLoading={deleteAction.isLoading}
      />

      {/* 分享链接对话框 */}
      {showShareDialog && selectedDoc && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50" role="dialog" aria-modal="true" aria-labelledby="share-doc-title">
          <div className="rounded-2xl p-6 w-96 shadow-float" style={{ background: 'var(--surface)' }}>
            <h3 id="share-doc-title" className="font-display font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <Share2 className="w-4 h-4" /> {t('wiki.shareLink')}
            </h3>
            <div className="mb-4">
              <p className="text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>{selectedDoc.title}</p>
              <div className="flex items-center gap-2">
                <Input
                  value={getShareUrl()}
                  readOnly
                  className="flex-1 text-xs bg-slate-50 dark:bg-slate-800"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <Button
                  size="sm"
                  variant={copySuccess ? 'primary' : 'secondary'}
                  onClick={handleCopyLink}
                  className="px-3"
                >
                  {copySuccess ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                </Button>
              </div>
              {copySuccess && (
                <p className="text-xs text-primary-600 mt-2">{t('wiki.linkCopied')}</p>
              )}
            </div>
            <div className="flex justify-end">
              <Button size="sm" variant="secondary" onClick={() => { setShowShareDialog(false); setCopySuccess(false); }}>{t('common.close')}</Button>
            </div>
          </div>
        </div>
      )}

      {/* 提交交付对话框 */}
      {showDeliverDialog && selectedDoc && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50" role="dialog" aria-modal="true" aria-labelledby="deliver-doc-title">
          <div className="rounded-2xl p-6 w-96 shadow-float" style={{ background: 'var(--surface)' }}>
            <h3 id="deliver-doc-title" className="font-display font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <Send className="w-4 h-4 text-emerald-500" /> {t('wiki.submitDelivery', { defaultValue: '提交交付' })}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--text-tertiary)' }}>{t('wiki.docTitle')}</label>
                <Input value={selectedDoc.title} readOnly className="text-sm bg-slate-50 dark:bg-slate-800" />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--text-tertiary)' }}>{t('wiki.selectReviewer', { defaultValue: '选择审批人' })}</label>
                <Select
                  value={deliverReviewerId}
                  onChange={e => setDeliverReviewerId(e.target.value)}
                  className="text-sm"
                >
                  <option value="">{t('wiki.pleaseSelectReviewer', { defaultValue: '请选择审批人...' })}</option>
                  {members.filter(m => m.type === 'ai').map(m => (
                    <option key={m.id} value={m.id}>{m.name} (AI)</option>
                  ))}
                  {members.filter(m => m.type === 'human').map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--text-tertiary)' }}>{t('wiki.deliveryDescription', { defaultValue: '交付说明（可选）' })}</label>
                <textarea
                  value={deliverDescription}
                  onChange={e => setDeliverDescription(e.target.value)}
                  placeholder={t('wiki.deliveryDescriptionPlaceholder', { defaultValue: '描述交付内容和审核要求...' })}
                  className="w-full p-2 text-sm border rounded-md resize-none focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600"
                  style={{ color: 'var(--text-primary)' }}
                  rows={3}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button size="sm" variant="secondary" onClick={() => { setShowDeliverDialog(false); setDeliverReviewerId(''); setDeliverDescription(''); }}>
                {t('common.cancel')}
              </Button>
              <Button
                size="sm"
                onClick={handleSubmitDelivery}
                disabled={!deliverReviewerId || submittingDelivery}
                className="bg-emerald-500 text-white hover:bg-emerald-600"
              >
                {submittingDelivery ? t('common.loading') : t('wiki.submitDelivery', { defaultValue: '提交交付' })}
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* Content Studio 导出对话框 */}
      {showExportModal && (
        <ExportModal
          open={showExportModal}
          onClose={() => setShowExportModal(false)}
          htmlContent={studioHtmlContent}
          exportConfig={currentRenderTemplate?.exportConfig as import('@/components/studio/ExportModal').ExportConfig | undefined}
          fileName={selectedDoc?.title || 'export'}
        />
      )}
    </AppShell>
  );
}
