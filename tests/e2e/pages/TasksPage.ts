import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * 任务页面 Page Object
 */
export class TasksPage extends BasePage {
  readonly newTaskButton: Locator;
  readonly taskDialog: Locator;
  readonly taskTitleInput: Locator;
  readonly taskSubmitButton: Locator;
  readonly taskCards: Locator;
  readonly todoColumn: Locator;
  readonly inProgressColumn: Locator;
  readonly completedColumn: Locator;

  constructor(page: Page) {
    super(page);
    this.newTaskButton = page.locator('[data-testid="new-task-button"]');
    this.taskDialog = page.locator('[data-testid="task-dialog"]');
    this.taskTitleInput = page.locator('[data-testid="task-title-input"]');
    this.taskSubmitButton = page.locator('[data-testid="task-submit-button"]');
    this.taskCards = page.locator('[data-testid="task-card"]');
    this.todoColumn = page.locator('[data-testid="column-todo"]');
    this.inProgressColumn = page.locator('[data-testid="column-in_progress"]');
    this.completedColumn = page.locator('[data-testid="column-completed"]');
  }

  async goto() {
    await super.goto('/tasks');
    await this.waitForLoad();
  }

  /**
   * 创建新任务
   */
  async createTask(title: string) {
    await this.newTaskButton.click();
    await this.taskTitleInput.fill(title);
    await this.taskSubmitButton.click();
    await this.page.waitForResponse(resp => 
      resp.url().includes('/api/tasks') && resp.request().method() === 'POST'
    );
  }

  /**
   * 获取任务卡片数量
   */
  async getTaskCount(): Promise<number> {
    return await this.taskCards.count();
  }

  /**
   * 点击任务卡片
   */
  async clickTask(title: string) {
    await this.taskCards.filter({ hasText: title }).click();
  }

  /**
   * 验证任务存在
   */
  async expectTaskVisible(title: string) {
    await expect(this.taskCards.filter({ hasText: title })).toBeVisible();
  }
}
