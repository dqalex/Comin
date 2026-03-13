import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Wiki 文档页面 Page Object
 *
 * v3.0 支持认证系统
 */
export class WikiPage extends BasePage {
  readonly newDocButton: Locator;
  readonly docSidebar: Locator;
  readonly docEditor: Locator;
  readonly docTitleInput: Locator;
  readonly docContentEditor: Locator;
  readonly saveButton: Locator;
  readonly docList: Locator;
  readonly searchInput: Locator;

  constructor(page: Page) {
    super(page);

    // 新建文档按钮
    this.newDocButton = page.locator('button:has-text("New"), button:has-text("新建")').first();

    // 文档侧边栏
    this.docSidebar = page.locator('[class*="sidebar"]').or(
      page.locator('nav').or(
        page.locator('aside')
      )
    );

    // 文档编辑器
    this.docEditor = page.locator('[class*="editor"]').or(
      page.locator('textarea').or(
        page.locator('[contenteditable="true"]')
      )
    );

    // 文档标题输入
    this.docTitleInput = page.locator('input[name="title"]').or(
      page.locator('input[placeholder*="title"]').or(
        page.locator('input[placeholder*="标题"]')
      )
    );

    // 内容编辑器
    this.docContentEditor = page.locator('textarea').or(
      page.locator('[contenteditable="true"]')
    );

    // 保存按钮
    this.saveButton = page.locator('button:has-text("Save"), button:has-text("保存")');

    // 文档列表
    this.docList = page.locator('[class*="doc-item"]').or(
      page.locator('li').or(
        page.locator('[role="listitem"]')
      )
    );

    // 搜索输入框
    this.searchInput = page.locator('input[placeholder*="search" i]').or(
      page.locator('input[placeholder*="搜索"]')
    );
  }

  /**
   * 导航到 Wiki 页面
   */
  async goto() {
    await this.ensureAuthenticated('member');
    await this.page.goto('/wiki');
    await this.page.waitForLoadState('domcontentloaded');
    await this.page.waitForTimeout(1000);
  }

  /**
   * 创建新文档
   */
  async createDocument(title: string, content?: string) {
    // 点击新建文档按钮
    await this.newDocButton.click();
    await this.page.waitForTimeout(500);

    // 填写标题
    const titleInput = this.page.locator('input').first();
    await titleInput.waitFor({ state: 'visible', timeout: 5000 });
    await titleInput.fill(title);

    // 如果有内容，填写内容
    if (content) {
      const contentEditor = this.page.locator('textarea').first();
      if (await contentEditor.isVisible({ timeout: 1000 }).catch(() => false)) {
        await contentEditor.fill(content);
      }
    }

    // 提交创建
    const submitBtn = this.page.locator('button:has-text("Create"), button:has-text("创建")').last();
    await submitBtn.click();

    // 等待创建完成
    await this.page.waitForTimeout(1000);
  }

  /**
   * 选择文档
   */
  async selectDocument(title: string) {
    const docItem = this.page.locator(`text="${title}"`).first();
    await docItem.click();
    await this.page.waitForTimeout(500);
  }

  /**
   * 搜索文档
   */
  async searchDocuments(query: string) {
    const searchInput = this.page.locator('input[placeholder*="search" i], input[placeholder*="搜索"]').first();
    if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await searchInput.fill(query);
      await this.page.waitForTimeout(500);
    }
  }

  /**
   * 验证文档存在
   */
  async expectDocumentVisible(title: string) {
    const docElement = this.page.locator(`text="${title}"`);
    const count = await docElement.count();
    expect(count).toBeGreaterThan(0);
  }
}
