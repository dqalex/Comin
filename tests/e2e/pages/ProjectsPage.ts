import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * 项目页面 Page Object
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
    this.newProjectButton = page.locator('[data-testid="new-project-button"]');
    this.projectDialog = page.locator('[data-testid="project-dialog"]');
    this.projectNameInput = page.locator('[data-testid="project-name-input"]');
    this.projectDescInput = page.locator('[data-testid="project-desc-input"]');
    this.projectSubmitButton = page.locator('[data-testid="project-submit-button"]');
    this.projectCards = page.locator('[data-testid="project-card"]');
  }

  async goto() {
    await super.goto('/projects');
    await this.waitForLoad();
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
