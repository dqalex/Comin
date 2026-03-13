import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Settings 设置页面 Page Object
 *
 * v3.0 支持认证系统
 */
export class SettingsPage extends BasePage {
  readonly gatewayTab: Locator;
  readonly generalTab: Locator;
  readonly gatewayUrlInput: Locator;
  readonly saveButton: Locator;

  constructor(page: Page) {
    super(page);

    // Gateway 标签
    this.gatewayTab = page.locator('button:has-text("Gateway"), button:has-text("网关")').first();

    // 通用设置标签
    this.generalTab = page.locator('button:has-text("General"), button:has-text("通用")').first();

    // Gateway URL 输入框
    this.gatewayUrlInput = page.locator('input[name="url"]').or(
      page.locator('input[placeholder*="gateway"]').or(
        page.locator('input[placeholder*="网关"]')
      )
    );

    // 保存按钮
    this.saveButton = page.locator('button:has-text("Save"), button:has-text("保存")');
  }

  /**
   * 导航到 Settings 页面
   */
  async goto() {
    await this.ensureAuthenticated('member');
    await this.page.goto('/settings');
    await this.page.waitForLoadState('domcontentloaded');
    await this.page.waitForTimeout(1000);
  }

  /**
   * 导航到 Gateway 设置
   */
  async gotoGatewaySettings() {
    await this.goto();
    await this.gatewayTab.click();
    await this.page.waitForTimeout(500);
  }

  /**
   * 设置 Gateway URL
   */
  async setGatewayUrl(url: string) {
    const input = this.page.locator('input').first();
    await input.fill(url);
    await this.saveButton.first().click();
    await this.page.waitForTimeout(500);
  }
}
