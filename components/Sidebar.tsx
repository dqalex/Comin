'use client';

import { useState, useMemo, useRef, memo, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useProjectStore, useUIStore, useTaskStore, useDocumentStore, useMemberStore, useOpenClawStatusStore } from '@/store';
import {
  LayoutDashboard, 
  FolderKanban, 
  FileText, 
  Users, 
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Folder,
  Plus,
  CheckSquare,
  File,
  MoreVertical,
  Trash2,
  Edit2,
  Send,
  Bot,
  Cpu,
  Clock,
  ClipboardList,
} from 'lucide-react';
import { CoMindLogo } from '@/components/Logo';
import clsx from 'clsx';
import { Input, Card, Button } from '@/components/ui';

export default function Sidebar() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const router = useRouter();
  const { sidebarOpen, toggleSidebar, hydrated, expandedProjects, toggleProjectExpand, expandProject } = useUIStore();
  const { projects, currentProjectId, setCurrentProject, createProject, updateProjectAsync, deleteProjectAsync } = useProjectStore();
  const { tasks } = useTaskStore();
  const { fetchDocuments, documents } = useDocumentStore();
  const { getAIMembers, members } = useMemberStore();
  const { statusList, getByMemberId } = useOpenClawStatusStore();
  
  const [showNewProjectInput, setShowNewProjectInput] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [showProjectMenu, setShowProjectMenu] = useState<string | null>(null);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingProjectName, setEditingProjectName] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const projectRenameByEnterRef = useRef(false);

  // 动态生成导航项
  const mainNavItems = useMemo(() => [
    { href: '/dashboard', label: t('nav.dashboard'), icon: LayoutDashboard },
    { href: '/tasks', label: t('nav.tasks'), icon: CheckSquare },
    { href: '/wiki', label: t('nav.wiki'), icon: FileText, clearProject: true },
    { href: '/sop', label: t('nav.sop'), icon: ClipboardList },
    { href: '/agents', label: t('nav.agents'), icon: Cpu },
    { href: '/schedule', label: t('nav.scheduler'), icon: Clock },
    { href: '/deliveries', label: t('nav.deliveries'), icon: Send },
    { href: '/members', label: t('nav.members'), icon: Users },
    { href: '/settings', label: t('nav.settings'), icon: Settings },
  ], [t]);

  const isOpen = hydrated ? sidebarOpen : true;
  const aiMembers = useMemo(() => getAIMembers(), [members]);

  const projectCounts = useMemo(() => {
    const taskCounts = new Map<string, number>();
    for (const t of tasks) {
      if (t.projectId) taskCounts.set(t.projectId, (taskCounts.get(t.projectId) || 0) + 1);
      if (Array.isArray(t.crossProjects)) for (const pid of t.crossProjects) taskCounts.set(pid, (taskCounts.get(pid) || 0) + 1);
    }
    const docCounts = new Map<string, number>();
    for (const d of documents) {
      if (d.projectId) docCounts.set(d.projectId, (docCounts.get(d.projectId) || 0) + 1);
      if (Array.isArray(d.projectTags)) {
        for (const tag of d.projectTags) {
          docCounts.set(tag, (docCounts.get(tag) || 0) + 1);
        }
      }
    }
    const counts: Record<string, { tasks: number; docs: number }> = {};
    for (const p of projects) {
      const docsByName = docCounts.get(p.name) || 0;
      const docsById = docCounts.get(p.id) || 0;
      counts[p.id] = {
        tasks: taskCounts.get(p.id) || 0,
        docs: Math.max(docsById, docsByName),
      };
    }
    return counts;
  }, [projects, tasks, documents]);

  const handleCreateProject = useCallback(async () => {
    if (!newProjectName.trim()) return;
    const project = await createProject({ name: newProjectName.trim() });
    if (project) {
      setCurrentProject(project.id);
      expandProject(project.id);
    }
    setNewProjectName('');
    setShowNewProjectInput(false);
  }, [newProjectName, createProject, setCurrentProject, expandProject]);

  const handleProjectClick = (projectId: string) => {
    setCurrentProject(projectId);
    expandProject(projectId);
    router.push('/tasks');
  };

  const isNavItemActive = (href: string) => {
    if (href === '/tasks') {
      return (pathname === '/tasks' || pathname.startsWith('/tasks/')) && !currentProjectId;
    }
    if (href === '/wiki') {
      return pathname === '/wiki' && !currentProjectId;
    }
    return pathname === href;
  };

  const isProjectSubItemActive = (projectId: string, type: 'tasks' | 'wiki') => {
    if (currentProjectId !== projectId) return false;
    if (type === 'tasks') return pathname === '/tasks' || pathname.startsWith('/tasks/');
    return pathname === '/wiki';
  };

  const aiStatus = useMemo(() => {
    const working = aiMembers.filter(m => {
      const s = getByMemberId(m.id);
      return s?.status === 'working';
    });
    return { working: working.length, total: aiMembers.length };
  }, [aiMembers, statusList, getByMemberId]);

  const NavItem = ({ item }: { item: typeof mainNavItems[0] }) => {
    const Icon = item.icon;
    const isActive = isNavItemActive(item.href);
    
    const content = (
      <>
        <div className={clsx(
          'flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-200',
          isActive
            ? 'bg-primary-500/10 dark:bg-primary-400/10'
            : 'group-hover:bg-slate-100 dark:group-hover:bg-white/5'
        )}>
          <Icon className={clsx(
            'w-[18px] h-[18px] transition-colors duration-200',
            isActive ? 'text-primary-600 dark:text-primary-400' : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300'
          )} />
        </div>
        {isOpen && (
          <span className={clsx(
            'text-[13px] transition-colors duration-200',
            isActive
              ? 'font-semibold text-primary-700 dark:text-primary-300'
              : 'font-medium text-slate-500 group-hover:text-slate-700 dark:text-slate-400 dark:group-hover:text-slate-200'
          )}>
            {item.label}
          </span>
        )}
        {isActive && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-primary-500 dark:bg-primary-400" />
        )}
      </>
    );

    const className = clsx(
      'group relative flex items-center gap-2.5 px-3 py-1.5 rounded-xl transition-all duration-200',
      isOpen ? 'w-full' : 'justify-center',
      isActive
        ? 'bg-primary-50/80 dark:bg-primary-500/[0.08]'
        : 'hover:bg-slate-50 dark:hover:bg-white/[0.03]'
    );

    if (item.href === '/tasks' || item.href === '/wiki') {
      return (
        <li>
          <button
            onClick={() => {
              if (item.href === '/tasks' || item.clearProject) setCurrentProject(null);
              router.push(item.href);
            }}
            className={className}
            title={!isOpen ? item.label : undefined}
          >
            {content}
          </button>
        </li>
      );
    }

    return (
      <li>
        <Link href={item.href} className={className} title={!isOpen ? item.label : undefined}>
          {content}
        </Link>
      </li>
    );
  };

  // ===== 收起态 =====
  if (!isOpen) {
    return (
      <div className="fixed left-0 top-0 h-full w-[60px] flex flex-col items-center z-10 border-r" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="flex flex-col items-center py-4 gap-3 border-b w-full" style={{ borderColor: 'var(--border)' }}>
          <Link href="/dashboard">
            <CoMindLogo className="w-7 h-7" />
          </Link>
          <button
            onClick={toggleSidebar}
            className="p-1.5 rounded-xl transition-all duration-200 hover:bg-slate-100 dark:hover:bg-white/5"
            style={{ color: 'var(--text-tertiary)' }}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        
        <nav className="flex-1 flex flex-col items-center py-3 gap-0.5 overflow-y-auto w-full px-2">
          <ul className="space-y-0.5 w-full">
            {mainNavItems.map((item) => (
              <NavItem key={item.href} item={item} />
            ))}
          </ul>
          
          <div className="w-8 h-px my-3" style={{ background: 'var(--border)' }} />
          
          {projects.slice(0, 5).map((project) => (
            <button
              key={project.id}
              onClick={() => handleProjectClick(project.id)}
              className={clsx(
                'w-full flex items-center justify-center p-2 rounded-xl transition-all duration-200',
                currentProjectId === project.id
                  ? 'bg-primary-50/80 dark:bg-primary-500/[0.08]'
                  : 'hover:bg-slate-50 dark:hover:bg-white/[0.03]'
              )}
              title={project.name}
            >
              <Folder className={clsx(
                'w-[18px] h-[18px]',
                currentProjectId === project.id ? 'text-primary-500' : 'text-slate-400'
              )} />
            </button>
          ))}
        </nav>

        {aiMembers.length > 0 && (
          <div className="py-3 border-t w-full flex justify-center" style={{ borderColor: 'var(--border)' }}>
            <div className={clsx(
              'w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300',
              aiStatus.working > 0 ? 'bg-cyan-50 dark:bg-cyan-500/10' : 'bg-slate-50 dark:bg-white/5'
            )}>
              <Bot className={clsx(
                'w-4 h-4',
                aiStatus.working > 0 ? 'text-cyan-500 animate-breathe' : 'text-slate-400'
              )} />
            </div>
          </div>
        )}
      </div>
    );
  }

  // ===== 展开态 =====
  return (
    <div className="fixed left-0 top-0 h-full w-[248px] lg:w-[264px] flex flex-col z-10 border-r" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      {/* Logo */}
      <div className="px-5 py-5 flex items-center justify-between border-b" style={{ borderColor: 'var(--border)' }}>
        <Link href="/dashboard" className="flex items-center gap-3 group">
          <div className="w-8 h-8 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
            <CoMindLogo className="w-8 h-8" />
          </div>
          <span className="font-display text-base font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-600">
            CoMind
          </span>
        </Link>
        <button
          onClick={toggleSidebar}
          className="p-1.5 rounded-xl transition-all duration-200 hover:bg-slate-100 dark:hover:bg-white/5"
          style={{ color: 'var(--text-tertiary)' }}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* AI 在线状态快览 */}
      {aiMembers.length > 0 && (
        <div className={clsx(
          'mx-3 mt-3 mb-1 px-3 py-2.5 rounded-xl transition-all duration-300',
          aiStatus.working > 0 ? 'bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-cyan-500/[0.06] dark:to-blue-500/[0.04]' : ''
        )} style={{ background: aiStatus.working > 0 ? undefined : 'var(--surface-hover)' }}>
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <Bot className={clsx(
                'w-4 h-4 transition-colors',
                aiStatus.working > 0 ? 'text-cyan-500' : 'text-slate-400'
              )} />
              {aiStatus.working > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-cyan-400 rounded-full animate-breathe" />
              )}
            </div>
            <span className={clsx(
              'text-xs font-semibold',
              aiStatus.working > 0 ? 'text-cyan-600 dark:text-cyan-400' : ''
            )} style={{ color: aiStatus.working > 0 ? undefined : 'var(--text-tertiary)' }}>
              {aiStatus.working > 0
                ? t('members.workingCount', { count: aiStatus.working })
                : t('members.idleCount', { count: aiStatus.total })
              }
            </span>
          </div>
        </div>
      )}

      {/* 导航 */}
      <nav className="flex-1 overflow-y-auto px-3 py-3">
        <ul className="space-y-0.5">
          {mainNavItems.map((item) => (
            <NavItem key={item.href} item={item} />
          ))}
        </ul>

        {/* 项目分隔 */}
        <div className="mt-6 mb-2.5 px-3 flex items-center justify-between">
          <span className="section-title">{t('nav.projects')}</span>
          <button
            onClick={() => setShowNewProjectInput(true)}
            className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-all duration-200"
            style={{ color: 'var(--text-tertiary)' }}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {showNewProjectInput && (
          <div className="px-2.5 mb-2">
            <Input
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateProject();
                if (e.key === 'Escape') { setShowNewProjectInput(false); setNewProjectName(''); }
              }}
              onBlur={() => { if (!newProjectName.trim()) setShowNewProjectInput(false); }}
              placeholder={t('projects.newProject') + '...'}
              className="text-[13px] !py-2"
              autoFocus
            />
          </div>
        )}

        <ul className="space-y-0.5">
          {projects.map((project) => {
            const isExpanded = expandedProjects.includes(project.id);
            const isActive = currentProjectId === project.id;
            const taskCount = projectCounts[project.id]?.tasks ?? 0;
            const docCount = projectCounts[project.id]?.docs ?? 0;
            
            return (
              <li key={project.id}>
                <div className="relative">
                  <div
                    className={clsx(
                      'w-full flex items-center gap-1.5 px-2.5 py-[7px] rounded-xl transition-all duration-200 text-[13px] group cursor-pointer',
                      isActive
                        ? 'bg-slate-100/80 dark:bg-white/[0.04]'
                        : 'hover:bg-slate-50 dark:hover:bg-white/[0.02]'
                    )}
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <button
                      onClick={() => toggleProjectExpand(project.id)}
                      className="p-0.5 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
                    >
                      <ChevronDown className={clsx(
                        'w-3 h-3 transition-transform duration-200',
                        !isExpanded && '-rotate-90'
                      )} style={{ color: 'var(--text-tertiary)' }} />
                    </button>
                    <div
                      className="flex-1 flex items-center gap-1.5 min-w-0"
                      onClick={() => handleProjectClick(project.id)}
                    >
                      <Folder className={clsx(
                        'w-3.5 h-3.5 flex-shrink-0 transition-colors',
                        isActive ? 'text-primary-500' : ''
                      )} style={{ color: isActive ? undefined : 'var(--text-tertiary)' }} />
                      <span className={clsx('flex-1 text-left truncate', isActive && 'font-semibold')} style={{ color: isActive ? 'var(--text-primary)' : undefined }}>
                        {project.name}
                      </span>
                    </div>
                    <button
                      onClick={() => setShowProjectMenu(showProjectMenu === project.id ? null : project.id)}
                      className="p-0.5 opacity-0 group-hover:opacity-100 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 transition-all duration-200"
                    >
                      <MoreVertical className="w-3 h-3" style={{ color: 'var(--text-tertiary)' }} />
                    </button>
                  </div>

                  {showProjectMenu === project.id && (
                    <div className="absolute right-2 top-full mt-1 w-32 rounded-xl shadow-float border z-20 py-1" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                      <button
                        onClick={() => {
                          setEditingProjectId(project.id);
                          setEditingProjectName(project.name);
                          setShowProjectMenu(null);
                        }}
                        className="w-full px-3 py-2 text-left text-xs hover:bg-slate-50 dark:hover:bg-white/5 flex items-center gap-2 rounded-lg mx-0 transition-colors"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        <Edit2 className="w-3 h-3" /> {t('common.edit')}
                      </button>
                      <button
                        onClick={() => { setShowDeleteConfirm(project.id); setShowProjectMenu(null); }}
                        className="w-full px-3 py-2 text-left text-xs hover:bg-red-50 dark:hover:bg-red-500/10 text-red-500 flex items-center gap-2 rounded-lg mx-0 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" /> {t('common.delete')}
                      </button>
                    </div>
                  )}

                  {editingProjectId === project.id && (
                    <div className="absolute inset-0 flex items-center px-2.5 gap-1 z-10 rounded-xl" style={{ background: 'var(--surface)' }}>
                      <Input
                        value={editingProjectName}
                        onChange={(e) => setEditingProjectName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && editingProjectName.trim()) {
                            projectRenameByEnterRef.current = true;
                            updateProjectAsync(project.id, { name: editingProjectName.trim() });
                            setEditingProjectId(null);
                          }
                          if (e.key === 'Escape') {
                            projectRenameByEnterRef.current = true;
                            setEditingProjectId(null);
                          }
                        }}
                        onBlur={() => {
                          if (!projectRenameByEnterRef.current && editingProjectName.trim()) {
                            updateProjectAsync(project.id, { name: editingProjectName.trim() });
                          }
                          projectRenameByEnterRef.current = false;
                          setEditingProjectId(null);
                        }}
                        className="text-[13px] !py-1"
                        autoFocus
                      />
                    </div>
                  )}
                </div>

                {isExpanded && (
                  <ul className="ml-6 mt-0.5 space-y-0.5">
                    <li>
                      <Link
                        href="/tasks"
                        onClick={() => setCurrentProject(project.id)}
                        className={clsx(
                          'flex items-center gap-2 px-2.5 py-1.5 rounded-xl transition-all duration-200 text-[13px]',
                          isProjectSubItemActive(project.id, 'tasks')
                            ? 'text-primary-600 dark:text-primary-400 font-semibold bg-primary-50/50 dark:bg-primary-500/[0.06]'
                            : 'hover:bg-slate-50 dark:hover:bg-white/[0.02]'
                        )}
                        style={{ color: isProjectSubItemActive(project.id, 'tasks') ? undefined : 'var(--text-tertiary)' }}
                      >
                        <CheckSquare className="w-3 h-3" />
                        <span>{t('nav.tasks')}</span>
                        <span className="text-[11px] ml-auto font-medium tabular-nums" style={{ color: 'var(--text-tertiary)' }}>{taskCount}</span>
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/wiki"
                        onClick={() => setCurrentProject(project.id)}
                        className={clsx(
                          'flex items-center gap-2 px-2.5 py-1.5 rounded-xl transition-all duration-200 text-[13px]',
                          isProjectSubItemActive(project.id, 'wiki')
                            ? 'text-primary-600 dark:text-primary-400 font-semibold bg-primary-50/50 dark:bg-primary-500/[0.06]'
                            : 'hover:bg-slate-50 dark:hover:bg-white/[0.02]'
                        )}
                        style={{ color: isProjectSubItemActive(project.id, 'wiki') ? undefined : 'var(--text-tertiary)' }}
                      >
                        <File className="w-3 h-3" />
                        <span>{t('nav.wiki')}</span>
                        <span className="text-[11px] ml-auto font-medium tabular-nums" style={{ color: 'var(--text-tertiary)' }}>{docCount}</span>
                      </Link>
                    </li>
                  </ul>
                )}
              </li>
            );
          })}

          {projects.length === 0 && !showNewProjectInput && (
            <li className="px-3 py-8 text-center">
              <div className="w-10 h-10 rounded-2xl bg-slate-50 dark:bg-white/5 flex items-center justify-center mx-auto mb-3">
                <Folder className="w-5 h-5 text-slate-300 dark:text-slate-600" />
              </div>
              <p className="text-xs mb-3" style={{ color: 'var(--text-tertiary)' }}>{t('projects.noProjects')}</p>
              <button
                onClick={() => setShowNewProjectInput(true)}
                className="text-xs text-primary-500 hover:text-primary-600 font-semibold transition-colors"
              >
                + {t('projects.newProject')}
              </button>
            </li>
          )}
        </ul>
      </nav>

      {/* 底部 */}
      <div className="px-5 py-3 border-t" style={{ borderColor: 'var(--border)' }}>
        <div className="text-[11px] font-semibold tabular-nums" style={{ color: 'var(--text-tertiary)' }}>
          CoMind v{process.env.NEXT_PUBLIC_APP_VERSION || '2.2.0'}
        </div>
      </div>

      {/* 删除确认 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center z-50" role="dialog" aria-modal="true" aria-labelledby="delete-project-title" aria-describedby="delete-project-desc">
          <Card className="p-6 w-80 shadow-xl animate-fadeIn">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-11 h-11 rounded-2xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h3 id="delete-project-title" className="font-display font-bold text-[15px]" style={{ color: 'var(--text-primary)' }}>{t('common.confirm')}</h3>
                <p id="delete-project-desc" className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{t('common.delete')} - {t('projects.title')}</p>
              </div>
            </div>
            <div className="flex justify-end gap-2.5">
              <Button variant="secondary" onClick={() => setShowDeleteConfirm(null)}>{t('common.cancel')}</Button>
              <Button
                variant="danger"
                onClick={async () => {
                  await deleteProjectAsync(showDeleteConfirm);
                  if (currentProjectId === showDeleteConfirm) setCurrentProject(null);
                  setShowDeleteConfirm(null);
                  fetchDocuments();
                }}
              >
                {t('common.delete')}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
