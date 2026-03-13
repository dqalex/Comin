'use client';

/**
 * SkillHub 详情页面
 * 
 * 路径: /skillhub/[id]
 * 
 * 功能:
 * - 查看技能详情
 * - 编辑技能信息（创建者/管理员）
 * - 提交审批/批准/拒绝
 * - 信任管理
 */

import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter, useParams } from 'next/navigation';
import AppShell from '@/components/AppShell';
import Header from '@/components/Header';
import { Button, Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { useSkillStore, useAuthStore, useSOPTemplateStore } from '@/store';
import { skillsApi } from '@/lib/data-service';
import type { Skill, SOPTemplate } from '@/db/schema';
import {
  ArrowLeft, Edit, Trash2, Send, Check, X, Shield, AlertTriangle,
  Clock, CheckCircle2, XCircle, FileText, BarChart3, Code, Settings,
  Zap, Calendar, User, Tag, Info, ClipboardList, ExternalLink,
} from 'lucide-react';
import clsx from 'clsx';

// 状态颜色映射
const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  pending_approval: 'bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400',
  active: 'bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400',
  rejected: 'bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400',
};

// 信任状态颜色映射
const TRUST_COLORS: Record<string, string> = {
  trusted: 'bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400',
  untrusted: 'bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400',
  pending: 'bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400',
};

export default function SkillDetailPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useParams();
  const skillId = params?.id as string;
  
  // Store
  const skills = useSkillStore((s) => s.skills);
  const deleteSkillAsync = useSkillStore((s) => s.deleteSkillAsync);
  const fetchSkills = useSkillStore((s) => s.fetchSkills);
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';
  
  // SOP 模板 Store
  const sopTemplates = useSOPTemplateStore((s) => s.templates);
  const fetchSOPTemplates = useSOPTemplateStore((s) => s.fetchTemplates);
  
  // 本地状态
  const [loading, setLoading] = useState(true);
  const [skill, setSkill] = useState<Skill | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  // 加载 SOP 模板数据（用于显示关联）
  useEffect(() => {
    if (sopTemplates.length === 0) {
      fetchSOPTemplates();
    }
  }, [sopTemplates.length, fetchSOPTemplates]);
  
  // 查找关联的 SOP 模板
  const linkedSOPTemplate = useMemo<SOPTemplate | null>(() => {
    if (!skill?.sopTemplateId) return null;
    return sopTemplates.find(t => t.id === skill.sopTemplateId) || null;
  }, [skill?.sopTemplateId, sopTemplates]);
  
  // 加载技能详情
  useEffect(() => {
    const loadSkill = async () => {
      if (!skillId) return;
      
      // 先从本地 store 查找
      const localSkill = skills.find(s => s.id === skillId);
      if (localSkill) {
        setSkill(localSkill);
        setLoading(false);
        return;
      }
      
      // 从 API 加载
      try {
        const { data, error } = await skillsApi.getById(skillId);
        if (data) {
          setSkill(data);
        } else {
          console.error('Failed to load skill:', error);
        }
      } catch (err) {
        console.error('Error loading skill:', err);
      } finally {
        setLoading(false);
      }
    };
    
    loadSkill();
  }, [skillId, skills]);
  
  // 权限判断
  const permissions = useMemo(() => {
    if (!skill || !user) return { canEdit: false, canApprove: false, canDelete: false, isCreator: false };
    
    const isCreator = skill.createdBy === user.id;
    
    return {
      canEdit: isCreator || isAdmin,
      canApprove: isAdmin,
      canDelete: (isCreator && ['draft', 'rejected'].includes(skill.status || '')) || isAdmin,
      isCreator,
    };
  }, [skill, user, isAdmin]);
  
  // 操作处理
  const handleSubmitApproval = async () => {
    if (!skill) return;
    setActionLoading('submit');
    try {
      const { error } = await skillsApi.submitForApproval(skill.id);
      if (error) {
        alert(error);
      } else {
        await fetchSkills();
        router.push('/skillhub');
      }
    } finally {
      setActionLoading(null);
    }
  };
  
  const handleApprove = async () => {
    if (!skill) return;
    setActionLoading('approve');
    try {
      const { error } = await skillsApi.approve(skill.id);
      if (error) {
        alert(error);
      } else {
        await fetchSkills();
        setSkill({ ...skill, status: 'active' });
      }
    } finally {
      setActionLoading(null);
    }
  };
  
  const handleReject = async () => {
    if (!skill) return;
    const note = prompt('拒绝原因：');
    setActionLoading('reject');
    try {
      const { error } = await skillsApi.reject(skill.id, note || undefined);
      if (error) {
        alert(error);
      } else {
        await fetchSkills();
        setSkill({ ...skill, status: 'rejected' });
      }
    } finally {
      setActionLoading(null);
    }
  };
  
  const handleTrust = async () => {
    if (!skill) return;
    setActionLoading('trust');
    try {
      const { error } = await skillsApi.trust(skill.id);
      if (error) {
        alert(error);
      } else {
        await fetchSkills();
        setSkill({ ...skill, trustStatus: 'trusted' });
      }
    } finally {
      setActionLoading(null);
    }
  };
  
  const handleDelete = async () => {
    if (!skill) return;
    if (!confirm(t('common.confirmDelete'))) return;
    
    setActionLoading('delete');
    try {
      const success = await deleteSkillAsync(skill.id);
      if (success) {
        router.push('/skillhub');
      }
    } finally {
      setActionLoading(null);
    }
  };
  
  // 格式化日期
  const formatDate = (date: Date | null | undefined) => {
    if (!date) return '-';
    return new Date(date).toLocaleString();
  };
  
  if (loading) {
    return (
      <AppShell>
        <Header title={t('skillhub.detail.title')} />
        <main className="flex-1 p-6 flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
        </main>
      </AppShell>
    );
  }
  
  if (!skill) {
    return (
      <AppShell>
        <Header title={t('skillhub.detail.title')} />
        <main className="flex-1 p-6">
          <Card>
            <CardContent className="p-12 text-center">
              <p style={{ color: 'var(--text-tertiary)' }}>{t('common.notFound')}</p>
              <Button onClick={() => router.push('/skillhub')} className="mt-4">
                {t('common.back')}
              </Button>
            </CardContent>
          </Card>
        </main>
      </AppShell>
    );
  }
  
  return (
    <AppShell>
      <Header 
        title={skill.name}
        actions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => router.push('/skillhub')}
              className="flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              {t('common.back')}
            </Button>
          </div>
        }
      />
      
      <main className="flex-1 p-6 overflow-auto max-w-4xl mx-auto">
        {/* 状态卡片 */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className={clsx(
                  'w-14 h-14 rounded-xl flex items-center justify-center',
                  skill.status === 'active' 
                    ? 'bg-primary-50 dark:bg-primary-950' 
                    : 'bg-slate-100 dark:bg-slate-800'
                )}>
                  <Zap className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {skill.name}
                  </h1>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className={clsx('text-xs', STATUS_COLORS[skill.status || 'draft'])}>
                      {t(`skillhub.status.${skill.status}`)}
                    </Badge>
                    <Badge className={clsx('text-xs', TRUST_COLORS[skill.trustStatus || 'pending'])}>
                      {t(`skillhub.trust.${skill.trustStatus}`)}
                    </Badge>
                    {skill.isSensitive && (
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                    )}
                  </div>
                </div>
              </div>
              
              {/* 操作按钮 */}
              <div className="flex items-center gap-2 flex-wrap">
                {skill.status === 'draft' && permissions.canEdit && (
                  <Button
                    size="sm"
                    onClick={handleSubmitApproval}
                    disabled={actionLoading !== null}
                    className="flex items-center gap-1.5"
                  >
                    {actionLoading === 'submit' ? (
                      <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    {t('skillhub.detail.submitApproval')}
                  </Button>
                )}
                
                {skill.status === 'pending_approval' && permissions.canApprove && (
                  <>
                    <Button
                      size="sm"
                      onClick={handleApprove}
                      disabled={actionLoading !== null}
                      className="flex items-center gap-1.5"
                    >
                      <Check className="w-4 h-4" />
                      {t('skillhub.detail.approve')}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={handleReject}
                      disabled={actionLoading !== null}
                      className="flex items-center gap-1.5"
                    >
                      <X className="w-4 h-4" />
                      {t('skillhub.detail.reject')}
                    </Button>
                  </>
                )}
                
                {skill.trustStatus !== 'trusted' && isAdmin && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleTrust}
                    disabled={actionLoading !== null}
                    className="flex items-center gap-1.5"
                  >
                    <Shield className="w-4 h-4" />
                    {t('skillhub.detail.trust')}
                  </Button>
                )}
                
                {permissions.canEdit && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => router.push(`/skillhub/${skill.id}/edit`)}
                    className="flex items-center gap-1.5"
                  >
                    <Edit className="w-4 h-4" />
                    {t('skillhub.detail.edit')}
                  </Button>
                )}
                
                {permissions.canDelete && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleDelete}
                    disabled={actionLoading !== null}
                    className="flex items-center gap-1.5 text-red-500 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                    {t('skillhub.detail.delete')}
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* 基本信息 */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="w-4 h-4" />
              {t('skillhub.detail.basicInfo')}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {t('skillhub.detail.skillKey')}
                </label>
                <p className="text-sm font-mono mt-1" style={{ color: 'var(--text-primary)' }}>
                  {skill.skillKey}
                </p>
              </div>
              <div>
                <label className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {t('skillhub.detail.version')}
                </label>
                <p className="text-sm mt-1" style={{ color: 'var(--text-primary)' }}>
                  v{skill.version}
                </p>
              </div>
              <div>
                <label className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {t('skillhub.detail.category')}
                </label>
                <p className="text-sm mt-1" style={{ color: 'var(--text-primary)' }}>
                  {t(`skillhub.category.${skill.category || 'custom'}`)}
                </p>
              </div>
              <div>
                <label className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {t('skillhub.detail.source')}
                </label>
                <p className="text-sm mt-1" style={{ color: 'var(--text-primary)' }}>
                  {skill.source}
                </p>
              </div>
              <div>
                <label className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {t('skillhub.detail.createdAt')}
                </label>
                <p className="text-sm mt-1" style={{ color: 'var(--text-primary)' }}>
                  {formatDate(skill.createdAt)}
                </p>
              </div>
              <div>
                <label className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {t('skillhub.detail.updatedAt')}
                </label>
                <p className="text-sm mt-1" style={{ color: 'var(--text-primary)' }}>
                  {formatDate(skill.updatedAt)}
                </p>
              </div>
            </div>
            
            {skill.description && (
              <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
                <label className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {t('skillhub.detail.description')}
                </label>
                <p className="text-sm mt-1" style={{ color: 'var(--text-primary)' }}>
                  {skill.description}
                </p>
              </div>
            )}
            
            {skill.isSensitive && skill.sensitivityNote && (
              <div className="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950">
                <div className="flex items-center gap-2 text-amber-600">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-xs font-medium">{t('skillhub.detail.sensitive')}</span>
                </div>
                <p className="text-xs mt-1 text-amber-700 dark:text-amber-400">
                  {skill.sensitivityNote}
                </p>
              </div>
            )}
            
            {/* SOP 模板关联 */}
            {skill.sopTemplateId && (
              <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
                <label className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {t('skillhub.detail.linkedSOP')}
                </label>
                <div className="mt-2 p-3 rounded-lg" style={{ background: 'var(--surface-secondary)' }}>
                  {linkedSOPTemplate ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ClipboardList className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
                        <div>
                          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                            {linkedSOPTemplate.name}
                          </p>
                          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                            v{linkedSOPTemplate.version || '1.0.0'}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => router.push(`/sop?select=${linkedSOPTemplate.id}`)}
                        className="flex items-center gap-1"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        {t('common.view')}
                      </Button>
                    </div>
                  ) : (
                    <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                      {t('skillhub.detail.sopNotFound')}
                    </p>
                  )}
                  
                  {/* SOP 更新可用提示 */}
                  {skill.sopUpdateAvailable && (
                    <div className="mt-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                      <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
                        <AlertTriangle className="w-4 h-4" />
                        <span className="text-xs font-medium">{t('skillhub.sopUpdateAvailable')}</span>
                      </div>
                      <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                        {t('skillhub.sopUpdateHint')}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </AppShell>
  );
}
