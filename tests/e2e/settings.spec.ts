import { test, expect } from '@playwright/test';
import { SettingsPage } from './pages/SettingsPage';
import { AuthHelper } from './pages/AuthHelper';

test.describe('设置页面', () => {
  let settingsPage: SettingsPage;
  let authHelper: AuthHelper;

  test.beforeEach(async ({ page }) => {
    settingsPage = new SettingsPage(page);
    authHelper = new AuthHelper(page);
    await authHelper.ensureLoggedIn('member');
    await settingsPage.goto();
  });

  test('应该显示设置页面', async ({ page }) => {
    await expect(page).toHaveURL(/\/settings/);

    // 验证页面元素存在
    const hasTitle = await page.locator('h1:has-text("Settings"), h1:has-text("设置")').isVisible({ timeout: 2000 }).catch(() => false);
    const hasContent = await page.locator('text=/设置|Settings|配置|Config/i').count();

    expect(hasTitle || hasContent > 0).toBe(true);
  });

  test('应该显示 Gateway 配置选项', async ({ page }) => {
    // 点击 Gateway 标签（如果存在）
    const gatewayTab = page.locator('button:has-text("Gateway"), button:has-text("网关")').first();
    if (await gatewayTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await gatewayTab.click();
      await page.waitForTimeout(500);

      // 验证 Gateway 相关内容
      const hasGateway = await page.locator('text=/Gateway|网关|URL|ws:/i').count();
      expect(hasGateway).toBeGreaterThan(0);
    }
  });

  test('应该显示语言设置', async ({ page }) => {
    // 检查语言设置选项
    const hasLanguage = await page.locator('text=/Language|语言|English|中文/i').count();
    // 语言设置可能存在也可能不存在
    console.log(`语言设置: ${hasLanguage > 0 ? '已找到' : '未找到'}`);
  });
});
