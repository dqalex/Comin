import { test, expect } from '@playwright/test';

test.describe('导航和布局', () => {
  test('应该能正常访问首页', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // 验证页面加载
    await expect(page).toHaveURL(/localhost:3000/);
  });

  test('应该能通过侧边栏导航到各页面', async ({ page }) => {
    await page.goto('/');
    
    // 点击任务导航
    await page.click('text=任务');
    await expect(page).toHaveURL(/\/tasks/);
    
    // 点击项目导航
    await page.click('text=项目');
    await expect(page).toHaveURL(/\/projects/);
    
    // 点击文档导航
    await page.click('text=文档');
    await expect(page).toHaveURL(/\/wiki/);
  });

  test('应该能切换深色模式', async ({ page }) => {
    await page.goto('/');
    
    // 查找主题切换按钮
    const themeToggle = page.locator('[data-testid="theme-toggle"]');
    
    if (await themeToggle.isVisible()) {
      // 获取当前主题
      const html = page.locator('html');
      const isDark = await html.evaluate(el => el.classList.contains('dark'));
      
      // 切换主题
      await themeToggle.click();
      
      // 验证主题已切换
      const newIsDark = await html.evaluate(el => el.classList.contains('dark'));
      expect(newIsDark).toBe(!isDark);
    }
  });

  test('应该能切换语言', async ({ page }) => {
    await page.goto('/');
    
    // 查找语言切换按钮
    const langToggle = page.locator('[data-testid="language-toggle"]');
    
    if (await langToggle.isVisible()) {
      await langToggle.click();
      
      // 验证语言选项出现
      await expect(page.locator('text=English')).toBeVisible();
      await expect(page.locator('text=中文')).toBeVisible();
    }
  });
});
