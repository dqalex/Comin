import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * SOP 模板页面 Page Object
 *
 * v3.0 支持认证系统
 */
export class SOPPage extends BasePage {
  readonly newTemplateButton: Locator;
  readonly templateList: Locator;
  readonly searchInput: Locator;

  constructor(page: Page) {
    super(page);

    // 新建模板按钮
    this.newTemplateButton = page.locator('button:has-text("New"), button:has-text("新建")').first();

    // 模板列表
    this.templateList = page.locator('[class*="template"]').or(
      page.locator('[class*="Template"]')
    );

    // 搜索输入框
    this.searchInput = page.locator('input[placeholder*="search" i]').or(
      page.locator('input[placeholder*="搜索"]')
    );
  }

  /**
   * 导航到 SOP 页面
   */
  async goto() {
    await this.ensureAuthenticated('member');
    await this.page.goto('/sop');
    await this.page.waitForLoadState('domcontentloaded');
    await this.page.waitForTimeout(1000);
  }

  /**
   * 创建新模板
   */
  async createTemplate(name: string) {
    // 点击新建按钮
    await this.newTemplateButton.click();
    await this.page.waitForTimeout(500);

    // 填写模板名称
    const nameInput = this.page.locator('input').first();
    await nameInput.waitFor({ state: 'visible', timeout: 5000 });
    await nameInput.fill(name);

    // 提交
    const submitBtn = this.page.locator('button:has-text("Create"), button:has-text("创建")').last();
    await submitBtn.click();

    await this.page.waitForTimeout(1000);
  }

  /**
   * 验证模板存在
   */
  async expectTemplateVisible(name: string) {
    const templateElement = this.page.locator(`text="${name}"`);
    const count = await templateElement.count();
    expect(count).toBeGreaterThan(0);
  }
}
