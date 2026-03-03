import { test, expect } from '@playwright/test';
import { TasksPage } from './pages/TasksPage';

test.describe('任务管理', () => {
  let tasksPage: TasksPage;

  test.beforeEach(async ({ page }) => {
    tasksPage = new TasksPage(page);
    await tasksPage.goto();
  });

  test('应该显示任务看板页面', async ({ page }) => {
    // 验证页面加载
    await expect(page).toHaveURL(/\/tasks/);
    
    // 验证四列看板存在
    await expect(tasksPage.todoColumn).toBeVisible();
    await expect(tasksPage.inProgressColumn).toBeVisible();
    await expect(tasksPage.completedColumn).toBeVisible();
  });

  test('应该能创建新任务', async ({ page }) => {
    const taskTitle = `测试任务 ${Date.now()}`;
    
    await tasksPage.createTask(taskTitle);
    
    // 验证任务出现在列表中
    await tasksPage.expectTaskVisible(taskTitle);
  });

  test('应该能查看任务详情', async ({ page }) => {
    // 先创建一个任务
    const taskTitle = `详情测试 ${Date.now()}`;
    await tasksPage.createTask(taskTitle);
    
    // 点击任务打开详情
    await tasksPage.clickTask(taskTitle);
    
    // 验证抽屉打开
    await expect(page.locator('[data-testid="task-drawer"]')).toBeVisible();
  });

  test('应该能拖拽任务改变状态', async ({ page }) => {
    // 创建任务
    const taskTitle = `拖拽测试 ${Date.now()}`;
    await tasksPage.createTask(taskTitle);
    
    // 获取任务卡片
    const taskCard = tasksPage.taskCards.filter({ hasText: taskTitle });
    
    // 拖拽到进行中列
    await taskCard.dragTo(tasksPage.inProgressColumn);
    
    // 验证状态变更
    await expect(tasksPage.inProgressColumn.locator(`text=${taskTitle}`)).toBeVisible();
  });
});
