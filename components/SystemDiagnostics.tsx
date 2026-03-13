'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Database, 
  Server, 
  Settings, 
  Users,
  RefreshCw,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import clsx from 'clsx';

interface DiagnosticsData {
  status: string;
  diagnostics: {
    database?: {
      status: string;
      tables?: string[];
      tableCount?: number;
      error?: string;
    };
    tableStructure?: Record<string, {
      exists: boolean;
      columns?: string[];
      error?: string;
    }>;
    gateway?: {
      configCount?: number;
      configs?: any[];
      status?: string;
      error?: string;
    };
    environment?: Record<string, string>;
    members?: {
      count?: number;
      list?: any[];
      status?: string;
      error?: string;
    };
    workspaces?: {
      count?: number;
      list?: any[];
      status?: string;
      error?: string;
    };
    runtime?: {
      nodeVersion: string;
      platform: string;
      uptime: number;
      memoryUsage: {
        heapUsed: number;
        heapTotal: number;
        rss: number;
      };
      timestamp: string;
    };
  };
}

function StatusBadge({ status, error }: { status?: string; error?: string }) {
  if (error) {
    return (
      <Badge variant="danger" className="gap-1">
        <XCircle className="w-3 h-3" />
        错误
      </Badge>
    );
  }
  if (status === 'ok') {
    return (
      <Badge variant="default" className="gap-1 bg-green-500">
        <CheckCircle className="w-3 h-3" />
        正常
      </Badge>
    );
  }
  return (
    <Badge variant="default" className="gap-1">
      <AlertCircle className="w-3 h-3" />
      未知
    </Badge>
  );
}

function CollapsibleSection({ 
  title, 
  icon: Icon, 
  children, 
  defaultOpen = false 
}: { 
  title: string; 
  icon: any; 
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card>
      <CardHeader 
        className="cursor-pointer select-none" 
        onClick={() => setOpen(!open)}
      >
        <CardTitle className="flex items-center justify-between text-base">
          <div className="flex items-center gap-2">
            <Icon className="w-5 h-5" />
            {title}
          </div>
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </CardTitle>
      </CardHeader>
      {open && <CardContent className="pt-0">{children}</CardContent>}
    </Card>
  );
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts = [];
  if (days > 0) parts.push(`${days}天`);
  if (hours > 0) parts.push(`${hours}小时`);
  if (mins > 0) parts.push(`${mins}分钟`);
  parts.push(`${secs}秒`);

  return parts.join(' ');
}

export function SystemDiagnostics() {
  const [data, setData] = useState<DiagnosticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDiagnostics = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/debug');
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch diagnostics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiagnostics();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="w-6 h-6 animate-spin mr-2" />
        正在收集诊断信息...
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-destructive">
            <XCircle className="w-5 h-5" />
            获取诊断信息失败: {error}
          </div>
          <Button onClick={fetchDiagnostics} variant="secondary" className="mt-4">
            重试
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const { diagnostics } = data;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">系统诊断</h2>
        <Button onClick={fetchDiagnostics} variant="secondary" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          刷新
        </Button>
      </div>

      {/* 快速状态概览 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">数据库</span>
              <StatusBadge status={diagnostics.database?.status} error={diagnostics.database?.error} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Gateway</span>
              <StatusBadge 
                status={diagnostics.gateway?.configCount ? 'ok' : undefined} 
                error={diagnostics.gateway?.error} 
              />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">成员</span>
              <Badge variant="default">{diagnostics.members?.count || 0}</Badge>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">工作区</span>
              <Badge variant="default">{diagnostics.workspaces?.count || 0}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 详细信息 */}
      <CollapsibleSection title="数据库" icon={Database} defaultOpen>
        {diagnostics.database?.error ? (
          <div className="text-destructive">{diagnostics.database.error}</div>
        ) : (
          <div className="space-y-3">
            <div>
              <span className="text-sm text-muted-foreground">表数量:</span>{' '}
              <span className="font-mono">{diagnostics.database?.tableCount}</span>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-2">已创建的表:</div>
              <div className="flex flex-wrap gap-1">
                {diagnostics.database?.tables?.map(table => {
                  const isCritical = ['gateway_configs', 'audit_logs', 'members', 'tasks', 'documents'].includes(table);
                  return (
                    <Badge 
                      key={table} 
                      variant={isCritical ? 'primary' : 'default'}
                      className="text-xs"
                    >
                      {table}
                    </Badge>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </CollapsibleSection>

      <CollapsibleSection title="表结构检查" icon={Database}>
        <div className="space-y-2">
          {Object.entries(diagnostics.tableStructure || {}).map(([table, info]) => (
            <div key={table} className="flex items-center justify-between py-1 border-b last:border-0">
              <span className="font-mono text-sm">{table}</span>
              {info.exists ? (
                <Badge variant="default" className="bg-green-500 text-xs">
                  存在 ({info.columns?.length} 列)
                </Badge>
              ) : (
                <Badge variant="danger" className="text-xs">
                  不存在
                </Badge>
              )}
            </div>
          ))}
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Gateway 配置" icon={Server}>
        {diagnostics.gateway?.error ? (
          <div className="text-destructive">{diagnostics.gateway.error}</div>
        ) : diagnostics.gateway?.configCount === 0 ? (
          <div className="text-muted-foreground">暂无 Gateway 配置</div>
        ) : (
          <div className="space-y-2">
            {diagnostics.gateway?.configs?.map((config: any) => (
              <div key={config.id} className="p-3 bg-muted rounded-lg text-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{config.name}</span>
                  <Badge variant={config.status === 'connected' ? 'success' : 'default'}>
                    {config.status}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-muted-foreground">URL:</span> {config.url}</div>
                  <div><span className="text-muted-foreground">模式:</span> {config.mode}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CollapsibleSection>

      <CollapsibleSection title="环境变量" icon={Settings}>
        <div className="space-y-1 font-mono text-sm">
          {Object.entries(diagnostics.environment || {}).map(([key, value]) => (
            <div key={key} className="flex items-start gap-2 py-1">
              <span className="text-blue-500 dark:text-blue-400 min-w-[200px]">{key}</span>
              <span className={clsx(
                'break-all',
                value.includes('未设置') ? 'text-muted-foreground italic' : 'text-green-600 dark:text-green-400'
              )}>
                {value}
              </span>
            </div>
          ))}
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="成员" icon={Users}>
        {diagnostics.members?.error ? (
          <div className="text-destructive">{diagnostics.members.error}</div>
        ) : (
          <div className="space-y-2">
            {diagnostics.members?.list?.map((member: any) => (
              <div key={member.id} className="flex items-center justify-between py-1">
                <div>
                  <span className="font-medium">{member.name}</span>
                  <Badge variant="default" className="ml-2 text-xs">{member.type}</Badge>
                </div>
                <Badge variant={member.online ? 'success' : 'default'} className="text-xs">
                  {member.online ? '在线' : '离线'}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CollapsibleSection>

      <CollapsibleSection title="运行时信息" icon={Server} defaultOpen>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Node 版本:</span>{' '}
            <span className="font-mono">{diagnostics.runtime?.nodeVersion}</span>
          </div>
          <div>
            <span className="text-muted-foreground">平台:</span>{' '}
            <span className="font-mono">{diagnostics.runtime?.platform}</span>
          </div>
          <div>
            <span className="text-muted-foreground">运行时间:</span>{' '}
            <span className="font-mono">{formatUptime(diagnostics.runtime?.uptime || 0)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">内存:</span>{' '}
            <span className="font-mono">
              {diagnostics.runtime?.memoryUsage.heapUsed}MB / {diagnostics.runtime?.memoryUsage.heapTotal}MB
            </span>
          </div>
          <div className="col-span-2">
            <span className="text-muted-foreground">时间戳:</span>{' '}
            <span className="font-mono">{diagnostics.runtime?.timestamp}</span>
          </div>
        </div>
      </CollapsibleSection>
    </div>
  );
}
