'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { initI18n } from '@/lib/i18n';
import { Button, Input } from '@/components/ui';
import clsx from 'clsx';
import { useGatewayStore } from '@/store';
import { Wifi, Server, Globe, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

type ConnectionMode = 'server_proxy' | 'browser_direct';
type ConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'error';

interface GatewayConfig {
  id: string;
  url: string;
  mode: ConnectionMode;
  status: ConnectionStatus;
}

export function GatewayConfigPanel() {
  const { t } = useTranslation();
  const [config, setConfig] = useState<GatewayConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // 表单状态
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [mode, setMode] = useState<ConnectionMode>('server_proxy');
  const [showToken, setShowToken] = useState(false);

  // 初始化 i18n
  useEffect(() => {
    initI18n();
  }, []);

  // 加载配置
  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/gateway/config');
      const data = await res.json();
      
      if (data.data) {
        setConfig(data.data);
        setUrl(data.data.url);
        setMode(data.data.mode);
      }
    } catch (e) {
      console.error('Failed to fetch gateway config:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  // 保存配置
  const handleSave = async () => {
    setError(null);
    setSuccess(null);

    if (!url) {
      setError('URL is required');
      return;
    }

    // 验证 URL 格式
    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.protocol !== 'ws:' && parsedUrl.protocol !== 'wss:') {
        setError('URL must use ws:// or wss:// protocol');
        return;
      }
    } catch {
      setError('Invalid URL format');
      return;
    }

    // 如果是新配置或修改了 token，要求输入 token
    if (!config && !token) {
      setError('Token is required for new configuration');
      return;
    }

    try {
      setSaving(true);
      const res = await fetch('/api/gateway/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, token: token || undefined, mode }),
      });

      const data = await res.json();

      if (data.error) {
        setError(data.error);
      } else {
        setSuccess('Gateway configuration saved');
        setToken(''); // 清除 token 显示
        await fetchConfig();
        // browser_direct 模式：保存后立即触发浏览器 WebSocket 连接
        if (mode === 'browser_direct' && data.data?.url) {
          const gwStore = useGatewayStore.getState();
          const connectToken = data.data.token || token;
          if (connectToken) {
            gwStore.connect(data.data.url, connectToken);
          }
        }
      }
    } catch (e) {
      setError('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  // 删除配置
  const handleDelete = async () => {
    if (!config) return;
    if (!confirm('Are you sure you want to delete this gateway configuration?')) return;

    try {
      const res = await fetch(`/api/gateway/config?id=${config.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (data.error) {
        setError(data.error);
      } else {
        setConfig(null);
        setUrl('');
        setToken('');
        setSuccess('Gateway configuration deleted');
      }
    } catch (e) {
      setError('Failed to delete configuration');
    }
  };

  // 获取状态显示
  const getStatusDisplay = () => {
    if (!config) return null;

    const statusConfig: Record<ConnectionStatus, { color: string; icon: typeof Wifi; text: string }> = {
      connected: { color: 'text-green-500', icon: CheckCircle2, text: 'Connected' },
      disconnected: { color: 'text-gray-400', icon: Wifi, text: 'Disconnected' },
      connecting: { color: 'text-yellow-500', icon: Loader2, text: 'Connecting...' },
      error: { color: 'text-red-500', icon: AlertCircle, text: 'Error' },
    };

    const { color, icon: Icon, text } = statusConfig[config.status] || statusConfig.disconnected;

    return (
      <div className={clsx('flex items-center gap-1.5 text-xs', color)}>
        <Icon className={clsx('w-3.5 h-3.5', config.status === 'connecting' && 'animate-spin')} />
        <span>{text}</span>
      </div>
    );
  };

  return (
    <div className="card p-4">
      {/* 标题 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Server className="w-4 h-4" style={{ color: 'var(--primary)' }} />
          <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
            Gateway 连接模式
          </span>
        </div>
        {getStatusDisplay()}
      </div>

      {/* 说明 */}
      <p className="text-xs mb-4" style={{ color: 'var(--text-tertiary)' }}>
        服务端代理模式：连接在服务端维护，浏览器关闭不影响任务执行。浏览器直连模式：连接在浏览器建立，适合实时聊天。
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--primary)' }} />
        </div>
      ) : (
        <>
          {/* 连接模式选择 */}
          <div className="mb-4">
            <label className="block text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>
              连接模式
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setMode('server_proxy')}
                className={clsx(
                  'flex-1 p-3 rounded-lg border text-xs transition-all',
                  mode === 'server_proxy'
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/30'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                )}
              >
                <Server className="w-4 h-4 mb-1 mx-auto" style={{ color: mode === 'server_proxy' ? 'var(--primary)' : 'var(--text-tertiary)' }} />
                <div style={{ color: mode === 'server_proxy' ? 'var(--primary)' : 'var(--text-primary)' }}>
                  服务端代理
                </div>
                <div className="text-[10px] mt-1" style={{ color: 'var(--text-tertiary)' }}>
                  推荐用于长时间任务
                </div>
              </button>
              <button
                onClick={() => setMode('browser_direct')}
                className={clsx(
                  'flex-1 p-3 rounded-lg border text-xs transition-all',
                  mode === 'browser_direct'
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/30'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                )}
              >
                <Globe className="w-4 h-4 mb-1 mx-auto" style={{ color: mode === 'browser_direct' ? 'var(--primary)' : 'var(--text-tertiary)' }} />
                <div style={{ color: mode === 'browser_direct' ? 'var(--primary)' : 'var(--text-primary)' }}>
                  浏览器直连
                </div>
                <div className="text-[10px] mt-1" style={{ color: 'var(--text-tertiary)' }}>
                  低延迟实时通信
                </div>
              </button>
            </div>
          </div>

          {/* Gateway URL */}
          <div className="mb-3">
            <label className="block text-xs mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Gateway URL
            </label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="ws://localhost:18789"
              className="text-xs"
            />
          </div>

          {/* Token */}
          <div className="mb-4">
            <label className="block text-xs mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Token {config && <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>(留空保持不变)</span>}
            </label>
            <div className="relative">
              <Input
                type={showToken ? 'text' : 'password'}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder={config ? '••••••••' : 'Enter token'}
                className="text-xs pr-16"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs px-2 py-0.5 rounded"
                style={{ color: 'var(--text-tertiary)' }}
              >
                {showToken ? '隐藏' : '显示'}
              </button>
            </div>
          </div>

          {/* 错误/成功提示 */}
          {error && (
            <div className="mb-3 p-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
              <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}
          {success && (
            <div className="mb-3 p-2 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
              <p className="text-xs text-green-600 dark:text-green-400">{success}</p>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              {config ? '更新配置' : '保存配置'}
            </Button>
            {config && (
              <Button size="sm" variant="secondary" onClick={handleDelete}>
                删除
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
