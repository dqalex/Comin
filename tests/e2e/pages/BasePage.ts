import { Page, Locator, expect } from '@playwright/test';

/**
 * 基础页面类 - 所有 Page Object 的父类
 */
export class BasePage {
  readonly page: Page;
  
  constructor(page: Page) {
    this.page = page;
  }

  /**
   * 导航到指定路径
   */
  async goto(path: string = '/') {
    await this.page.goto(path);
  }

  /**
   * 等待页面加载完成
   */
  async waitForLoad() {
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * 获取 toast 消息
   */
  async getToastMessage(): Promise<string | null> {
    const toast = this.page.locator('[data-testid="toast-message"]');
    if (await toast.isVisible()) {
      return toast.textContent();
    }
    return null;
  }
}
