'use client';

import { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSOPTemplateStore, useProjectStore } from '@/store';
import { useRenderTemplateStore } from '@/store/render-template.store';
import { Button, Input, Badge } from '@/components/ui';
import type { SOPTemplate, SOPStage, SOPCategory, StageType, StageOutputType } from '@/db/schema';
import clsx from 'clsx';
import {
  X, Plus, Trash2, ChevronDown, ChevronUp, CheckCircle2, GripVertical,
} from 'lucide-react';

interface SOPTemplateEditorProps {
  template: SOPTemplate | null;  // null = 新建
  onClose: () => void;
}

// 生成唯一 ID
const generateId = () => Math.random().toString(36).slice(2, 10);

// 阶段类型选项
const stageTypeOptions: { value: StageType; label: string }[] = [
  { value: 'input', label: 'stageTypeInput' },
  { value: 'ai_auto', label: 'stageTypeAiAuto' },
  { value: 'ai_with_confirm', label: 'stageTypeAiConfirm' },
  { value: 'manual', label: 'stageTypeManual' },
  { value: 'render', label: 'stageTypeRender' },
  { value: 'export', label: 'stageTypeExport' },
  { value: 'review', label: 'stageTypeReview' },
];

// 产出类型选项
const outputTypeOptions: StageOutputType[] = ['text', 'markdown', 'html', 'data', 'file'];

// 分类选项
const categoryOptions: SOPCategory[] = ['content', 'analysis', 'research', 'development', 'operations', 'media', 'custom'];

export default function SOPTemplateEditor({ template, onClose }: SOPTemplateEditorProps) {
  const { t } = useTranslation();
  const { createTemplate, updateTemplateAsync } = useSOPTemplateStore();
  const { projects } = useProjectStore();
  const { templates: renderTemplates } = useRenderTemplateStore();
  
  const isEditing = template !== null;
  const [saving, setSaving] = useState(false);
  
  // 表单状态
  const [name, setName] = useState(template?.name || '');
  const [description, setDescription] = useState(template?.description || '');
  const [category, setCategory] = useState<SOPCategory>(template?.category as SOPCategory || 'custom');
  const [status, setStatus] = useState<'draft' | 'active' | 'archived'>(template?.status as 'draft' | 'active' | 'archived' || 'active');
  const [icon, setIcon] = useState(template?.icon || 'clipboard-list');
  const [projectId, setProjectId] = useState<string | null>(template?.projectId || null);
  const [systemPrompt, setSystemPrompt] = useState(template?.systemPrompt || '');
  const [requiredTools, setRequiredTools] = useState<string[]>(template?.requiredTools || []);
  const [qualityChecklist, setQualityChecklist] = useState<string[]>(template?.qualityChecklist || []);
  
  // 阶段列表
  const [stages, setStages] = useState<SOPStage[]>(() => {
    if (template?.stages && Array.isArray(template.stages)) {
      return template.stages;
    }
    return [];
  });
  
  // 展开的阶段
  const [expandedStageId, setExpandedStageId] = useState<string | null>(null);
  
  // 新增质量检查项输入
  const [newCheckItem, setNewCheckItem] = useState('');
  
  // 添加阶段
  const handleAddStage = useCallback(() => {
    const newStage: SOPStage = {
      id: generateId(),
      label: '',
      description: '',
      type: 'ai_auto',
      promptTemplate: '',
      outputType: 'text',
      outputLabel: '',
    };
    setStages(prev => [...prev, newStage]);
    setExpandedStageId(newStage.id);
  }, []);
  
  // 更新阶段
  const handleUpdateStage = useCallback((id: string, updates: Partial<SOPStage>) => {
    setStages(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  }, []);
  
  // 删除阶段
  const handleDeleteStage = useCallback((id: string) => {
    setStages(prev => prev.filter(s => s.id !== id));
    if (expandedStageId === id) {
      setExpandedStageId(null);
    }
  }, [expandedStageId]);
  
  // 移动阶段
  const handleMoveStage = useCallback((id: string, direction: 'up' | 'down') => {
    setStages(prev => {
      const idx = prev.findIndex(s => s.id === id);
      if (idx < 0) return prev;
      if (direction === 'up' && idx === 0) return prev;
      if (direction === 'down' && idx === prev.length - 1) return prev;
      
      const newStages = [...prev];
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      [newStages[idx], newStages[targetIdx]] = [newStages[targetIdx], newStages[idx]];
      return newStages;
    });
  }, []);
  
  // 拖拽排序状态
  const [dragStageId, setDragStageId] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);
  
  const handleDragStart = useCallback((e: React.DragEvent, stageId: string) => {
    setDragStageId(stageId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', stageId);
  }, []);
  
  const handleDragOver = useCallback((e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (stageId !== dragStageId) {
      setDragOverStageId(stageId);
    }
  }, [dragStageId]);
  
  const handleDragLeave = useCallback(() => {
    setDragOverStageId(null);
  }, []);
  
  const handleDrop = useCallback((e: React.DragEvent, targetStageId: string) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('text/plain');
    if (!sourceId || sourceId === targetStageId) {
      setDragStageId(null);
      setDragOverStageId(null);
      return;
    }
    setStages(prev => {
      const sourceIdx = prev.findIndex(s => s.id === sourceId);
      const targetIdx = prev.findIndex(s => s.id === targetStageId);
      if (sourceIdx < 0 || targetIdx < 0) return prev;
      const newStages = [...prev];
      const [removed] = newStages.splice(sourceIdx, 1);
      newStages.splice(targetIdx, 0, removed);
      return newStages;
    });
    setDragStageId(null);
    setDragOverStageId(null);
  }, []);
  
  const handleDragEnd = useCallback(() => {
    setDragStageId(null);
    setDragOverStageId(null);
  }, []);
  
  // 添加质量检查项
  const handleAddCheckItem = useCallback(() => {
    if (!newCheckItem.trim()) return;
    setQualityChecklist(prev => [...prev, newCheckItem.trim()]);
    setNewCheckItem('');
  }, [newCheckItem]);
  
  // 删除质量检查项
  const handleDeleteCheckItem = useCallback((index: number) => {
    setQualityChecklist(prev => prev.filter((_, i) => i !== index));
  }, []);
  
  // 保存
  const handleSave = useCallback(async () => {
    if (!name.trim()) return;
    
    setSaving(true);
    try {
      if (isEditing && template) {
        await updateTemplateAsync(template.id, {
          name: name.trim(),
          description: description.trim(),
          category,
          status,
          icon,
          projectId,
          systemPrompt,
          requiredTools,
          qualityChecklist,
          stages,
        });
      } else {
        await createTemplate({
          name: name.trim(),
          description: description.trim(),
          category,
          status,
          icon,
          projectId,
          systemPrompt,
          requiredTools,
          qualityChecklist,
          stages,
          isBuiltin: false,
          createdBy: 'user',
        });
      }
      onClose();
    } catch (err) {
      console.error('Save template error:', err);
    } finally {
      setSaving(false);
    }
  }, [
    name, description, category, status, icon, projectId, 
    systemPrompt, requiredTools, qualityChecklist, stages,
    isEditing, template, createTemplate, updateTemplateAsync, onClose
  ]);
  
  // 表单验证
  const isValid = useMemo(() => {
    return name.trim().length > 0;
  }, [name]);
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 遮罩 */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      
      {/* 弹窗 */}
      <div 
        className="relative bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        style={{ backgroundColor: 'var(--bg-primary)' }}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            {isEditing ? t('sop.editTemplate') : t('sop.createTemplate')}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
            <X className="w-5 h-5" style={{ color: 'var(--text-tertiary)' }} />
          </button>
        </div>
        
        {/* 内容 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* 基本信息 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                {t('sop.templateName')} *
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('sop.templateNamePlaceholder')}
              />
            </div>
            
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                {t('sop.category')}
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as SOPCategory)}
                className="w-full px-3 py-2 rounded-lg border text-sm transition-colors"
                style={{
                  backgroundColor: 'var(--bg-primary)',
                  borderColor: 'var(--border)',
                  color: 'var(--text-primary)',
                }}
              >
                {categoryOptions.map(cat => (
                  <option key={cat} value={cat}>{t(`sop.${cat}`)}</option>
                ))}
              </select>
            </div>
            
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                {t('sop.description')}
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('sop.descriptionPlaceholder')}
                rows={2}
                className="w-full px-3 py-2 rounded-lg border text-sm transition-colors resize-none"
                style={{
                  backgroundColor: 'var(--bg-primary)',
                  borderColor: 'var(--border)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
            
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                {t('sop.status')}
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'draft' | 'active' | 'archived')}
                className="w-full px-3 py-2 rounded-lg border text-sm transition-colors"
                style={{
                  backgroundColor: 'var(--bg-primary)',
                  borderColor: 'var(--border)',
                  color: 'var(--text-primary)',
                }}
              >
                <option value="active">{t('sop.active')}</option>
                <option value="draft">{t('sop.draft')}</option>
                <option value="archived">{t('sop.archived')}</option>
              </select>
            </div>
            
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                {t('sop.linkedProject')}
              </label>
              <select
                value={projectId || ''}
                onChange={(e) => setProjectId(e.target.value || null)}
                className="w-full px-3 py-2 rounded-lg border text-sm transition-colors"
                style={{
                  backgroundColor: 'var(--bg-primary)',
                  borderColor: 'var(--border)',
                  color: 'var(--text-primary)',
                }}
              >
                <option value="">{t('sop.noProject')}</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>
          
          {/* AI 配置 */}
          <div>
            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
              {t('sop.aiConfig')}
            </h3>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                {t('sop.systemPrompt')}
              </label>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder={t('sop.systemPromptPlaceholder')}
                rows={3}
                className="w-full px-3 py-2 rounded-lg border text-sm transition-colors resize-none font-mono"
                style={{
                  backgroundColor: 'var(--bg-primary)',
                  borderColor: 'var(--border)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
          </div>
          
          {/* 阶段配置 */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {t('sop.stagesTitle')} ({stages.length})
              </h3>
              <Button variant="secondary" size="sm" onClick={handleAddStage}>
                <Plus className="w-3.5 h-3.5 mr-1" />
                {t('sop.addStage')}
              </Button>
            </div>
            
            {stages.length === 0 ? (
              <div 
                className="p-6 text-center rounded-lg border-2 border-dashed cursor-pointer hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
                style={{ borderColor: 'var(--border)' }}
                onClick={handleAddStage}
              >
                <Plus className="w-8 h-8 mx-auto mb-2 opacity-30" style={{ color: 'var(--text-tertiary)' }} />
                <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                  {t('sop.noStages')}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {stages.map((stage, index) => {
                  const isExpanded = expandedStageId === stage.id;
                  
                  return (
                    <div
                      key={stage.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, stage.id)}
                      onDragOver={(e) => handleDragOver(e, stage.id)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, stage.id)}
                      onDragEnd={handleDragEnd}
                      className={clsx(
                        'border rounded-lg overflow-hidden transition-all',
                        dragStageId === stage.id && 'opacity-40',
                        dragOverStageId === stage.id && 'ring-2 ring-blue-400 dark:ring-blue-600',
                      )}
                      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-primary)' }}
                    >
                      {/* 阶段头部 */}
                      <div 
                        className="flex items-center gap-2 p-3 cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
                        onClick={() => setExpandedStageId(isExpanded ? null : stage.id)}
                      >
                        {/* 拖拽手柄 */}
                        <div 
                          className="cursor-grab active:cursor-grabbing p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/5"
                          onMouseDown={(e) => e.stopPropagation()}
                        >
                          <GripVertical className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleMoveStage(stage.id, 'up'); }}
                            disabled={index === 0}
                            className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-30"
                          >
                            <ChevronUp className="w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleMoveStage(stage.id, 'down'); }}
                            disabled={index === stages.length - 1}
                            className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-30"
                          >
                            <ChevronDown className="w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }} />
                          </button>
                        </div>
                        
                        <div className="flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold"
                          style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-tertiary)' }}
                        >
                          {index + 1}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                            {stage.label || `Stage ${index + 1}`}
                          </span>
                          <Badge className="ml-2 text-[9px]">{t(`sop.${stageTypeOptions.find(o => o.value === stage.type)?.label || 'stageTypeAiAuto'}`)}</Badge>
                        </div>
                        
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteStage(stage.id); }}
                          className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-500" />
                        </button>
                        
                        <ChevronDown 
                          className={clsx('w-4 h-4 transition-transform', isExpanded && 'rotate-180')}
                          style={{ color: 'var(--text-tertiary)' }}
                        />
                      </div>
                      
                      {/* 阶段详情 */}
                      {isExpanded && (
                        <div className="p-4 border-t space-y-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-secondary)' }}>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                                {t('sop.stageLabel')} *
                              </label>
                              <Input
                                value={stage.label}
                                onChange={(e) => handleUpdateStage(stage.id, { label: e.target.value })}
                                placeholder={t('sop.stageLabelPlaceholder')}
                              />
                            </div>
                            
                            <div>
                              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                                {t('sop.stageType')}
                              </label>
                              <select
                                value={stage.type}
                                onChange={(e) => handleUpdateStage(stage.id, { type: e.target.value as StageType })}
                                className="w-full px-3 py-2 rounded-lg border text-sm transition-colors"
                                style={{
                                  backgroundColor: 'var(--bg-primary)',
                                  borderColor: 'var(--border)',
                                  color: 'var(--text-primary)',
                                }}
                              >
                                {stageTypeOptions.map(opt => (
                                  <option key={opt.value} value={opt.value}>{t(`sop.${opt.label}`)}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                          
                          <div>
                            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                              {t('sop.stageDesc')}
                            </label>
                            <Input
                              value={stage.description}
                              onChange={(e) => handleUpdateStage(stage.id, { description: e.target.value })}
                              placeholder={t('sop.stageDescPlaceholder')}
                            />
                          </div>
                          
                          {/* AI 阶段显示 Prompt 模板 */}
                          {(stage.type === 'ai_auto' || stage.type === 'ai_with_confirm') && (
                            <div>
                              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                                {t('sop.promptTemplate')}
                              </label>
                              <textarea
                                value={stage.promptTemplate || ''}
                                onChange={(e) => handleUpdateStage(stage.id, { promptTemplate: e.target.value })}
                                placeholder={t('sop.promptTemplatePlaceholder')}
                                rows={4}
                                className="w-full px-3 py-2 rounded-lg border text-sm transition-colors resize-none font-mono"
                                style={{
                                  backgroundColor: 'var(--bg-primary)',
                                  borderColor: 'var(--border)',
                                  color: 'var(--text-primary)',
                                }}
                              />
                            </div>
                          )}

                          {/* render 阶段显示渲染模板选择器 */}
                          {stage.type === 'render' && (
                            <div>
                              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                                {t('studio.renderTemplate')}
                              </label>
                              <select
                                value={stage.renderTemplateId || ''}
                                onChange={(e) => handleUpdateStage(stage.id, { renderTemplateId: e.target.value || undefined })}
                                className="w-full px-3 py-2 rounded-lg border text-sm transition-colors"
                                style={{
                                  backgroundColor: 'var(--bg-primary)',
                                  borderColor: 'var(--border)',
                                  color: 'var(--text-primary)',
                                }}
                              >
                                <option value="">{t('studio.noTemplate')}</option>
                                {renderTemplates.map(tpl => (
                                  <option key={tpl.id} value={tpl.id}>{tpl.name}</option>
                                ))}
                              </select>
                              <p className="text-[10px] mt-1" style={{ color: 'var(--text-tertiary)' }}>
                                {t('studio.templateHint')}
                              </p>
                            </div>
                          )}
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                                {t('sop.outputType')}
                              </label>
                              <select
                                value={stage.outputType || 'text'}
                                onChange={(e) => handleUpdateStage(stage.id, { outputType: e.target.value as StageOutputType })}
                                className="w-full px-3 py-2 rounded-lg border text-sm transition-colors"
                                style={{
                                  backgroundColor: 'var(--bg-primary)',
                                  borderColor: 'var(--border)',
                                  color: 'var(--text-primary)',
                                }}
                              >
                                {outputTypeOptions.map(opt => (
                                  <option key={opt} value={opt}>{opt}</option>
                                ))}
                              </select>
                            </div>
                            
                            <div>
                              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                                {t('sop.outputLabel')}
                              </label>
                              <Input
                                value={stage.outputLabel || ''}
                                onChange={(e) => handleUpdateStage(stage.id, { outputLabel: e.target.value })}
                                placeholder="e.g., Analysis Result"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          
          {/* 质量检查项 */}
          <div>
            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
              {t('sop.qualityChecklist')} ({qualityChecklist.length})
            </h3>
            
            <div className="space-y-2 mb-3">
              {qualityChecklist.map((item, idx) => (
                <div 
                  key={idx}
                  className="flex items-center gap-2 p-2 rounded-lg"
                  style={{ backgroundColor: 'var(--bg-secondary)' }}
                >
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span className="flex-1 text-sm" style={{ color: 'var(--text-primary)' }}>{item}</span>
                  <button
                    onClick={() => handleDeleteCheckItem(idx)}
                    className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-950"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  </button>
                </div>
              ))}
            </div>
            
            <div className="flex items-center gap-2">
              <Input
                value={newCheckItem}
                onChange={(e) => setNewCheckItem(e.target.value)}
                placeholder={t('sop.addCheckItem')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCheckItem();
                  }
                }}
              />
              <Button variant="secondary" size="sm" onClick={handleAddCheckItem} disabled={!newCheckItem.trim()}>
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
        
        {/* 底部操作 */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t" style={{ borderColor: 'var(--border)' }}>
          <Button variant="secondary" onClick={onClose}>
            {t('sop.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={!isValid || saving}>
            {saving ? t('common.loading') : t('sop.save')}
          </Button>
        </div>
      </div>
    </div>
  );
}
