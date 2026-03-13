import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * 项目页面 Page Object
 * 
 * v3.0 支持认证系统
 */
export class ProjectsPage extends BasePage {
  readonly newProjectButton: Locator;
  readonly projectDialog: Locator;
  readonly projectNameInput: Locator;
  readonly projectDescInput: Locator;
  readonly projectSubmitButton: Locator;
  readonly projectCards: Locator;

  constructor(page: Page) {
    super(page);
    // New Project 按钮 - 使用 .first() 处理多个匹配的情况
    this.newProjectButton = page.locator('button:has-text("New Project"):not(:has-text("+"))').first().or(
      page.locator('button:has-text("新建项目")').first()
    );
    this.projectDialog = page.locator('[data-testid="project-dialog"]').or(
      page.locator('[role="dialog"]')
    );
    this.projectNameInput = page.locator('[data-testid="project-name-input"]').or(
      page.locator('input[name="name"]').or(
        page.locator('input[placeholder*="项目"]').or(
          page.locator('input[placeholder*="project" i]')
        )
      )
    );
    this.projectDescInput = page.locator('[data-testid="project-desc-input"]').or(
      page.locator('textarea[name="description"]').or(
        page.locator('textarea[placeholder*="描述"]').or(
          page.locator('textarea[placeholder*="description" i]')
        )
      )
    );
    this.projectSubmitButton = page.locator('[data-testid="project-submit-button"]').or(
      page.locator('button[type="submit"]').or(
        page.locator('button:has-text("创建")').or(
          page.locator('button:has-text("Create")')
        )
      )
    );
    this.projectCards = page.locator('[data-testid="project-card"]').or(
      page.locator('[class*="project-card"]').or(
        page.locator('[class*="ProjectCard"]')
      )
    );
  }

  /**
   * 导航到项目页面（需要认证）
   */
  async goto() {
    await this.ensureAuthenticated('member');

    // 直接导航到项目页面
    await this.page.goto('/projects');
    await this.page.waitForLoadState('domcontentloaded');

    // 等待页面关键元素出现
    // 项目页面应该有 New Project 按钮
    try {
      await this.page.locator('button:has-text("New Project"), button:has-text("新建项目")').first().waitFor({ state: 'visible', timeout: 10000 });
    } catch {
      // 如果按钮不可见，可能需要等待更长时间
      await this.page.waitForTimeout(2000);
    }
  }

  /**
   * 创建新项目
   */
  async createProject(name: string, description?: string) {
    await this.newProjectButton.click();
    await this.projectNameInput.fill(name);
    if (description) {
      await this.projectDescInput.fill(description);
    }
    await this.projectSubmitButton.click();
    await this.page.waitForResponse(resp => 
      resp.url().includes('/api/projects') && resp.request().method() === 'POST'
    );
  }

  /**
   * 获取项目卡片数量
   */
  async getProjectCount(): Promise<number> {
    return await this.projectCards.count();
  }

  /**
   * 验证项目存在
   */
  async expectProjectVisible(name: string) {
    await expect(this.projectCards.filter({ hasText: name })).toBeVisible();
  }

  /**
   * 删除项目
   */
  async deleteProject(name: string) {
    const card = this.projectCards.filter({ hasText: name });
    await card.hover();
    await card.locator('[data-testid="delete-button"]').click();
  }
}
