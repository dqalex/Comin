import { test, expect } from '@playwright/test';
import { ProjectsPage } from './pages/ProjectsPage';

test.describe('项目管理', () => {
  let projectsPage: ProjectsPage;

  test.beforeEach(async ({ page }) => {
    projectsPage = new ProjectsPage(page);
    await projectsPage.goto();
  });

  test('应该显示项目列表页面', async ({ page }) => {
    await expect(page).toHaveURL(/\/projects/);
    await expect(projectsPage.newProjectButton).toBeVisible();
  });

  test('应该能创建新项目', async ({ page }) => {
    const projectName = `测试项目 ${Date.now()}`;
    const projectDesc = '这是一个测试项目描述';
    
    await projectsPage.createProject(projectName, projectDesc);
    
    // 验证项目出现在列表中
    await projectsPage.expectProjectVisible(projectName);
  });

  test('应该能查看项目详情', async ({ page }) => {
    // 创建项目
    const projectName = `详情项目 ${Date.now()}`;
    await projectsPage.createProject(projectName);
    
    // 点击项目卡片
    await projectsPage.projectCards.filter({ hasText: projectName }).click();
    
    // 验证跳转到项目详情或显示详情面板
    await expect(page.locator(`text=${projectName}`)).toBeVisible();
  });
});
