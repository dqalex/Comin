import { test, expect } from '@playwright/test';
import { ProjectsPage } from './pages/ProjectsPage';
import { AuthHelper } from './pages/AuthHelper';

test.describe('项目管理', () => {
  let projectsPage: ProjectsPage;
  let authHelper: AuthHelper;

  test.beforeEach(async ({ page }) => {
    projectsPage = new ProjectsPage(page);
    authHelper = new AuthHelper(page);
    // v3.0: 需要先登录
    await authHelper.ensureLoggedIn('member');
    await projectsPage.goto();
  });

  test('应该显示项目列表页面', async ({ page }) => {
    await expect(page).toHaveURL(/\/projects/);

    // 验证页面元素存在
    const hasPageTitle = await page.locator('h1:has-text("Projects"), h1:has-text("项目")').isVisible({ timeout: 2000 }).catch(() => false);
    const hasNewButton = await page.locator('button:has-text("New Project"), button:has-text("新建项目")').isVisible({ timeout: 2000 }).catch(() => false);

    expect(hasPageTitle || hasNewButton).toBe(true);
  });

  test('应该能创建新项目', async ({ page }) => {
    const projectName = `新项目 ${Date.now()}`;

    // 点击 New Project 按钮
    const newProjectBtn = page.locator('button:has-text("New Project")').first();
    await newProjectBtn.click();

    // 等待表单卡片出现
    await page.waitForTimeout(1000);

    // 输入项目名称
    const nameInput = page.locator('input').first();
    await nameInput.fill(projectName);

    // 按 Enter 提交
    await nameInput.press('Enter');

    // 等待创建完成
    await page.waitForTimeout(1500);

    // 验证项目创建成功
    const projectElement = page.locator(`text="${projectName}"`);
    const count = await projectElement.count();
    expect(count).toBeGreaterThan(0);
  });

  test('应该能查看项目列表', async ({ page }) => {
    // 等待项目列表加载
    await page.waitForTimeout(1000);

    // 验证页面有项目内容（可能是空状态提示或项目卡片）
    const hasContent = await page.locator('text=/项目|Project|No projects/i').count();
    expect(hasContent).toBeGreaterThan(0);
  });
});
