'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input, Select, Card } from '@/components/ui';
import { X, Users, Plus, Trash2, Crown, Shield, User, Eye } from 'lucide-react';
import clsx from 'clsx';

interface ProjectMember {
  id: string;
  userId: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  userName: string | null;
  userEmail: string | null;
  userAvatar: string | null;
  createdAt: Date | null;
}

interface ProjectMemberDialogProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
}

const roleIcons: Record<string, React.ReactNode> = {
  owner: <Crown className="w-3.5 h-3.5 text-amber-500" />,
  admin: <Shield className="w-3.5 h-3.5 text-blue-500" />,
  member: <User className="w-3.5 h-3.5 text-slate-500" />,
  viewer: <Eye className="w-3.5 h-3.5 text-slate-400" />,
};

export function ProjectMemberDialog({ projectId, isOpen, onClose }: ProjectMemberDialogProps) {
  const { t } = useTranslation();
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<{ id: string; name: string; email: string }[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState<'admin' | 'member' | 'viewer'>('member');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchMembers();
      fetchUsers();
    }
  }, [isOpen, projectId]);

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/members`);
      if (res.ok) {
        const data = await res.json();
        setMembers(data);
      }
    } catch (err) {
      console.error('Failed to fetch members:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        // API 返回 { data: [...], total, page, limit } 格式
        const userList = Array.isArray(data) ? data : (data.data || []);
        setUsers(userList);
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  };

  const handleAddMember = async () => {
    if (!selectedUserId) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUserId, role: selectedRole }),
      });
      
      if (res.ok) {
        fetchMembers();
        setSelectedUserId('');
        setSelectedRole('member');
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to add member');
      }
    } catch (err) {
      console.error('Failed to add member:', err);
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveMember = async (memberId: string, role: string) => {
    if (role === 'owner') {
      alert('Cannot remove project owner');
      return;
    }
    
    if (!confirm(t('projects.removeMemberConfirm'))) return;
    
    try {
      const res = await fetch(`/api/projects/${projectId}/members/${memberId}`, {
        method: 'DELETE',
      });
      
      if (res.ok) {
        fetchMembers();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to remove member');
      }
    } catch (err) {
      console.error('Failed to remove member:', err);
    }
  };

  if (!isOpen) return null;

  const availableUsers = users.filter(
    u => !members.some(m => m.userId === u.id)
  );

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
      <Card className="w-[480px] max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
            <h3 className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
              {t('projects.manageMembers')}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5"
          >
            <X className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
          </button>
        </div>

        {/* Add member form */}
        <div className="px-5 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="flex gap-2">
            <Select
              value={selectedUserId}
              onChange={e => setSelectedUserId(e.target.value)}
              className="flex-1 text-sm"
            >
              <option value="">{t('projects.selectUser')}</option>
              {availableUsers.map(u => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email})
                </option>
              ))}
            </Select>
            <Select
              value={selectedRole}
              onChange={e => setSelectedRole(e.target.value as 'admin' | 'member' | 'viewer')}
              className="w-28 text-sm"
            >
              <option value="admin">{t('projects.roleAdmin')}</option>
              <option value="member">{t('projects.roleMember')}</option>
              <option value="viewer">{t('projects.roleViewer')}</option>
            </Select>
            <Button
              size="sm"
              onClick={handleAddMember}
              disabled={!selectedUserId || adding}
            >
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Member list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="px-5 py-8 text-center text-sm" style={{ color: 'var(--text-tertiary)' }}>
              {t('common.loading')}
            </div>
          ) : members.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm" style={{ color: 'var(--text-tertiary)' }}>
              {t('projects.noMembers')}
            </div>
          ) : (
            <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {members.map(member => (
                <li
                  key={member.id}
                  className="px-5 py-3 flex items-center gap-3 hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium"
                    style={{ background: 'var(--surface-hover)', color: 'var(--text-secondary)' }}
                  >
                    {member.userName?.charAt(0).toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                        {member.userName || t('common.unnamed')}
                      </span>
                      <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded" 
                        style={{ 
                          background: member.role === 'owner' ? 'rgba(245,158,11,0.1)' : 
                                     member.role === 'admin' ? 'rgba(59,130,246,0.1)' : 
                                     'var(--surface-hover)',
                          color: member.role === 'owner' ? '#f59e0b' : 
                                 member.role === 'admin' ? '#3b82f6' : 
                                 'var(--text-secondary)'
                        }}>
                        {roleIcons[member.role]}
                        {t(`projects.role${member.role.charAt(0).toUpperCase() + member.role.slice(1)}`)}
                      </span>
                    </div>
                    <p className="text-xs truncate" style={{ color: 'var(--text-tertiary)' }}>
                      {member.userEmail}
                    </p>
                  </div>
                  {member.role !== 'owner' && (
                    <button
                      onClick={() => handleRemoveMember(member.id, member.role)}
                      className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 opacity-0 hover:opacity-100 transition-opacity"
                      title={t('common.delete')}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}
