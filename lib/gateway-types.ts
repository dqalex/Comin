/**
 * Gateway 共享类型定义
 * 
 * 由 gateway-client.ts / server-gateway-client.ts / gateway-proxy.ts 共同引用
 */

/** Gateway WebSocket 消息格式 */
export type GatewayMessage = {
  type: 'req' | 'res' | 'event';
  id?: string;
  method?: string;
  params?: Record<string, unknown>;
  ok?: boolean;
  payload?: unknown;
  error?: string | { code?: string; message?: string };
  event?: string;
};

/** Gateway 事件回调 */
export type GatewayEventHandler = (event: string, payload: unknown) => void;

/** agents.list 返回的 agent 列表条目 */
export interface AgentListEntry {
  id: string;
  name?: string;
  identity?: {
    name?: string;
    theme?: string;
    emoji?: string;
    avatar?: string;
    avatarUrl?: string;
  };
  isDefault?: boolean;
}
