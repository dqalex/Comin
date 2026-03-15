/**
 * 聊天流式响应集成测试
 * 测试任务推送后的流式回复功能
 *
 * 运行方式:
 *   npx vitest run tests/integration/chat-stream.test.ts
 *
 * 前提条件:
 *   1. Mock Gateway 运行在 ws://localhost:18789
 *   2. TeamClaw 开发服务器运行在 http://localhost:3000
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import WebSocket from 'ws';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import http from 'http';

// 测试配置
const MOCK_GATEWAY_PORT = 18789;
const DEV_SERVER_PORT = 3000;
const TEST_TIMEOUT = 30000;

// 检查服务是否就绪
async function waitForService(port: number, maxAttempts = 30): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`http://localhost:${port}/api/health`);
      if (response.ok) return true;
    } catch {
      // 服务尚未就绪
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  return false;
}

describe('Chat Stream Integration', () => {
  let mockGateway: ChildProcess | null = null;

  beforeAll(async () => {
    // 检查开发服务器
    const devServerReady = await waitForService(DEV_SERVER_PORT, 5);
    if (!devServerReady) {
      throw new Error(
        `Development server not running on port ${DEV_SERVER_PORT}. ` +
        'Please start it first: npm run dev'
      );
    }

    // 检查 Mock Gateway
    const mockGatewayReady = await waitForService(MOCK_GATEWAY_PORT, 5);
    if (!mockGatewayReady) {
      throw new Error(
        `Mock Gateway not running on port ${MOCK_GATEWAY_PORT}. ` +
        'Please start it first: npm run mock:gateway'
      );
    }
  }, 10000);

  it('should receive streaming response from Mock Gateway', async () => {
    const result = await new Promise<{
      success: boolean;
      deltas: number;
      final: boolean;
      error?: string;
    }>((resolve) => {
      const ws = new WebSocket(`ws://localhost:${MOCK_GATEWAY_PORT}`);
      const deltas: string[] = [];
      let finalReceived = false;

      const timeout = setTimeout(() => {
        ws.close();
        resolve({
          success: false,
          deltas: deltas.length,
          final: finalReceived,
          error: 'Test timeout',
        });
      }, TEST_TIMEOUT);

      ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'challenge' }));
      });

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());

          if (msg.type === 'challenge') {
            ws.send(JSON.stringify({
              type: 'connect',
              clientId: 'test-client',
              token: 'mock-token',
              role: 'operator',
            }));
            return;
          }

          if (msg.type === 'hello-ok') {
            ws.send(JSON.stringify({
              type: 'request',
              id: 'test-dm',
              action: 'agent.dm',
              params: {
                agentId: 'main',
                content: '请帮我分析这个任务',
              },
            }));
            return;
          }

          if (msg.event === 'gateway_chat_event') {
            const payload = msg.payload?.payload || msg.payload;
            if (!payload) return;

            if (payload.state === 'delta') {
              deltas.push(payload.content);
            } else if (payload.state === 'final') {
              finalReceived = true;
              clearTimeout(timeout);
              ws.close();
              resolve({
                success: deltas.length > 0 && finalReceived,
                deltas: deltas.length,
                final: finalReceived,
              });
            }
          }
        } catch (err) {
          console.error('Error parsing message:', err);
        }
      });

      ws.on('error', (err) => {
        clearTimeout(timeout);
        ws.close();
        resolve({
          success: false,
          deltas: deltas.length,
          final: finalReceived,
          error: err.message,
        });
      });

      ws.on('close', () => {
        clearTimeout(timeout);
        if (!finalReceived) {
          resolve({
            success: false,
            deltas: deltas.length,
            final: finalReceived,
            error: 'Connection closed unexpectedly',
          });
        }
      });
    });

    expect(result.error).toBeUndefined();
    expect(result.deltas).toBeGreaterThan(0);
    expect(result.final).toBe(true);
    expect(result.success).toBe(true);
  }, TEST_TIMEOUT);

  it('should maintain correct session key throughout conversation', async () => {
    const result = await new Promise<{
      success: boolean;
      sessionKey?: string;
      error?: string;
    }>((resolve) => {
      const ws = new WebSocket(`ws://localhost:${MOCK_GATEWAY_PORT}`);
      let sessionKey: string | null = null;
      let eventCount = 0;

      const timeout = setTimeout(() => {
        ws.close();
        resolve({
          success: false,
          error: 'Test timeout',
        });
      }, TEST_TIMEOUT);

      ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'challenge' }));
      });

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());

          if (msg.type === 'challenge') {
            ws.send(JSON.stringify({
              type: 'connect',
              clientId: 'test-client',
              token: 'mock-token',
              role: 'operator',
            }));
            return;
          }

          if (msg.type === 'hello-ok') {
            ws.send(JSON.stringify({
              type: 'request',
              id: 'test-session',
              action: 'agent.dm',
              params: {
                agentId: 'main',
                content: '测试会话一致性',
              },
            }));
            return;
          }

          if (msg.id === 'test-session' && msg.result?.sessionKey) {
            sessionKey = msg.result.sessionKey;
            return;
          }

          if (msg.event === 'gateway_chat_event') {
            const payload = msg.payload?.payload || msg.payload;
            if (!payload) return;

            eventCount++;

            // 验证所有事件的 sessionKey 一致
            if (payload.sessionKey !== sessionKey) {
              clearTimeout(timeout);
              ws.close();
              resolve({
                success: false,
                error: `Session key mismatch: expected ${sessionKey}, got ${payload.sessionKey}`,
              });
              return;
            }

            if (payload.state === 'final') {
              clearTimeout(timeout);
              ws.close();
              resolve({
                success: true,
                sessionKey,
              });
            }
          }
        } catch (err) {
          console.error('Error parsing message:', err);
        }
      });

      ws.on('error', (err) => {
        clearTimeout(timeout);
        ws.close();
        resolve({
          success: false,
          error: err.message,
        });
      });
    });

    expect(result.error).toBeUndefined();
    expect(result.success).toBe(true);
    expect(result.sessionKey).toBeDefined();
    expect(result.sessionKey).toMatch(/^agent:main:dm:/);
  }, TEST_TIMEOUT);
});
