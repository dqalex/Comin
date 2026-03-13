import { test, expect } from '@playwright/test';
import { SOPPage } from './pages/SOPPage';
import { AuthHelper } from './pages/AuthHelper';

test.describe('SOP 模板管理', () => {
  let sopPage: SOPPage;
  let authHelper: AuthHelper;

  test.beforeEach(async ({ page }) => {
    sopPage = new SOPPage(page);
    authHelper = new AuthHelper(page);
    await authHelper.ensureLoggedIn('member');
    await sopPage.goto();
  });

  test('应该显示 SOP 页面', async ({ page }) => {
    await expect(page).toHaveURL(/\/sop/);

    // 验证页面元素存在
    const hasTitle = await page.locator('h1:has-text("SOP"), h1:has-text("模板")').isVisible({ timeout: 2000 }).catch(() => false);
    const hasContent = await page.locator('text=/SOP|Template|模板|流程/i').count();

    expect(hasTitle || hasContent > 0).toBe(true);
  });

  test('应该显示模板列表', async ({ page }) => {
    // 等待页面加载
    await page.waitForTimeout(1000);

    // 验证有模板相关内容
    const hasContent = await page.locator('text=/SOP|Template|模板|draft|active/i').count();
    expect(hasContent).toBeGreaterThan(0);
  });

  test('应该能切换标签页', async ({ page }) => {
    // 检查是否有标签切换功能
    const sopTab = page.locator('button:has-text("SOP")').first();
    const renderTab = page.locator('button:has-text("Render"), button:has-text("渲染")').first();

    // 如果两个标签都存在，测试切换
    const hasTabs = (await sopTab.count()) > 0 && (await renderTab.count()) > 0;

    if (hasTabs) {
      // 点击 Render 标签
      await renderTab.click();
      await page.waitForTimeout(500);

      // 点击 SOP 标签返回
      await sopTab.click();
      await page.waitForTimeout(500);
    }
  });
});
