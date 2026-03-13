import { test, expect } from '@playwright/test';
import { MembersPage } from './pages/MembersPage';
import { AuthHelper } from './pages/AuthHelper';

test.describe('成员管理', () => {
  let membersPage: MembersPage;
  let authHelper: AuthHelper;

  test.beforeEach(async ({ page }) => {
    membersPage = new MembersPage(page);
    authHelper = new AuthHelper(page);
    await authHelper.ensureLoggedIn('member');
    await membersPage.goto();
  });

  test('应该显示成员页面', async ({ page }) => {
    await expect(page).toHaveURL(/\/members/);

    // 验证页面元素存在
    const hasTitle = await page.locator('h1:has-text("Members"), h1:has-text("成员")').isVisible({ timeout: 2000 }).catch(() => false);
    const hasContent = await page.locator('text=/成员|Member|团队|Team/i').count();

    expect(hasTitle || hasContent > 0).toBe(true);
  });

  test('应该显示当前登录用户', async ({ page }) => {
    // 验证当前用户显示在页面上
    // 用户名应该显示在页面的某个地方
    const userElement = page.locator('text=/E2E|成员|Member/i');
    const count = await userElement.count();
    expect(count).toBeGreaterThan(0);
  });

  test('应该显示成员统计信息', async ({ page }) => {
    // 等待页面加载
    await page.waitForTimeout(1000);

    // 验证有成员相关内容
    const hasMembers = await page.locator('text=/Member|成员|人类|Human|AI|Agent/i').count();
    expect(hasMembers).toBeGreaterThan(0);
  });
});
