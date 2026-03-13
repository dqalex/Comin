import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Session 管理页面 Page Object
 *
 * v3.0 支持认证系统
 * 需要 Gateway 连接
 *
 * Session 管理功能：
 * - 查看会话列表
 * - 创建/编辑/删除会话
 * - 筛选会话（按类型）
 */
export class SessionsPage extends BasePage {
  readonly sessionList: Locator;
  readonly createSessionButton: Locator;
  readonly sessionCards: Locator;
  readonly searchInput: Locator;
  readonly kindFilter: Locator;
  readonly gatewayRequired: Locator;

  constructor(page: Page) {
    super(page);

    // Session 列表
    this.sessionList = page.locator('[data-testid="session-list"]').or(
      page.locator('[class*="session-list"]').or(
        page.locator('[class*="SessionList"]')
      )
    );

    // 创建 Session 按钮
    this.createSessionButton = page.locator('button:has-text("New Session")').or(
      page.locator('button:has-text("新建会话")').or(
        page.locator('button:has-text("创建会话")')
      )
    );

    // Session 卡片
    this.sessionCards = page.locator('[data-testid="session-card"]').or(
      page.locator('[class*="session-card"]').or(
        page.locator('[class*="SessionCard"]')
      )
    );

    // 搜索框
    this.searchInput = page.locator('input[placeholder*="Search"]').or(
      page.locator('input[placeholder*="搜索"]').or(
        page.locator('input[name="search"]')
      )
    );

    // 类型筛选器
    this.kindFilter = page.locator('select[name="kind"]').or(
      page.locator('[data-testid="kind-filter"]')
    );

    // Gateway 未连接提示
    this.gatewayRequired = page.locator('text=/Gateway.*required|需要.*Gateway|Connect.*Gateway/i').or(
      page.locator('[class*="gateway-required"]').or(
        page.locator('[data-testid="gateway-required"]')
      )
    );
  }

  /**
   * 导航到 Session 管理页面（需要认证）
   */
  async goto() {
    await this.ensureAuthenticated('member');

    // 直接导航到 Session 页面
    await this.page.goto('/sessions');
    await this.page.waitForLoadState('domcontentloaded');

    // 等待页面加载
    await this.page.waitForTimeout(1000);
  }

  /**
   * 获取 Session 数量
   */
  async getSessionCount(): Promise<number> {
    return await this.sessionCards.count();
  }

  /**
   * 搜索 Session
   */
  async searchSessions(query: string) {
    await this.searchInput.fill(query);
    await this.searchInput.press('Enter');
    await this.page.waitForTimeout(500);
  }

  /**
   * 检查是否需要 Gateway 连接
   */
  async isGatewayRequired(): Promise<boolean> {
    return await this.gatewayRequired.isVisible({ timeout: 2000 }).catch(() => false);
  }

  /**
   * 验证 Session 存在
   */
  async expectSessionVisible(label: string) {
    const sessionLabel = this.page.locator(`text="${label}"`);
    await expect(sessionLabel).toBeVisible({ timeout: 5000 });
  }
}
