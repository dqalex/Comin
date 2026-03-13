import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Members 成员页面 Page Object
 *
 * v3.0 支持认证系统
 */
export class MembersPage extends BasePage {
  readonly memberList: Locator;
  readonly humanMemberSection: Locator;
  readonly aiMemberSection: Locator;

  constructor(page: Page) {
    super(page);

    // 成员列表
    this.memberList = page.locator('[class*="member"]').or(
      page.locator('[class*="Member"]')
    );

    // 人类成员区域
    this.humanMemberSection = page.locator('text=/Human|人类|团队成员/i').locator('..').or(
      page.locator('[class*="human"]').or(
        page.locator('[class*="Human"]')
      )
    );

    // AI 成员区域
    this.aiMemberSection = page.locator('text=/AI|Agent|智能/i').locator('..').or(
      page.locator('[class*="agent"]').or(
        page.locator('[class*="Agent"]')
      )
    );
  }

  /**
   * 导航到 Members 页面
   */
  async goto() {
    await this.ensureAuthenticated('member');
    await this.page.goto('/members');
    await this.page.waitForLoadState('domcontentloaded');
    await this.page.waitForTimeout(1000);
  }

  /**
   * 获取成员数量
   */
  async getMemberCount(): Promise<number> {
    return await this.memberList.count();
  }

  /**
   * 验证成员存在
   */
  async expectMemberVisible(name: string) {
    const memberElement = this.page.locator(`text="${name}"`);
    const count = await memberElement.count();
    expect(count).toBeGreaterThan(0);
  }
}
