'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { useConfirmAction } from '@/hooks/useConfirmAction';
import ConfirmDialog from '@/components/ConfirmDialog';
import AppShell from '@/components/AppShell';
import Header from '@/components/Header';
import { Button, Input, Badge } from '@/components/ui';
import { useSOPTemplateStore, useProjectStore } from '@/store';
import { useRenderTemplateStore } from '@/store/render-template.store';
import type { SOPTemplate, SOPCategory, SOPStage, RenderTemplate } from '@/db/schema';
import clsx from 'clsx';
import {
  ClipboardList, Search, Plus, ChevronRight, Trash2, Edit2,
  FileText, BarChart2, Search as SearchIcon, Code, Calendar,
  Layers, AlertTriangle, CheckCircle2,
  Download, Upload, Palette, Eye,
} from 'lucide-react';
import SOPTemplateEditor from '@/components/sop/SOPTemplateEditor';

type PageTab = 'sop' | 'render';

type CategoryFilter = 'all' | SOPCategory;
type StatusFilter = 'all' | 'draft' | 'active' | 'archived';

// 分类图标映射
const categoryIcons: Record<SOPCategory, typeof FileText> = {
  content: FileText,
  analysis: BarChart2,
  research: SearchIcon,
  development: Code,
  operations: Calendar,
  media: Layers,
  custom: Layers,
};

// 分类颜色映射
const categoryColors: Record<SOPCategory, string> = {
  content: 'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400',
  analysis: 'bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400',
  research: 'bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400',
  development: 'bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-400',
  operations: 'bg-cyan-50 text-cyan-600 dark:bg-cyan-950 dark:text-cyan-400',
  media: 'bg-pink-50 text-pink-600 dark:bg-pink-950 dark:text-pink-400',
  custom: 'bg-slate-50 text-slate-600 dark:bg-slate-950 dark:text-slate-400',
};

export default function SOPPage() {
  const { t } = useTranslation();
  const { templates, loading, error, deleteTemplateAsync } = useSOPTemplateStore();
  const { projects } = useProjectStore();
  const { templates: renderTemplates, loading: rtLoading, deleteTemplateAsync: deleteRenderTemplate, fetchTemplates: fetchRenderTemplates } = useRenderTemplateStore();
  
  const [pageTab, setPageTab] = useState<PageTab>('sop');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<SOPTemplate | null>(null);
  
  const deleteConfirm = useConfirmAction<string>();
  const [importLoading, setImportLoading] = useState(false);
  
  // 导出模板
  const handleExport = useCallback(async (templateId: string) => {
    try {
      const res = await fetch(`/api/sop-templates/${templateId}/export`);
      if (!res.ok) throw new Error('Export failed');
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sop-${data.name || templateId}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('导出失败:', err);
    }
  }, []);
  
  // 导入模板
  const handleImport = useCallback(async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setImportLoading(true);
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const res = await fetch('/api/sop-templates/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: '导入失败' }));
          alert(err.error || t('sop.importError'));
        } else {
          // 刷新模板列表
          useSOPTemplateStore.getState().fetchTemplates();
        }
      } catch {
        alert(t('sop.importError'));
      } finally {
        setImportLoading(false);
      }
    };
    input.click();
  }, [t]);
  
  // ESC 关闭编辑器
  useEscapeKey(showEditor, useCallback(() => setShowEditor(false), []));
  
  // 分类选项
  const categories: { key: CategoryFilter; label: string }[] = useMemo(() => [
    { key: 'all', label: t('sop.all') },
    { key: 'content', label: t('sop.content') },
    { key: 'analysis', label: t('sop.analysis') },
    { key: 'research', label: t('sop.research') },
    { key: 'development', label: t('sop.development') },
    { key: 'operations', label: t('sop.operations') },
    { key: 'media', label: t('sop.media') },
    { key: 'custom', label: t('sop.custom') },
  ], [t]);
  
  // 状态选项
  const statuses: { key: StatusFilter; label: string }[] = useMemo(() => [
    { key: 'all', label: t('sop.all') },
    { key: 'active', label: t('sop.active') },
    { key: 'draft', label: t('sop.draft') },
    { key: 'archived', label: t('sop.archived') },
  ], [t]);
  
  // 过滤模板
  const filteredTemplates = useMemo(() => {
    let result = templates;
    
    // 分类过滤
    if (categoryFilter !== 'all') {
      result = result.filter(t => t.category === categoryFilter);
    }
    
    // 状态过滤
    if (statusFilter !== 'all') {
      result = result.filter(t => t.status === statusFilter);
    }
    
    // 搜索过滤
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(t =>
        t.name.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q)
      );
    }
    
    return result;
  }, [templates, categoryFilter, statusFilter, search]);
  
  // 获取项目名称
  const getProjectName = useCallback((projectId: string | null) => {
    if (!projectId) return t('sop.global');
    const project = projects.find(p => p.id === projectId);
    return project?.name || t('sop.global');
  }, [projects, t]);
  
  // 打开新建/编辑
  const handleCreate = useCallback(() => {
    setEditingTemplate(null);
    setShowEditor(true);
  }, []);
  
  const handleEdit = useCallback((template: SOPTemplate) => {
    setEditingTemplate(template);
    setShowEditor(true);
  }, []);
  
  const handleCloseEditor = useCallback(() => {
    setShowEditor(false);
    setEditingTemplate(null);
  }, []);
  
  // 删除模板
  const handleDelete = useCallback(async (id: string) => {
    const success = await deleteTemplateAsync(id);
    if (success && selectedTemplateId === id) {
      setSelectedTemplateId(null);
    }
  }, [deleteTemplateAsync, selectedTemplateId]);
  
  // === 渲染模板 ===
  const [selectedRtId, setSelectedRtId] = useState<string | null>(null);
  const rtDeleteConfirm = useConfirmAction<string>();
  
  const selectedRt = useMemo(() => 
    renderTemplates.find(t => t.id === selectedRtId) || null,
    [renderTemplates, selectedRtId]
  );
  
  const handleDeleteRt = useCallback(async (id: string) => {
    const success = await deleteRenderTemplate(id);
    if (success && selectedRtId === id) setSelectedRtId(null);
  }, [deleteRenderTemplate, selectedRtId]);
  
  // 切换到渲染模板标签时加载数据
  useEffect(() => {
    if (pageTab === 'render' && renderTemplates.length === 0) fetchRenderTemplates();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageTab]);
  
  // 渲染模板分类颜色
  const rtCategoryColors: Record<string, string> = useMemo(() => ({
    report: 'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400',
    card: 'bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400',
    poster: 'bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400',
    presentation: 'bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-400',
    custom: 'bg-slate-50 text-slate-600 dark:bg-slate-950 dark:text-slate-400',
  }), []);
  
  // 选中的模板
  const selectedTemplate = useMemo(() => 
    filteredTemplates.find(t => t.id === selectedTemplateId) || null,
    [filteredTemplates, selectedTemplateId]
  );
  
  // 阶段类型标签
  const getStageTypeLabel = useCallback((type: SOPStage['type']) => {
    const labels: Record<SOPStage['type'], string> = {
      input: t('sop.stageTypeInput'),
      ai_auto: t('sop.stageTypeAiAuto'),
      ai_with_confirm: t('sop.stageTypeAiConfirm'),
      manual: t('sop.stageTypeManual'),
      render: t('sop.stageTypeRender'),
      export: t('sop.stageTypeExport'),
      review: t('sop.stageTypeReview'),
    };
    return labels[type] || type;
  }, [t]);
  
  // 阶段类型颜色
  const getStageTypeColor = useCallback((type: SOPStage['type']) => {
    const colors: Record<SOPStage['type'], string> = {
      input: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
      ai_auto: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400',
      ai_with_confirm: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
      manual: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
      render: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400',
      export: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-400',
      review: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400',
    };
    return colors[type] || 'bg-slate-100 text-slate-700';
  }, []);

  return (
    <AppShell>
      <Header title={t('sop.title')} />
      
      <div className="p-6">
        {/* 页面标签切换 */}
        <div className="flex items-center gap-1 mb-6 p-1 rounded-lg w-fit" style={{ backgroundColor: 'var(--bg-secondary)' }}>
          <button
            onClick={() => setPageTab('sop')}
            className={clsx(
              'flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md transition-colors',
              pageTab === 'sop'
                ? 'bg-white dark:bg-slate-700 shadow-sm'
                : 'hover:bg-white/50 dark:hover:bg-slate-700/50'
            )}
            style={{ color: pageTab === 'sop' ? 'var(--text-primary)' : 'var(--text-tertiary)' }}
          >
            <ClipboardList className="w-4 h-4" />
            {t('sop.title')}
          </button>
          <button
            onClick={() => setPageTab('render')}
            className={clsx(
              'flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md transition-colors',
              pageTab === 'render'
                ? 'bg-white dark:bg-slate-700 shadow-sm'
                : 'hover:bg-white/50 dark:hover:bg-slate-700/50'
            )}
            style={{ color: pageTab === 'render' ? 'var(--text-primary)' : 'var(--text-tertiary)' }}
          >
            <Palette className="w-4 h-4" />
            {t('sop.renderTemplatesTab')}
          </button>
        </div>

        {pageTab === 'sop' ? (
          <>
            {/* SOP 工具栏 */}
            <div className="flex items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t('sop.search')}
                    className="pl-9 w-64"
                  />
                </div>
                
                <div className="flex items-center gap-1 p-1 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                  {categories.map(cat => (
                    <button
                      key={cat.key}
                      onClick={() => setCategoryFilter(cat.key)}
                      className={clsx(
                        'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                        categoryFilter === cat.key
                          ? 'bg-white dark:bg-slate-700 shadow-sm'
                          : 'hover:bg-white/50 dark:hover:bg-slate-700/50'
                      )}
                      style={{ color: categoryFilter === cat.key ? 'var(--text-primary)' : 'var(--text-tertiary)' }}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
                
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors"
                  style={{ 
                    backgroundColor: 'var(--bg-primary)',
                    borderColor: 'var(--border)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  {statuses.map(s => (
                    <option key={s.key} value={s.key}>{s.label}</option>
                  ))}
                </select>
              </div>
              
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={handleImport} disabled={importLoading}>
                  <Upload className="w-4 h-4 mr-1.5" />
                  {importLoading ? '...' : t('sop.importTemplate')}
                </Button>
                <Button onClick={handleCreate}>
                  <Plus className="w-4 h-4 mr-1.5" />
                  {t('sop.newTemplate')}
                </Button>
              </div>
            </div>
            
            {/* SOP 主内容区：左侧列表 + 右侧详情 */}
            <div className="grid grid-cols-12 gap-6">
              <div className="col-span-5">
                <div className="card divide-y" style={{ borderColor: 'var(--border)' }}>
                  {loading ? (
                    <div className="p-8 text-center" style={{ color: 'var(--text-tertiary)' }}>
                      {t('common.loading')}
                    </div>
                  ) : filteredTemplates.length === 0 ? (
                    <div className="p-8 text-center">
                      <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" style={{ color: 'var(--text-tertiary)' }} />
                      <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                        {t('sop.noTemplates')}
                      </p>
                      <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                        {t('sop.noTemplatesHint')}
                      </p>
                    </div>
                  ) : (
                    filteredTemplates.map(template => {
                      const CategoryIcon = categoryIcons[template.category as SOPCategory] || Layers;
                      const isSelected = selectedTemplateId === template.id;
                      
                      return (
                        <div
                          key={template.id}
                          onClick={() => setSelectedTemplateId(template.id)}
                          className={clsx(
                            'p-4 cursor-pointer transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.02]',
                            isSelected && 'bg-blue-50/50 dark:bg-blue-950/30'
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <div className={clsx(
                              'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
                              categoryColors[template.category as SOPCategory] || categoryColors.custom
                            )}>
                              <CategoryIcon className="w-5 h-5" />
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                                  {template.name}
                                </span>
                                {template.isBuiltin && (
                                  <Badge className="text-[9px] bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
                                    {t('sop.builtin')}
                                  </Badge>
                                )}
                                {template.status === 'draft' && (
                                  <Badge className="text-[9px] bg-slate-100 text-slate-500 dark:bg-slate-800">
                                    {t('sop.draft')}
                                  </Badge>
                                )}
                                {template.status === 'archived' && (
                                  <Badge className="text-[9px] bg-red-50 text-red-500 dark:bg-red-950">
                                    {t('sop.archived')}
                                  </Badge>
                                )}
                              </div>
                              
                              {template.description && (
                                <p className="text-xs mt-1 line-clamp-1" style={{ color: 'var(--text-tertiary)' }}>
                                  {template.description}
                                </p>
                              )}
                              
                              <div className="flex items-center gap-3 mt-2">
                                <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                                  {Array.isArray(template.stages) ? template.stages.length : 0} {t('sop.stages')}
                                </span>
                                <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                                  {getProjectName(template.projectId)}
                                </span>
                              </div>
                            </div>
                            
                            <ChevronRight 
                              className={clsx('w-4 h-4 flex-shrink-0 transition-transform', isSelected && 'rotate-90')} 
                              style={{ color: 'var(--text-tertiary)' }}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
              
              {/* SOP 模板详情 */}
              <div className="col-span-7">
                {selectedTemplate ? (
                  <div className="card p-6">
                    <div className="flex items-start justify-between mb-6">
                      <div className="flex items-center gap-4">
                        <div className={clsx(
                          'w-14 h-14 rounded-xl flex items-center justify-center',
                          categoryColors[selectedTemplate.category as SOPCategory] || categoryColors.custom
                        )}>
                          {(() => {
                            const Icon = categoryIcons[selectedTemplate.category as SOPCategory] || Layers;
                            return <Icon className="w-7 h-7" />;
                          })()}
                        </div>
                        <div>
                          <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                            {selectedTemplate.name}
                          </h2>
                          <p className="text-sm mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                            {selectedTemplate.description || t('sop.descriptionPlaceholder')}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button variant="secondary" size="sm" onClick={() => handleExport(selectedTemplate.id)}>
                          <Download className="w-3.5 h-3.5 mr-1" />
                          {t('sop.exportTemplate')}
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => handleEdit(selectedTemplate)}>
                          <Edit2 className="w-3.5 h-3.5 mr-1" />
                          {t('common.edit')}
                        </Button>
                        {!selectedTemplate.isBuiltin && (
                          <Button 
                            variant="secondary" 
                            size="sm" 
                            className="text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
                            onClick={() => deleteConfirm.requestConfirm(selectedTemplate.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 mb-6 p-4 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                      <div>
                        <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                          {t('sop.category')}
                        </span>
                        <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--text-primary)' }}>
                          {t(`sop.${selectedTemplate.category}`)}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                          {t('sop.status')}
                        </span>
                        <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--text-primary)' }}>
                          {t(`sop.${selectedTemplate.status}`)}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                          {t('sop.linkedProject')}
                        </span>
                        <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--text-primary)' }}>
                          {getProjectName(selectedTemplate.projectId)}
                        </p>
                      </div>
                    </div>
                    
                    <div className="mb-6">
                      <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-tertiary)' }}>
                        {t('sop.stagesTitle')} ({Array.isArray(selectedTemplate.stages) ? selectedTemplate.stages.length : 0})
                      </h3>
                      
                      {!Array.isArray(selectedTemplate.stages) || selectedTemplate.stages.length === 0 ? (
                        <div className="p-4 text-center rounded-lg border-2 border-dashed" style={{ borderColor: 'var(--border)' }}>
                          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                            {t('sop.noStages')}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {selectedTemplate.stages.map((stage, index) => (
                            <div 
                              key={stage.id} 
                              className="flex items-center gap-3 p-3 rounded-lg border"
                              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-primary)' }}
                            >
                              <div className="flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold"
                                style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-tertiary)' }}
                              >
                                {index + 1}
                              </div>
                              
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                                    {stage.label}
                                  </span>
                                  <span className={clsx('px-1.5 py-0.5 text-[10px] font-medium rounded', getStageTypeColor(stage.type))}>
                                    {getStageTypeLabel(stage.type)}
                                  </span>
                                  {stage.optional && (
                                    <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>(optional)</span>
                                  )}
                                </div>
                                {stage.description && (
                                  <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-tertiary)' }}>
                                    {stage.description}
                                  </p>
                                )}
                              </div>
                              
                              {stage.outputType && (
                                <Badge className="text-[9px]">
                                  {stage.outputType}
                                </Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    {Array.isArray(selectedTemplate.qualityChecklist) && selectedTemplate.qualityChecklist.length > 0 && (
                      <div>
                        <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-tertiary)' }}>
                          {t('sop.qualityChecklist')} ({selectedTemplate.qualityChecklist.length})
                        </h3>
                        <div className="space-y-1.5">
                          {selectedTemplate.qualityChecklist.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                              <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                              <span>{item}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="card p-12 text-center">
                    <ClipboardList className="w-16 h-16 mx-auto mb-4 opacity-20" style={{ color: 'var(--text-tertiary)' }} />
                    <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                      {t('agents.selectAgent').replace('Agent', 'SOP')}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* 渲染模板标签页 */}
            <div className="grid grid-cols-12 gap-6">
              {/* 渲染模板列表 */}
              <div className="col-span-5">
                <div className="card divide-y" style={{ borderColor: 'var(--border)' }}>
                  {rtLoading ? (
                    <div className="p-8 text-center" style={{ color: 'var(--text-tertiary)' }}>
                      {t('common.loading')}
                    </div>
                  ) : renderTemplates.length === 0 ? (
                    <div className="p-8 text-center">
                      <Palette className="w-12 h-12 mx-auto mb-3 opacity-30" style={{ color: 'var(--text-tertiary)' }} />
                      <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                        {t('renderTemplate.noTemplates')}
                      </p>
                      <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                        {t('renderTemplate.noTemplatesHint')}
                      </p>
                    </div>
                  ) : (
                    renderTemplates.map(rt => {
                      const isSelected = selectedRtId === rt.id;
                      const catColor = rtCategoryColors[rt.category] || rtCategoryColors.custom;
                      
                      return (
                        <div
                          key={rt.id}
                          onClick={() => setSelectedRtId(rt.id)}
                          className={clsx(
                            'p-4 cursor-pointer transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.02]',
                            isSelected && 'bg-purple-50/50 dark:bg-purple-950/30'
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <div className={clsx(
                              'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
                              catColor
                            )}>
                              <Palette className="w-5 h-5" />
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                                  {rt.name}
                                </span>
                                {rt.isBuiltin && (
                                  <Badge className="text-[9px] bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
                                    {t('sop.builtin')}
                                  </Badge>
                                )}
                                <Badge className={clsx('text-[9px]', catColor)}>
                                  {t(`renderTemplate.${rt.category}`)}
                                </Badge>
                              </div>
                              
                              {rt.description && (
                                <p className="text-xs mt-1 line-clamp-1" style={{ color: 'var(--text-tertiary)' }}>
                                  {rt.description}
                                </p>
                              )}
                              
                              <div className="flex items-center gap-3 mt-2">
                                <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                                  {rt.status === 'active' ? t('sop.active') : rt.status === 'draft' ? t('sop.draft') : t('sop.archived')}
                                </span>
                                <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                                  {Object.keys(rt.slots || {}).length} {t('renderTemplate.slots', 'slots')}
                                </span>
                              </div>
                            </div>
                            
                            <ChevronRight 
                              className={clsx('w-4 h-4 flex-shrink-0 transition-transform', isSelected && 'rotate-90')} 
                              style={{ color: 'var(--text-tertiary)' }}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
              
              {/* 渲染模板详情 */}
              <div className="col-span-7">
                {selectedRt ? (
                  <div className="card p-6">
                    {/* 头部 */}
                    <div className="flex items-start justify-between mb-6">
                      <div className="flex items-center gap-4">
                        <div className={clsx(
                          'w-14 h-14 rounded-xl flex items-center justify-center',
                          rtCategoryColors[selectedRt.category] || rtCategoryColors.custom
                        )}>
                          <Palette className="w-7 h-7" />
                        </div>
                        <div>
                          <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                            {selectedRt.name}
                          </h2>
                          <p className="text-sm mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                            {selectedRt.description || t('renderTemplate.noTemplatesHint')}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {!selectedRt.isBuiltin && (
                          <Button 
                            variant="secondary" 
                            size="sm" 
                            className="text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
                            onClick={() => rtDeleteConfirm.requestConfirm(selectedRt.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                    
                    {/* 元信息 */}
                    <div className="grid grid-cols-3 gap-4 mb-6 p-4 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                      <div>
                        <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                          {t('sop.category')}
                        </span>
                        <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--text-primary)' }}>
                          {t(`renderTemplate.${selectedRt.category}`)}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                          {t('sop.status')}
                        </span>
                        <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--text-primary)' }}>
                          {selectedRt.status === 'active' ? t('sop.active') : selectedRt.status === 'draft' ? t('sop.draft') : t('sop.archived')}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                          {t('renderTemplate.subtitle')}
                        </span>
                        <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--text-primary)' }}>
                          {selectedRt.isBuiltin ? t('sop.builtin') : t('sop.custom')}
                        </p>
                      </div>
                    </div>
                    
                    {/* 槽位定义 */}
                    {selectedRt.slots && Object.keys(selectedRt.slots).length > 0 && (
                      <div className="mb-6">
                        <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-tertiary)' }}>
                          Slots ({Object.keys(selectedRt.slots).length})
                        </h3>
                        <div className="space-y-2">
                          {Object.entries(selectedRt.slots).map(([key, slot]) => (
                            <div 
                              key={key} 
                              className="flex items-center gap-3 p-3 rounded-lg border"
                              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-primary)' }}
                            >
                              <code className="text-xs font-mono px-2 py-0.5 rounded" 
                                style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--accent)' }}>
                                {key}
                              </code>
                              <div className="flex-1 min-w-0">
                                <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                                  {String((slot as Record<string, unknown>)?.label || key)}
                                </span>
                                {typeof (slot as Record<string, unknown>)?.type === 'string' && (
                                  <Badge className="text-[9px] ml-2">
                                    {String((slot as Record<string, unknown>).type)}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* 区块定义 */}
                    {Array.isArray(selectedRt.sections) && selectedRt.sections.length > 0 && (
                      <div className="mb-6">
                        <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-tertiary)' }}>
                          Sections ({selectedRt.sections.length})
                        </h3>
                        <div className="space-y-2">
                          {selectedRt.sections.map((section, idx) => (
                            <div 
                              key={idx}
                              className="flex items-center gap-3 p-3 rounded-lg border"
                              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-primary)' }}
                            >
                              <div className="flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold"
                                style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-tertiary)' }}
                              >
                                {idx + 1}
                              </div>
                              <div className="flex-1 min-w-0">
                                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                                  {String((section as Record<string, unknown>)?.label || `Section ${idx + 1}`)}
                                </span>
                                {Boolean((section as Record<string, unknown>)?.repeatable) && (
                                  <Badge className="text-[9px] ml-2 bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
                                    repeatable
                                  </Badge>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* HTML 模板预览 */}
                    {selectedRt.htmlTemplate && (
                      <div>
                        <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-tertiary)' }}>
                          HTML Template
                        </h3>
                        <pre className="text-xs p-4 rounded-lg overflow-auto max-h-60 font-mono"
                          style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
                        >
                          {selectedRt.htmlTemplate.length > 2000 
                            ? selectedRt.htmlTemplate.slice(0, 2000) + '\n...' 
                            : selectedRt.htmlTemplate}
                        </pre>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="card p-12 text-center">
                    <Palette className="w-16 h-16 mx-auto mb-4 opacity-20" style={{ color: 'var(--text-tertiary)' }} />
                    <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                      {t('renderTemplate.noTemplatesHint')}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
      
      {/* 编辑器弹窗 */}
      {showEditor && (
        <SOPTemplateEditor
          template={editingTemplate}
          onClose={handleCloseEditor}
        />
      )}
      
      {/* 删除确认 */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title={t('sop.deleteTemplate')}
        message={t('sop.deleteConfirm')}
        onConfirm={() => {
          if (deleteConfirm.target) handleDelete(deleteConfirm.target);
          deleteConfirm.cancel();
        }}
        onClose={deleteConfirm.cancel}
      />
      
      {/* 渲染模板删除确认 */}
      <ConfirmDialog
        isOpen={rtDeleteConfirm.isOpen}
        title={t('sop.deleteTemplate')}
        message={t('sop.deleteConfirm')}
        onConfirm={() => {
          if (rtDeleteConfirm.target) handleDeleteRt(rtDeleteConfirm.target);
          rtDeleteConfirm.cancel();
        }}
        onClose={rtDeleteConfirm.cancel}
      />
    </AppShell>
  );
}
