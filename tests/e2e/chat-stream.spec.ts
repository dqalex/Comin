/**
 * Chat 流式响应 E2E 测试
 * 在真实浏览器环境中测试任务推送后的流式回复
 *
 * 前提条件:
 *   1. Mock Gateway 运行在 ws://localhost:18789
 *   2. TeamClaw 运行在 http://localhost:3000
 *
 * 运行:
 *   npx playwright test tests/e2e/chat-stream.spec.ts --headed
 */

import { test, expect, Page } from '@playwright/test';

// 测试配置
const CONFIG = {
  baseURL: 'http://localhost:3000',
  mockGatewayURL: 'ws://localhost:18789',
  timeout: 60000,
};

test.describe('Chat Stream E2E', () => {
  test.beforeEach(async ({ page }) => {
    // 导航到测试工具页面
    await page.goto(`${CONFIG.baseURL}/test-task-push.html`);
    await page.waitForLoadState('networkidle');
  });

  test('should connect to Mock Gateway and receive streaming response', async ({ page }) => {
    // 1. 点击连接按钮
    await page.click('button:has-text("连接 Mock Gateway")');

    // 2. 等待连接成功
    await expect(page.locator('#connectionText')).toHaveText('已连接', { timeout: 10000 });

    // 3. 输入测试消息
    await page.fill('#chatMessage', '请帮我分析这个测试任务');

    // 4. 清除输出区域
    await page.click('button:has-text("清除输出")');

    // 5. 发送 DM 消息
    await page.click('button:has-text("发送 DM 消息")');

    // 6. 等待流式响应开始（输出区域不为空）
    const output = page.locator('#streamingOutput');
    await expect(output).not.toHaveText('等待消息...', { timeout: 5000 });

    // 7. 等待流式响应完成（边框变绿或包含完整文本）
    await expect(output).toContainText('任务分析完成', { timeout: 30000 });

    // 8. 验证日志中有 delta 和 final 事件
    const log = page.locator('#log');
    await expect(log).toContainText('[delta]');
    await expect(log).toContainText('[final]');
  });

  test('should maintain session consistency across multiple messages', async ({ page }) => {
    // 1. 连接 Gateway
    await page.click('button:has-text("连接 Mock Gateway")');
    await expect(page.locator('#connectionText')).toHaveText('已连接', { timeout: 10000 });

    // 2. 发送第一条消息
    await page.fill('#chatMessage', '第一条测试消息');
    await page.click('button:has-text("发送 DM 消息")');

    // 3. 等待第一条响应完成
    const output1 = page.locator('#streamingOutput');
    await expect(output1).toContainText('任务分析完成', { timeout: 30000 });

    // 4. 记录第一条 sessionKey（从日志中提取）
    const log1 = await page.locator('#log').textContent();
    const sessionMatch1 = log1?.match(/sessionKey:\s*(agent:[^\s]+)/);
    expect(sessionMatch1).toBeTruthy();
    const sessionKey1 = sessionMatch1?.[1];

    // 5. 清除输出，发送第二条消息
    await page.click('button:has-text("清除输出")');
    await page.fill('#chatMessage', '第二条测试消息');
    await page.click('button:has-text("发送 DM 消息")');

    // 6. 等待第二条响应完成
    await expect(output1).toContainText('任务分析完成', { timeout: 30000 });

    // 7. 验证第二条有不同的 sessionKey
    const log2 = await page.locator('#log').textContent();
    const sessionMatch2 = log2?.match(/sessionKey:\s*(agent:[^\s]+)/g);
    expect(sessionMatch2?.length).toBeGreaterThanOrEqual(2); // 至少两个不同的 session
  });

  test('should handle rapid consecutive messages', async ({ page }) => {
    // 1. 连接 Gateway
    await page.click('button:has-text("连接 Mock Gateway")');
    await expect(page.locator('#connectionText')).toHaveText('已连接', { timeout: 10000 });

    // 2. 快速发送多条消息
    const messages = ['消息1', '消息2', '消息3'];

    for (const msg of messages) {
      await page.fill('#chatMessage', msg);
      await page.click('button:has-text("发送 DM 消息")');
      await sleep(500); // 短暂间隔
    }

    // 3. 验证所有消息都有响应
    const log = await page.locator('#log').textContent();
    const finalCount = (log?.match(/\[final\]/g) || []).length;
    expect(finalCount).toBeGreaterThanOrEqual(3);
  });

  test('should display streaming content in real-time', async ({ page }) => {
    // 1. 连接 Gateway
    await page.click('button:has-text("连接 Mock Gateway")');
    await expect(page.locator('#connectionText')).toHaveText('已连接', { timeout: 10000 });

    // 2. 清除输出
    await page.click('button:has-text("清除输出")');

    // 3. 发送消息
    await page.fill('#chatMessage', '测试实时流式显示');
    await page.click('button:has-text("发送 DM 消息")');

    // 4. 监控输出内容的变化
    const output = page.locator('#streamingOutput');
    let lastContent = '';
    let changeCount = 0;

    // 在 5 秒内监控内容变化
    const startTime = Date.now();
    while (Date.now() - startTime < 5000) {
      const currentContent = await output.textContent() || '';
      if (currentContent !== lastContent && currentContent !== '等待消息...') {
        changeCount++;
        lastContent = currentContent;
      }
      await sleep(100);
    }

    // 5. 验证内容有多次更新（流式效果）
    expect(changeCount).toBeGreaterThan(3);

    // 6. 最终验证完整内容
    await expect(output).toContainText('任务分析完成', { timeout: 30000 });
  });
});

// 辅助函数
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
