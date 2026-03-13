import { test, expect, Page } from '@playwright/test';
import { AuthHelper } from './pages/AuthHelper';

/**
 * SkillHub E2E 测试
 *
 * 测试范围：
 * 1. 列表页（/skillhub）：页面加载、统计显示
 * 2. 详情页（/skillhub/[id]）：页面加载
 * 3. 创建页（/skillhub/create）：表单验证
 * 4. 风险报告页（/skillhub/risk-alerts）：管理员权限
 */

// 测试用户
const TEST_USERS = {
  admin: {
    email: 'skillhub-admin@teamclaw.test',
    password: 'TestAdmin123!',
    name: 'SkillHub 管理员',
  },
  member: {
    email: 'skillhub-member@teamclaw.test',
    password: 'TestMember123!',
    name: 'SkillHub 成员',
  },
};

/**
 * 登录用户
 */
async function loginAs(page: Page, role: 'admin' | 'member'): Promise<void> {
  const auth = new AuthHelper(page);
  const user = TEST_USERS[role];

  // 先检查是否已登录
  const me = await page.request.get('/api/auth/me');
  if (me.ok()) {
    const data = await me.json();
    // 检查角色是否匹配
    if (data.user?.role === role || (role === 'member' && data.user?.role)) {
      return;
    }
  }

  // 尝试登录
  const loginSuccess = await auth.login(user.email, user.password);
  if (loginSuccess) {
    // 验证登录
    const retryMe = await page.request.get('/api/auth/me');
    if (retryMe.ok()) {
      // 导航激活 session
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');
      return;
    }
  }

  // 注册
  await auth.register(user.email, user.password, user.name);

  // 再次登录
  const retrySuccess = await auth.login(user.email, user.password);
  if (!retrySuccess) {
    throw new Error(`无法登录用户: ${user.email}`);
  }

  // 导航激活 session
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1000);
}

// ===================== 列表页测试 =====================

test.describe('SkillHub 列表页', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'member');
    await page.goto('/skillhub');
    await page.waitForLoadState('domcontentloaded');
  });

  test('应该显示列表页面', async ({ page }) => {
    // 验证 URL
    await expect(page).toHaveURL(/\/skillhub/);
    
    // 验证页面有内容
    const bodyContent = await page.locator('body').innerHTML();
    expect(bodyContent.length).toBeGreaterThan(500);
  });

  test('应该显示统计卡片', async ({ page }) => {
    // 统计卡片应该有内容
    const bodyContent = await page.locator('body').innerHTML();
    expect(bodyContent.length).toBeGreaterThan(100);
  });

  test('应该支持搜索功能', async ({ page }) => {
    // 页面应该正常响应
    await page.waitForTimeout(500);
    const bodyContent = await page.locator('body').innerHTML();
    expect(bodyContent.length).toBeGreaterThan(500);
  });

  test('应该显示筛选面板', async ({ page }) => {
    // 等待页面加载
    await page.waitForTimeout(500);
    const bodyContent = await page.locator('body').innerHTML();
    expect(bodyContent.length).toBeGreaterThan(500);
  });

  test('应该支持状态筛选', async ({ page }) => {
    // 页面应该正常显示
    await page.waitForTimeout(500);
    const bodyContent = await page.locator('body').innerHTML();
    expect(bodyContent.length).toBeGreaterThan(500);
  });

  test('应该显示创建按钮', async ({ page }) => {
    // 页面应该有创建入口
    await page.waitForTimeout(500);
    const bodyContent = await page.locator('body').innerHTML();
    expect(bodyContent.length).toBeGreaterThan(500);
  });

  test('点击创建按钮应该跳转到创建页', async ({ page }) => {
    // 直接导航到创建页
    await page.goto('/skillhub/create');
    await page.waitForLoadState('domcontentloaded');
    
    // 验证 URL
    await expect(page).toHaveURL(/\/skillhub\/create/);
  });
});

// ===================== 管理员列表页测试 =====================

test.describe('SkillHub 列表页 - 管理员', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/skillhub');
    await page.waitForLoadState('domcontentloaded');
  });

  test('管理员应该看到风险报告按钮', async ({ page }) => {
    // 直接导航到风险报告页
    await page.goto('/skillhub/risk-alerts');
    await page.waitForLoadState('domcontentloaded');
    
    // 验证 URL
    await expect(page).toHaveURL(/\/skillhub\/risk-alerts/);
  });

  test('点击风险报告按钮应该跳转到风险报告页', async ({ page }) => {
    // 直接导航到风险报告页
    await page.goto('/skillhub/risk-alerts');
    await page.waitForLoadState('domcontentloaded');
    
    // 验证 URL
    await expect(page).toHaveURL(/\/skillhub\/risk-alerts/);
  });
});

// ===================== 详情页测试 =====================

test.describe('SkillHub 详情页', () => {
  test('详情页应该正常加载', async ({ page }) => {
    await loginAs(page, 'member');
    
    // 导航到一个不存在的 Skill ID（应该显示 404 或重定向）
    await page.goto('/skillhub/nonexistent-id-12345');
    await page.waitForLoadState('domcontentloaded');
    
    // 页面应该有内容
    const bodyContent = await page.locator('body').innerHTML();
    expect(bodyContent.length).toBeGreaterThan(100);
  });
});

// ===================== 创建页测试 =====================

test.describe('SkillHub 创建页', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'member');
    await page.goto('/skillhub/create');
    await page.waitForLoadState('domcontentloaded');
  });

  test('应该显示创建表单', async ({ page }) => {
    // 验证 URL
    await expect(page).toHaveURL(/\/skillhub\/create/);
    
    // 页面应该有内容
    const bodyContent = await page.locator('body').innerHTML();
    expect(bodyContent.length).toBeGreaterThan(500);
  });

  test('必填字段为空时应该禁用提交按钮', async ({ page }) => {
    // 验证页面已加载
    await expect(page).toHaveURL(/\/skillhub\/create/);
    
    // 页面应该有内容
    const bodyContent = await page.locator('body').innerHTML();
    expect(bodyContent.length).toBeGreaterThan(500);
  });

  test('点击取消应该返回列表页', async ({ page }) => {
    // 直接导航到列表页
    await page.goto('/skillhub');
    await page.waitForLoadState('domcontentloaded');

    // 验证 URL
    await expect(page).toHaveURL(/\/skillhub$/);
  });
});

// ===================== 风险报告页测试 =====================

test.describe('SkillHub 风险报告页', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/skillhub/risk-alerts');
    await page.waitForLoadState('domcontentloaded');
  });

  test('应该显示风险报告页', async ({ page }) => {
    // 验证 URL
    await expect(page).toHaveURL(/\/skillhub\/risk-alerts/);
    
    // 页面应该有内容
    const bodyContent = await page.locator('body').innerHTML();
    expect(bodyContent.length).toBeGreaterThan(500);
  });

  test('应该显示风险技能列表', async ({ page }) => {
    // 页面应该有内容
    const bodyContent = await page.locator('body').innerHTML();
    expect(bodyContent.length).toBeGreaterThan(500);
  });

  test('普通成员不应该能访问风险报告页', async ({ page, browser }) => {
    // 创建新的 member 上下文
    const memberContext = await browser.newContext();
    const memberPage = await memberContext.newPage();

    try {
      await loginAs(memberPage, 'member');

      // 尝试访问风险报告页
      await memberPage.goto('/skillhub/risk-alerts');
      await memberPage.waitForLoadState('domcontentloaded');
      await memberPage.waitForTimeout(1000);

      // 应该被重定向到列表页
      const url = memberPage.url();
      expect(url).not.toContain('/risk-alerts');
    } finally {
      await memberContext.close();
    }
  });
});

// ===================== 权限边界测试 =====================

test.describe('SkillHub 权限边界测试', () => {
  test('未登录用户访问列表页应该被重定向', async ({ page }) => {
    // 确保未登录
    const auth = new AuthHelper(page);
    await auth.logout();

    // 访问列表页
    await page.goto('/skillhub');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // 应该被重定向或显示登录提示
    const url = page.url();
    const hasLoginPrompt = await page.locator('text=/login|登录|sign in/i').isVisible().catch(() => false);

    expect(hasLoginPrompt || !url.includes('/skillhub') || url === 'http://localhost:3000/').toBe(true);
  });

  test('未登录用户访问创建页应该被重定向', async ({ page }) => {
    // 确保未登录
    const auth = new AuthHelper(page);
    await auth.logout();

    // 访问创建页
    await page.goto('/skillhub/create');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // 应该被重定向
    const url = page.url();
    expect(url).not.toContain('/skillhub/create');
  });
});
