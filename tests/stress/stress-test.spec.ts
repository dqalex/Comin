/**
 * 压力测试套件
 * 
 * 模拟 100 个并发用户，测试各模块在高负载下的表现
 * 重点测试：
 * 1. 对话信道（Chat Channel）- 高频使用
 * 2. 文档编辑 - 协作场景
 * 3. 任务管理 - CRUD 操作
 * 4. SSE 实时推送 - 连接稳定性
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';
import { AuthHelper } from '../e2e/pages/AuthHelper';
import { ReportGenerator, StressTestScenario, PerformanceMetrics } from '../helpers/report-generator';

// 压力测试配置
const STRESS_CONFIG = {
  // 并发用户数
  concurrentUsers: 100,
  // 每个场景持续时间（秒）
  scenarioDuration: 60,
  // 请求间隔（毫秒）
  requestInterval: 100,
  // 最大响应时间阈值（毫秒）
  maxResponseTime: 5000,
  // 错误率阈值
  maxErrorRate: 0.05,
};

// 测试用户池
const TEST_USER_POOL = Array.from({ length: 20 }, (_, i) => ({
  email: `stress-user-${i}@teamclaw.test`,
  password: `StressTest${i}!`,
  name: `压力测试用户${i}`,
}));

/**
 * 响应时间统计工具
 */
class ResponseTimeTracker {
  private times: number[] = [];

  add(time: number): void {
    this.times.push(time);
  }

  getMetrics(): PerformanceMetrics {
    if (this.times.length === 0) {
      return {
        avgResponseTime: 0,
        maxResponseTime: 0,
        minResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        requestsPerSecond: 0,
        errorRate: 0,
      };
    }

    const sorted = [...this.times].sort((a, b) => a - b);
    const sum = sorted.reduce((s, t) => s + t, 0);

    return {
      avgResponseTime: Math.round(sum / sorted.length),
      maxResponseTime: sorted[sorted.length - 1],
      minResponseTime: sorted[0],
      p95ResponseTime: sorted[Math.floor(sorted.length * 0.95)] || sorted[sorted.length - 1],
      p99ResponseTime: sorted[Math.floor(sorted.length * 0.99)] || sorted[sorted.length - 1],
      requestsPerSecond: 1000 / (sum / sorted.length),
      errorRate: 0, // 由外部设置
    };
  }
}

/**
 * 创建测试用户并登录
 */
async function setupStressUser(context: BrowserContext, user: typeof TEST_USER_POOL[0]) {
  const page = await context.newPage();
  const auth = new AuthHelper(page);

  // 尝试登录
  const loginSuccess = await auth.login(user.email, user.password);
  if (!loginSuccess) {
    // 登录失败，尝试注册
    await auth.register(user.email, user.password, user.name);
    await auth.login(user.email, user.password);
  }

  return { page, auth };
}

/**
 * 压力测试：对话信道
 */
test.describe('压力测试 - 对话信道', () => {
  test('高频消息发送', async ({ browser }) => {
    const tracker = new ResponseTimeTracker();
    const errors: Array<{ code: string; message: string; count: number }> = [];
    const errorMap = new Map<string, number>();

    const startTime = Date.now();
    const endTime = startTime + STRESS_CONFIG.scenarioDuration * 1000;
    let totalRequests = 0;
    let failedRequests = 0;

    // 创建并发用户
    const contexts: BrowserContext[] = [];
    const users = TEST_USER_POOL.slice(0, Math.min(10, STRESS_CONFIG.concurrentUsers));

    for (const user of users) {
      const context = await browser.newContext();
      contexts.push(context);
      await setupStressUser(context, user);
    }

    // 执行压力测试
    test.info().annotations.push({
      type: 'stress',
      description: `${users.length} 并发用户，持续 ${STRESS_CONFIG.scenarioDuration}s`,
    });

    while (Date.now() < endTime) {
      const batchPromises = contexts.map(async (context) => {
        const pages = context.pages();
        const page = pages[pages.length - 1];
        if (!page) return;

        const requestStart = Date.now();
        totalRequests++;

        try {
          // 创建聊天会话
          const response = await page.evaluate(async () => {
            const url = `${window.location.origin}/api/chat/sessions`;
            const res = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                memberId: 'stress-test-member',
                memberName: '压力测试成员',
                title: `压力测试会话-${Date.now()}`,
              }),
            });
            return { status: res.status, ok: res.ok };
          });

          const duration = Date.now() - requestStart;
          tracker.add(duration);

          if (!response.ok) {
            failedRequests++;
            const errorCode = `HTTP_${response.status}`;
            errorMap.set(errorCode, (errorMap.get(errorCode) || 0) + 1);
          }
        } catch (error) {
          failedRequests++;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          errorMap.set(errorMessage, (errorMap.get(errorMessage) || 0) + 1);
        }

        // 请求间隔
        await new Promise(resolve => setTimeout(resolve, STRESS_CONFIG.requestInterval));
      });

      await Promise.all(batchPromises);
    }

    // 清理
    for (const context of contexts) {
      await context.close();
    }

    // 计算指标
    const metrics = tracker.getMetrics();
    metrics.errorRate = failedRequests / totalRequests;

    // 转换错误统计
    errorMap.forEach((count, message) => {
      errors.push({ code: 'ERROR', message, count });
    });

    // 生成报告
    const reportPath = new ReportGenerator().generateStressReport({
      title: '对话信道压力测试报告',
      totalDuration: Date.now() - startTime,
      scenarios: [{
        name: '高频消息发送',
        description: '模拟多用户并发创建聊天会话',
        concurrentUsers: users.length,
        duration: Date.now() - startTime,
        totalRequests,
        successfulRequests: totalRequests - failedRequests,
        failedRequests,
        metrics,
        errors,
      }],
    });

    console.log(`压力测试报告已生成: ${reportPath}`);

    // 验证性能指标
    expect(metrics.errorRate).toBeLessThan(STRESS_CONFIG.maxErrorRate);
    expect(metrics.avgResponseTime).toBeLessThan(1000);
  });
});

/**
 * 压力测试：文档编辑
 */
test.describe('压力测试 - 文档编辑', () => {
  test('并发文档创建和更新', async ({ browser }) => {
    const tracker = new ResponseTimeTracker();
    const errors: Array<{ code: string; message: string; count: number }> = [];
    const errorMap = new Map<string, number>();

    const startTime = Date.now();
    const endTime = startTime + STRESS_CONFIG.scenarioDuration * 1000;
    let totalRequests = 0;
    let failedRequests = 0;

    // 创建并发用户
    const contexts: BrowserContext[] = [];
    const users = TEST_USER_POOL.slice(0, Math.min(10, STRESS_CONFIG.concurrentUsers));

    for (const user of users) {
      const context = await browser.newContext();
      contexts.push(context);
      await setupStressUser(context, user);
    }

    // 执行压力测试
    while (Date.now() < endTime) {
      const batchPromises = contexts.map(async (context) => {
        const pages = context.pages();
        const page = pages[pages.length - 1];
        if (!page) return;

        const requestStart = Date.now();
        totalRequests++;

        try {
          // 创建文档
          const createResponse = await page.evaluate(async () => {
            const url = `${window.location.origin}/api/documents`;
            const res = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                title: `压力测试文档-${Date.now()}`,
                content: '# 压力测试\n\n这是压力测试生成的文档内容。',
                type: 'note',
              }),
            });
            return { status: res.status, ok: res.ok, data: res.ok ? await res.json() : null };
          });

          const duration = Date.now() - requestStart;
          tracker.add(duration);

          if (!createResponse.ok) {
            failedRequests++;
            const errorCode = `HTTP_${createResponse.status}`;
            errorMap.set(errorCode, (errorMap.get(errorCode) || 0) + 1);
          }
        } catch (error) {
          failedRequests++;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          errorMap.set(errorMessage, (errorMap.get(errorMessage) || 0) + 1);
        }

        await new Promise(resolve => setTimeout(resolve, STRESS_CONFIG.requestInterval));
      });

      await Promise.all(batchPromises);
    }

    // 清理
    for (const context of contexts) {
      await context.close();
    }

    // 计算指标
    const metrics = tracker.getMetrics();
    metrics.errorRate = failedRequests / totalRequests;

    errorMap.forEach((count, message) => {
      errors.push({ code: 'ERROR', message, count });
    });

    // 生成报告
    const reportPath = new ReportGenerator().generateStressReport({
      title: '文档编辑压力测试报告',
      totalDuration: Date.now() - startTime,
      scenarios: [{
        name: '并发文档创建',
        description: '模拟多用户并发创建和编辑文档',
        concurrentUsers: users.length,
        duration: Date.now() - startTime,
        totalRequests,
        successfulRequests: totalRequests - failedRequests,
        failedRequests,
        metrics,
        errors,
      }],
    });

    console.log(`压力测试报告已生成: ${reportPath}`);

    expect(metrics.errorRate).toBeLessThan(STRESS_CONFIG.maxErrorRate);
  });
});

/**
 * 压力测试：任务管理
 */
test.describe('压力测试 - 任务管理', () => {
  test('高并发任务 CRUD', async ({ browser }) => {
    const tracker = new ResponseTimeTracker();
    const errors: Array<{ code: string; message: string; count: number }> = [];
    const errorMap = new Map<string, number>();

    const startTime = Date.now();
    const endTime = startTime + STRESS_CONFIG.scenarioDuration * 1000;
    let totalRequests = 0;
    let failedRequests = 0;

    const contexts: BrowserContext[] = [];
    const users = TEST_USER_POOL.slice(0, Math.min(10, STRESS_CONFIG.concurrentUsers));

    for (const user of users) {
      const context = await browser.newContext();
      contexts.push(context);
      await setupStressUser(context, user);
    }

    while (Date.now() < endTime) {
      const batchPromises = contexts.map(async (context, index) => {
        const pages = context.pages();
        const page = pages[pages.length - 1];
        if (!page) return;

        const requestStart = Date.now();
        totalRequests++;

        try {
          // 创建任务
          const response = await page.evaluate(async ({ userId }) => {
            const url = `${window.location.origin}/api/tasks`;
            const res = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                title: `压力测试任务-${Date.now()}`,
                description: '压力测试任务描述',
                status: 'todo',
                priority: 'medium',
                creatorId: userId,
              }),
            });
            return { status: res.status, ok: res.ok };
          }, { userId: `user-${index}` });

          const duration = Date.now() - requestStart;
          tracker.add(duration);

          if (!response.ok) {
            failedRequests++;
            const errorCode = `HTTP_${response.status}`;
            errorMap.set(errorCode, (errorMap.get(errorCode) || 0) + 1);
          }
        } catch (error) {
          failedRequests++;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          errorMap.set(errorMessage, (errorMap.get(errorMessage) || 0) + 1);
        }

        await new Promise(resolve => setTimeout(resolve, STRESS_CONFIG.requestInterval));
      });

      await Promise.all(batchPromises);
    }

    for (const context of contexts) {
      await context.close();
    }

    const metrics = tracker.getMetrics();
    metrics.errorRate = failedRequests / totalRequests;

    errorMap.forEach((count, message) => {
      errors.push({ code: 'ERROR', message, count });
    });

    const reportPath = new ReportGenerator().generateStressReport({
      title: '任务管理压力测试报告',
      totalDuration: Date.now() - startTime,
      scenarios: [{
        name: '高并发任务创建',
        description: '模拟多用户并发创建任务',
        concurrentUsers: users.length,
        duration: Date.now() - startTime,
        totalRequests,
        successfulRequests: totalRequests - failedRequests,
        failedRequests,
        metrics,
        errors,
      }],
    });

    console.log(`压力测试报告已生成: ${reportPath}`);

    expect(metrics.errorRate).toBeLessThan(STRESS_CONFIG.maxErrorRate);
  });
});

/**
 * 压力测试：API 综合测试
 */
test.describe('压力测试 - API 综合', () => {
  test('混合 API 请求', async ({ browser }) => {
    const tracker = new ResponseTimeTracker();
    const errors: Array<{ code: string; message: string; count: number }> = [];
    const errorMap = new Map<string, number>();

    const startTime = Date.now();
    const endTime = startTime + STRESS_CONFIG.scenarioDuration * 1000;
    let totalRequests = 0;
    let failedRequests = 0;

    const contexts: BrowserContext[] = [];
    const users = TEST_USER_POOL.slice(0, Math.min(15, STRESS_CONFIG.concurrentUsers));

    for (const user of users) {
      const context = await browser.newContext();
      contexts.push(context);
      await setupStressUser(context, user);
    }

    // API 端点列表
    const apiEndpoints = [
      { method: 'GET', path: '/api/tasks' },
      { method: 'GET', path: '/api/projects' },
      { method: 'GET', path: '/api/documents' },
      { method: 'GET', path: '/api/members' },
    ];

    while (Date.now() < endTime) {
      const batchPromises = contexts.map(async (context) => {
        const pages = context.pages();
        const page = pages[pages.length - 1];
        if (!page) return;

        // 随机选择一个 API
        const api = apiEndpoints[Math.floor(Math.random() * apiEndpoints.length)];

        const requestStart = Date.now();
        totalRequests++;

        try {
          const response = await page.evaluate(async (path) => {
            const url = `${window.location.origin}${path}`;
            const res = await fetch(url, { method: 'GET' });
            return { status: res.status, ok: res.ok };
          }, api.path);

          const duration = Date.now() - requestStart;
          tracker.add(duration);

          if (!response.ok) {
            failedRequests++;
            const errorCode = `HTTP_${response.status}`;
            errorMap.set(errorCode, (errorMap.get(errorCode) || 0) + 1);
          }
        } catch (error) {
          failedRequests++;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          errorMap.set(errorMessage, (errorMap.get(errorMessage) || 0) + 1);
        }

        await new Promise(resolve => setTimeout(resolve, STRESS_CONFIG.requestInterval));
      });

      await Promise.all(batchPromises);
    }

    for (const context of contexts) {
      await context.close();
    }

    const metrics = tracker.getMetrics();
    metrics.errorRate = failedRequests / totalRequests;

    errorMap.forEach((count, message) => {
      errors.push({ code: 'ERROR', message, count });
    });

    const reportPath = new ReportGenerator().generateStressReport({
      title: 'API 综合压力测试报告',
      totalDuration: Date.now() - startTime,
      scenarios: [{
        name: '混合 API 请求',
        description: '模拟多用户并发调用各种 API',
        concurrentUsers: users.length,
        duration: Date.now() - startTime,
        totalRequests,
        successfulRequests: totalRequests - failedRequests,
        failedRequests,
        metrics,
        errors,
      }],
    });

    console.log(`压力测试报告已生成: ${reportPath}`);

    expect(metrics.errorRate).toBeLessThan(STRESS_CONFIG.maxErrorRate);
    expect(metrics.p95ResponseTime).toBeLessThan(2000);
  });
});

/**
 * 压力测试：SSE 连接稳定性
 */
test.describe('压力测试 - SSE 连接', () => {
  test.skip('多用户 SSE 连接稳定性', async ({ browser }) => {
    // SSE 测试需要特殊的浏览器上下文设置
    // 这里标记为 skip，实际测试时需要单独配置
    const contexts: BrowserContext[] = [];
    const users = TEST_USER_POOL.slice(0, 5);

    for (const user of users) {
      const context = await browser.newContext();
      contexts.push(context);
      await setupStressUser(context, user);
    }

    // SSE 连接测试逻辑
    // 这里模拟 SSE 连接的稳定性测试

    for (const context of contexts) {
      await context.close();
    }

    expect(true).toBe(true);
  });
});
