import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * 任务页面 Page Object
 *
 * v3.0 支持认证系统
 *
 * 任务创建流程：
 * 1. 点击 "New Task" 按钮显示快速输入框
 * 2. 输入标题后按 Enter 创建
 * 3. 或点击 "Detail" 按钮打开详细对话框
 */
export class TasksPage extends BasePage {
  readonly newTaskButton: Locator;
  readonly quickInput: Locator;
  readonly taskDialog: Locator;
  readonly taskTitleInput: Locator;
  readonly taskSubmitButton: Locator;
  readonly taskCards: Locator;
  readonly todoColumn: Locator;
  readonly inProgressColumn: Locator;
  readonly completedColumn: Locator;

  constructor(page: Page) {
    super(page);

    // New Task 按钮（Header 中的按钮）
    this.newTaskButton = page.locator('button:has-text("New Task")').or(
      page.locator('button:has-text("新建任务")').or(
        page.locator('button:has-text("新任务")')
      )
    );

    // 快速输入框（点击 New Task 后出现）
    // 实际 placeholder: "Task title, press Enter to create..."
    this.quickInput = page.locator('input[placeholder*="Task title"]').or(
      page.locator('input[placeholder*="press Enter"]').or(
        page.locator('input[placeholder*="快速"]').or(
          page.locator('input[placeholder*="Quick"]')
        )
      )
    );

    // 详细对话框
    this.taskDialog = page.locator('[role="dialog"]').or(
      page.locator('[data-testid="task-create-dialog"]')
    );

    // 任务标题输入框
    this.taskTitleInput = page.locator('input[name="title"]').or(
      page.locator('input[placeholder*="任务"]').or(
        page.locator('input[placeholder*="task" i]')
      )
    );

    // 提交按钮
    this.taskSubmitButton = page.locator('button[type="submit"]').or(
      page.locator('button:has-text("创建")').or(
        page.locator('button:has-text("Create")')
      )
    );

    // 任务卡片
    this.taskCards = page.locator('[data-testid="task-card"]').or(
      page.locator('[class*="task-card"]').or(
        page.locator('[class*="TaskCard"]')
      )
    );

    // 看板列
    this.todoColumn = page.locator('[data-testid="column-todo"]').or(
      page.locator('[data-column="todo"]').or(
        page.locator('div:has(> h3:has-text("To Do"))').or(
          page.locator('div:has(> div:has-text("To Do"))')
        )
      )
    );
    this.inProgressColumn = page.locator('[data-testid="column-in_progress"]').or(
      page.locator('[data-column="in_progress"]').or(
        page.locator('div:has(> h3:has-text("In Progress"))').or(
          page.locator('div:has(> div:has-text("In Progress"))')
        )
      )
    );
    this.completedColumn = page.locator('[data-testid="column-completed"]').or(
      page.locator('[data-column="completed"]').or(
        page.locator('div:has(> h3:has-text("Completed"))').or(
          page.locator('div:has(> div:has-text("Completed"))')
        )
      )
    );
  }

  /**
   * 导航到任务页面（需要认证）
   */
  async goto() {
    await this.ensureAuthenticated('member');

    // 直接导航到任务页面
    await this.page.goto('/tasks');
    await this.page.waitForLoadState('domcontentloaded');

    // 等待页面关键元素出现
    // 任务页面应该有 New Task 按钮
    try {
      await this.newTaskButton.waitFor({ state: 'visible', timeout: 10000 });
    } catch {
      // 如果按钮不可见，可能需要等待更长时间
      await this.page.waitForTimeout(2000);
    }
  }

  /**
   * 创建新任务
   *
   * 流程：点击 New Task → 输入标题 → 按 Enter
   */
  async createTask(title: string) {
    // 点击 New Task 按钮显示快速输入框
    await this.newTaskButton.click();

    // 等待快速输入框出现
    await this.quickInput.waitFor({ state: 'visible', timeout: 5000 });

    // 输入标题
    await this.quickInput.fill(title);

    // 按 Enter 创建任务
    await this.quickInput.press('Enter');

    // 等待 API 响应
    await this.page.waitForResponse(resp =>
      resp.url().includes('/api/tasks') && resp.request().method() === 'POST',
      { timeout: 10000 }
    ).catch(() => {
      // 可能任务已经创建成功，忽略超时
    });

    // 等待一下让 UI 更新
    await this.page.waitForTimeout(500);
  }

  /**
   * 打开详细任务创建对话框
   */
  async openTaskCreateDialog() {
    await this.newTaskButton.click();
    await this.quickInput.waitFor({ state: 'visible', timeout: 5000 });

    // 点击 Detail 按钮
    const detailButton = this.page.locator('button:has-text("Detail")').or(
      this.page.locator('button:has-text("详细")')
    );
    if (await detailButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await detailButton.click();
    }
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
    // 等待任务出现在页面上
    // 直接查找包含标题的元素（heading 或文本）
    await this.page.waitForSelector(`text="${title}"`, { timeout: 5000 }).catch(() => {});

    // 验证标题可见
    const taskTitle = this.page.locator(`text="${title}"`);
    await expect(taskTitle).toBeVisible({ timeout: 5000 });
  }
}
