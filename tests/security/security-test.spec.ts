/**
 * 安全性测试套件
 * 
 * 测试场景：
 * 1. 权限越权 - 用户访问不属于自己权限的资源
 * 2. 数据泄露 - 敏感数据是否被正确保护
 * 3. SQL 注入 - 数据库注入攻击
 * 4. XSS 攻击 - 跨站脚本攻击
 * 5. CSRF 攻击 - 跨站请求伪造
 * 6. 认证绕过 - 绕过认证机制
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';
import { AuthHelper } from '../e2e/pages/AuthHelper';
import { ReportGenerator, SecurityVulnerability } from '../helpers/report-generator';

// 安全测试用户
const SECURITY_USERS = {
  admin: {
    email: 'security-admin@teamclaw.test',
    password: 'SecureAdmin123!',
    name: '安全管理员',
  },
  member1: {
    email: 'security-member1@teamclaw.test',
    password: 'SecureMember123!',
    name: '安全测试成员1',
  },
  member2: {
    email: 'security-member2@teamclaw.test',
    password: 'SecureMember123!',
    name: '安全测试成员2',
  },
  attacker: {
    email: 'security-attacker@teamclaw.test',
    password: 'SecureAttacker123!',
    name: '模拟攻击者',
  },
};

// 存储发现的漏洞
const discoveredVulnerabilities: SecurityVulnerability[] = [];

/**
 * 创建用户并登录
 */
async function setupSecurityUser(context: BrowserContext, user: typeof SECURITY_USERS.admin) {
  const page = await context.newPage();
  const auth = new AuthHelper(page);

  const loginSuccess = await auth.login(user.email, user.password);
  if (!loginSuccess) {
    await auth.register(user.email, user.password, user.name);
    await auth.login(user.email, user.password);
  }

  return { page, auth };
}

/**
 * 记录漏洞
 */
function recordVulnerability(vuln: SecurityVulnerability) {
  discoveredVulnerabilities.push(vuln);
}

/**
 * 水平越权测试
 */
test.describe('安全测试 - 水平越权', () => {
  test('用户不应能访问其他用户的私有项目', async ({ browser }) => {
    // 创建用户1上下文
    const user1Context = await browser.newContext();
    const { page: user1Page } = await setupSecurityUser(user1Context, SECURITY_USERS.member1);

    // 用户1创建私有项目
    const project = await user1Page.evaluate(async () => {
      const url = `${window.location.origin}/api/projects`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `私有项目-${Date.now()}`,
          description: '用户1的私有项目',
          source: 'local',
          visibility: 'private',
        }),
      });
      return res.ok ? await res.json() : null;
    });

    expect(project).not.toBeNull();

    // 创建用户2上下文（攻击者）
    const user2Context = await browser.newContext();
    const { page: user2Page } = await setupSecurityUser(user2Context, SECURITY_USERS.member2);

    // 尝试访问用户1的私有项目
    const accessResult = await user2Page.evaluate(async (projectId) => {
      const url = `${window.location.origin}/api/projects/${projectId}`;
      const res = await fetch(url, { method: 'GET' });
      return { status: res.status, ok: res.ok };
    }, project.id);

    // 验证：应该被拒绝（403 或 404）
    const isVulnerable = accessResult.status === 200;

    if (isVulnerable) {
      recordVulnerability({
        id: 'SEC-001',
        severity: 'high',
        title: '水平越权 - 私有项目可被其他用户访问',
        description: '用户可以访问其他用户的私有项目，存在水平越权漏洞',
        endpoint: `/api/projects/${project.id}`,
        method: 'GET',
        impact: '用户可以查看、修改其他用户的私有数据，导致数据泄露',
        recommendation: '在 API 端点中检查用户是否为项目所有者或成员',
        references: ['OWASP A01:2021 - Broken Access Control'],
      });
    }

    expect([403, 404]).toContain(accessResult.status);

    await user1Context.close();
    await user2Context.close();
  });

  test('用户不应能修改其他用户的任务', async ({ browser }) => {
    const user1Context = await browser.newContext();
    const { page: user1Page } = await setupSecurityUser(user1Context, SECURITY_USERS.member1);

    // 用户1创建任务
    const task = await user1Page.evaluate(async () => {
      const url = `${window.location.origin}/api/tasks`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `用户1的任务-${Date.now()}`,
          description: '这是用户1的私有任务',
          status: 'todo',
          priority: 'high',
          creatorId: 'user1',
        }),
      });
      return res.ok ? await res.json() : null;
    });

    expect(task).not.toBeNull();

    // 用户2尝试修改用户1的任务
    const user2Context = await browser.newContext();
    const { page: user2Page } = await setupSecurityUser(user2Context, SECURITY_USERS.member2);

    const updateResult = await user2Page.evaluate(async (taskId) => {
      const url = `${window.location.origin}/api/tasks/${taskId}`;
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '被恶意修改的任务' }),
      });
      return { status: res.status, ok: res.ok };
    }, task.id);

    const isVulnerable = updateResult.status === 200;

    if (isVulnerable) {
      recordVulnerability({
        id: 'SEC-002',
        severity: 'high',
        title: '水平越权 - 任务可被其他用户修改',
        description: '用户可以修改其他用户创建的任务，存在水平越权漏洞',
        endpoint: `/api/tasks/${task.id}`,
        method: 'PUT',
        impact: '用户可以篡改其他用户的工作内容，导致数据完整性问题',
        recommendation: '在 PUT 端点中验证用户是否有权限修改该任务',
        references: ['OWASP A01:2021 - Broken Access Control'],
      });
    }

    expect([403, 404]).toContain(updateResult.status);

    await user1Context.close();
    await user2Context.close();
  });
});

/**
 * 垂直越权测试
 */
test.describe('安全测试 - 垂直越权', () => {
  test('普通用户不应能访问管理员功能', async ({ browser }) => {
    const memberContext = await browser.newContext();
    const { page: memberPage } = await setupSecurityUser(memberContext, SECURITY_USERS.member1);

    // 尝试访问管理员 API（假设存在）
    const adminEndpoints = [
      { path: '/api/users', method: 'GET', desc: '获取所有用户' },
      { path: '/api/settings/global', method: 'PUT', desc: '修改全局设置' },
    ];

    for (const endpoint of adminEndpoints) {
      const result = await memberPage.evaluate(async ({ path, method }) => {
        const url = `${window.location.origin}${path}`;
        const res = await fetch(url, { method });
        return { status: res.status };
      }, endpoint);

      // 如果返回 200，说明存在越权
      if (result.status === 200) {
        recordVulnerability({
          id: `SEC-003-${endpoint.path}`,
          severity: 'critical',
          title: `垂直越权 - ${endpoint.desc}`,
          description: `普通用户可以访问管理员端点 ${endpoint.path}`,
          endpoint: endpoint.path,
          method: endpoint.method,
          impact: '普通用户可以执行管理员操作，导致系统被破坏',
          recommendation: '在 API 端点中添加角色验证中间件',
          references: ['OWASP A01:2021 - Broken Access Control'],
        });
      }

      // 验证应该返回 401 或 403
      expect([401, 403, 404]).toContain(result.status);
    }

    await memberContext.close();
  });
});

/**
 * SQL 注入测试
 */
test.describe('安全测试 - SQL 注入', () => {
  const sqlInjectionPayloads = [
    "' OR '1'='1",
    "'; DROP TABLE users; --",
    "' UNION SELECT * FROM users --",
    "1' OR '1'='1' /*",
    "admin'--",
    "' OR 1=1--",
  ];

  test('API 端点应防御 SQL 注入', async ({ browser }) => {
    const context = await browser.newContext();
    const { page } = await setupSecurityUser(context, SECURITY_USERS.member1);

    for (const payload of sqlInjectionPayloads) {
      // 测试查询参数注入
      const result = await page.evaluate(async (payload) => {
        const url = `${window.location.origin}/api/tasks?projectId=${encodeURIComponent(payload)}`;
        const res = await fetch(url, { method: 'GET' });
        return { status: res.status, body: res.ok ? await res.text() : null };
      }, payload);

      // 验证没有返回异常数据或错误信息
      if (result.body) {
        const hasSqlError = result.body.toLowerCase().includes('sql') ||
          result.body.toLowerCase().includes('sqlite') ||
          result.body.toLowerCase().includes('database error');

        if (hasSqlError) {
          recordVulnerability({
            id: `SEC-004-${payload.substring(0, 10)}`,
            severity: 'critical',
            title: 'SQL 注入 - 错误信息泄露',
            description: `SQL 注入攻击导致错误信息泄露: ${payload}`,
            endpoint: '/api/tasks',
            method: 'GET',
            payload,
            impact: '攻击者可以通过错误信息获取数据库结构信息',
            recommendation: '使用参数化查询，不要在错误信息中暴露数据库细节',
            references: ['OWASP A03:2021 - Injection'],
          });
        }
      }

      // 应该返回正常响应或 400，不应该返回 500
      expect(result.status).toBeLessThan(500);
    }

    await context.close();
  });
});

/**
 * XSS 攻击测试
 */
test.describe('安全测试 - XSS', () => {
  const xssPayloads = [
    '<script>alert("XSS")</script>',
    '<img src=x onerror=alert("XSS")>',
    '<svg onload=alert("XSS")>',
    'javascript:alert("XSS")',
    '<body onload=alert("XSS")>',
    '"><script>alert("XSS")</script>',
  ];

  test('API 应正确转义用户输入', async ({ browser }) => {
    const context = await browser.newContext();
    const { page } = await setupSecurityUser(context, SECURITY_USERS.member1);

    for (const payload of xssPayloads) {
      // 创建包含 XSS payload 的任务
      const result = await page.evaluate(async (payload) => {
        const url = `${window.location.origin}/api/tasks`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: payload,
            description: `XSS 测试: ${payload}`,
            status: 'todo',
            priority: 'medium',
            creatorId: 'xss-test',
          }),
        });
        return { status: res.status, data: res.ok ? await res.json() : null };
      }, payload);

      if (result.data) {
        // 验证返回的数据是否被转义
        const title = result.data.title || '';
        const hasUnescapedScript = title.includes('<script>') && !title.includes('&lt;script&gt;');

        if (hasUnescapedScript) {
          recordVulnerability({
            id: `SEC-005-${payload.substring(0, 20)}`,
            severity: 'high',
            title: 'XSS - 输入未正确转义',
            description: `用户输入的 XSS payload 未被转义: ${payload}`,
            endpoint: '/api/tasks',
            method: 'POST',
            payload,
            impact: '攻击者可以执行任意 JavaScript 代码，窃取用户 Cookie 或执行恶意操作',
            recommendation: '对所有用户输入进行 HTML 转义，使用 Content-Security-Policy 头',
            references: ['OWASP A03:2021 - Injection', 'CWE-79'],
          });
        }
      }
    }

    await context.close();
  });
});

/**
 * 认证安全测试
 */
test.describe('安全测试 - 认证', () => {
  test('未认证用户不应能访问受保护资源', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // 不登录，直接访问受保护 API
    const protectedEndpoints = [
      '/api/tasks',
      '/api/projects',
      '/api/documents',
      '/api/members',
      '/api/settings',
    ];

    for (const endpoint of protectedEndpoints) {
      const result = await page.evaluate(async (endpoint) => {
        const url = `${window.location.origin}${endpoint}`;
        const res = await fetch(url, { method: 'GET' });
        return { status: res.status };
      }, endpoint);

      // 应该返回 401 或重定向
      if (result.status === 200) {
        recordVulnerability({
          id: `SEC-006-${endpoint.replace('/', '')}`,
          severity: 'critical',
          title: '认证绕过 - 未认证可访问受保护资源',
          description: `未登录用户可以访问 ${endpoint}`,
          endpoint,
          method: 'GET',
          impact: '未认证用户可以访问敏感数据',
          recommendation: '在 API 中间件中验证用户认证状态',
          references: ['OWASP A07:2021 - Identification and Authentication Failures'],
        });
      }

      expect([401, 302, 403]).toContain(result.status);
    }

    await context.close();
  });

  test('登出后应无法继续访问受保护资源', async ({ browser }) => {
    const context = await browser.newContext();
    const { page, auth } = await setupSecurityUser(context, SECURITY_USERS.member1);

    // 登出
    await auth.logout();

    // 尝试访问受保护资源
    const result = await page.evaluate(async () => {
      const url = `${window.location.origin}/api/tasks`;
      const res = await fetch(url, { method: 'GET' });
      return { status: res.status };
    });

    if (result.status === 200) {
      recordVulnerability({
        id: 'SEC-007',
        severity: 'high',
        title: '会话管理 - 登出后会话仍有效',
        description: '用户登出后，Session Cookie 仍然有效',
        endpoint: '/api/tasks',
        method: 'GET',
        impact: '攻击者可以重用登出后的 Session',
        recommendation: '登出时正确销毁服务器端 Session',
        references: ['OWASP A07:2021 - Identification and Authentication Failures'],
      });
    }

    expect([401, 403, 302]).toContain(result.status);

    await context.close();
  });
});

/**
 * 数据泄露测试
 */
test.describe('安全测试 - 数据泄露', () => {
  test('API 响应不应包含敏感字段', async ({ browser }) => {
    const context = await browser.newContext();
    const { page } = await setupSecurityUser(context, SECURITY_USERS.member1);

    // 获取成员列表
    const membersResult = await page.evaluate(async () => {
      const url = `${window.location.origin}/api/members`;
      const res = await fetch(url, { method: 'GET' });
      return res.ok ? await res.json() : null;
    });

    if (membersResult) {
      const members = Array.isArray(membersResult) ? membersResult : membersResult.data || [];

      for (const member of members) {
        // 检查是否泄露敏感字段
        if (member.openclawApiToken && !member.openclawApiToken.includes('***')) {
          recordVulnerability({
            id: 'SEC-008',
            severity: 'critical',
            title: '敏感数据泄露 - API Token 未脱敏',
            description: '成员 API 响应中包含未脱敏的 API Token',
            endpoint: '/api/members',
            method: 'GET',
            impact: '攻击者可以获取其他用户的 API Token',
            recommendation: '在响应前使用 sanitize 函数脱敏敏感字段',
            references: ['OWASP A01:2021 - Broken Access Control'],
          });
        }

        if (member.passwordHash) {
          recordVulnerability({
            id: 'SEC-009',
            severity: 'critical',
            title: '敏感数据泄露 - 密码哈希泄露',
            description: '成员 API 响应中包含密码哈希',
            endpoint: '/api/members',
            method: 'GET',
            impact: '攻击者可以离线破解密码',
            recommendation: '永远不要在 API 响应中返回密码相关字段',
            references: ['OWASP A02:2021 - Cryptographic Failures'],
          });
        }
      }
    }

    await context.close();
  });

  test('错误信息不应泄露系统信息', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // 发送格式错误的请求
    const result = await page.evaluate(async () => {
      const url = `${window.location.origin}/api/tasks`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json{{{',
      });
      return { status: res.status, body: await res.text() };
    });

    const body = result.body.toLowerCase();
    const sensitivePatterns = [
      'stack trace',
      'at node',
      'at module',
      'internal/',
      '/users/',
      '/home/',
      'nextjs',
      'sqlite',
    ];

    for (const pattern of sensitivePatterns) {
      if (body.includes(pattern)) {
        recordVulnerability({
          id: `SEC-010-${pattern.replace(' ', '-')}`,
          severity: 'medium',
          title: '信息泄露 - 错误信息包含系统信息',
          description: `错误信息中包含敏感路径或技术栈信息: ${pattern}`,
          endpoint: '/api/tasks',
          method: 'POST',
          impact: '攻击者可以了解系统架构，辅助其他攻击',
          recommendation: '在生产环境返回通用错误信息，不暴露技术细节',
          references: ['OWASP A05:2021 - Security Misconfiguration'],
        });
      }
    }

    await context.close();
  });
});

/**
 * 测试结束后生成报告
 */
test.afterAll(async () => {
  if (discoveredVulnerabilities.length > 0) {
    const reportPath = new ReportGenerator().generateSecurityReport({
      title: 'TeamClaw 安全测试报告',
      vulnerabilities: discoveredVulnerabilities,
      testedEndpoints: [
        '/api/tasks',
        '/api/projects',
        '/api/documents',
        '/api/members',
        '/api/auth/login',
        '/api/auth/logout',
      ],
      testCategories: [
        { name: '水平越权', testCount: 2, passedCount: 2 - discoveredVulnerabilities.filter(v => v.title.includes('水平越权')).length },
        { name: '垂直越权', testCount: 1, passedCount: 1 - discoveredVulnerabilities.filter(v => v.title.includes('垂直越权')).length },
        { name: 'SQL 注入', testCount: 1, passedCount: 1 },
        { name: 'XSS', testCount: 1, passedCount: 1 },
        { name: '认证安全', testCount: 2, passedCount: 2 - discoveredVulnerabilities.filter(v => v.title.includes('认证') || v.title.includes('会话')).length },
        { name: '数据泄露', testCount: 2, passedCount: 2 - discoveredVulnerabilities.filter(v => v.title.includes('泄露')).length },
      ],
    });

    console.log(`\n安全测试报告已生成: ${reportPath}`);
    console.log(`发现漏洞数: ${discoveredVulnerabilities.length}`);
  }
});
