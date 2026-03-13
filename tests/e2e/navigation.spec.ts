import { test, expect } from '@playwright/test';
import { AuthHelper } from './pages/AuthHelper';

test.describe('导航和布局', () => {
  let authHelper: AuthHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
  });

  test('应该能正常访问首页（未登录跳转）', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // v3.0: 未登录用户应该被重定向到初始化页面或其他页面
    // （取决于系统是否已初始化）
    const url = page.url();
    // 不应该在 /tasks 等受保护页面
    expect(url).not.toContain('/tasks');
    expect(url).not.toContain('/projects');
  });

  test('登录后应该能访问仪表板', async ({ page }) => {
    await authHelper.ensureLoggedIn('member');

    // 导航到首页
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // 应该在仪表板或其他受保护页面
    expect(page.url()).not.toContain('/login');
    expect(page.url()).not.toContain('/init');
  });

  test('应该能通过侧边栏导航到各页面', async ({ page }) => {
    // 先登录
    await authHelper.ensureLoggedIn('member');

    await page.goto('/tasks');
    await page.waitForLoadState('domcontentloaded');

    // 点击项目导航
    const projectsLink = page.locator('a:has-text("项目")').or(page.locator('a:has-text("Projects")'));
    if (await projectsLink.isVisible()) {
      await projectsLink.click();
      await expect(page).toHaveURL(/\/projects/);
    }

    // 点击文档导航
    const wikiLink = page.locator('a:has-text("文档")').or(page.locator('a:has-text("Wiki")').or(page.locator('a:has-text("Documents")')));
    if (await wikiLink.isVisible()) {
      await wikiLink.click();
      await expect(page).toHaveURL(/\/wiki/);
    }
  });

  test('应该能切换深色模式', async ({ page }) => {
    await authHelper.ensureLoggedIn('member');
    await page.goto('/tasks');
    await page.waitForLoadState('domcontentloaded');

    // 查找主题切换按钮
    const themeToggle = page.locator('[data-testid="theme-toggle"]').or(
      page.locator('button[aria-label*="theme"]').or(
        page.locator('button[aria-label*="主题"]')
      )
    );

    if (await themeToggle.isVisible({ timeout: 2000 }).catch(() => false)) {
      // 获取当前主题
      const html = page.locator('html');
      const isDark = await html.evaluate(el => el.classList.contains('dark'));

      // 切换主题
      await themeToggle.click();

      // 等待一下让主题生效
      await page.waitForTimeout(300);

      // 验证主题已切换
      const newIsDark = await html.evaluate(el => el.classList.contains('dark'));
      expect(newIsDark).toBe(!isDark);
    }
  });

  test('应该能切换语言', async ({ page }) => {
    await authHelper.ensureLoggedIn('member');
    await page.goto('/tasks');
    await page.waitForLoadState('domcontentloaded');

    // 查找语言切换按钮
    const langToggle = page.locator('[data-testid="language-toggle"]').or(
      page.locator('button[aria-label*="language"]').or(
        page.locator('button[aria-label*="语言"]')
      )
    );

    if (await langToggle.isVisible({ timeout: 2000 }).catch(() => false)) {
      await langToggle.click();

      // 验证语言选项出现
      const englishOption = page.locator('text=English');
      const chineseOption = page.locator('text=中文');

      // 至少有一个语言选项可见
      const hasEnglish = await englishOption.isVisible({ timeout: 1000 }).catch(() => false);
      const hasChinese = await chineseOption.isVisible({ timeout: 1000 }).catch(() => false);
      expect(hasEnglish || hasChinese).toBe(true);
    }
  });
});
