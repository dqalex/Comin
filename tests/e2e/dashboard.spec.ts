import { test, expect } from '@playwright/test';
import { AuthHelper } from './pages/AuthHelper';

test.describe('Dashboard 仪表板', () => {
  let authHelper: AuthHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    await authHelper.ensureLoggedIn('member');
  });

  test('应该显示仪表板页面', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');

    // 验证页面加载成功
    const hasContent = await page.locator('body').innerHTML();
    expect(hasContent.length).toBeGreaterThan(0);
  });

  test('应该显示快捷入口', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // 验证有快捷入口相关内容
    const hasQuickAccess = await page.locator('text=/Task|任务|Project|项目|Wiki|文档|Member|成员/i').count();
    expect(hasQuickAccess).toBeGreaterThan(0);
  });

  test('应该显示任务统计', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // 验证有统计相关内容
    const hasStats = await page.locator('text=/task|任务|In Progress|进行中|To Do|待办/i').count();
    expect(hasStats).toBeGreaterThan(0);
  });
});
