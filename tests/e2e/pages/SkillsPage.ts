import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Skill 管理页面 Page Object
 *
 * v3.0 支持认证系统
 * 需要 Gateway 连接
 *
 * Skill 管理功能：
 * - 查看技能列表
 * - 启用/禁用技能
 * - 安装新技能
 * - 搜索技能
 */
export class SkillsPage extends BasePage {
  readonly skillList: Locator;
  readonly installButton: Locator;
  readonly skillCards: Locator;
  readonly searchInput: Locator;
  readonly sourceFilter: Locator;
  readonly refreshButton: Locator;
  readonly gatewayRequired: Locator;

  constructor(page: Page) {
    super(page);

    // Skill 列表
    this.skillList = page.locator('[data-testid="skill-list"]').or(
      page.locator('[class*="skill-list"]').or(
        page.locator('[class*="SkillList"]')
      )
    );

    // 安装技能按钮
    this.installButton = page.locator('button:has-text("Install")').or(
      page.locator('button:has-text("安装")').or(
        page.locator('button:has-text("Install Skill")')
      )
    );

    // Skill 卡片
    this.skillCards = page.locator('[data-testid="skill-card"]').or(
      page.locator('[class*="skill-card"]').or(
        page.locator('[class*="SkillCard"]')
      )
    );

    // 搜索框
    this.searchInput = page.locator('input[placeholder*="Search"]').or(
      page.locator('input[placeholder*="搜索"]').or(
        page.locator('input[name="search"]')
      )
    );

    // 来源筛选器
    this.sourceFilter = page.locator('select[name="source"]').or(
      page.locator('[data-testid="source-filter"]')
    );

    // 刷新按钮
    this.refreshButton = page.locator('button:has-text("Refresh")').or(
      page.locator('button:has-text("刷新")')
    );

    // Gateway 未连接提示
    this.gatewayRequired = page.locator('text=/Gateway.*required|需要.*Gateway|Connect.*Gateway/i').or(
      page.locator('[class*="gateway-required"]').or(
        page.locator('[data-testid="gateway-required"]')
      )
    );
  }

  /**
   * 导航到 Skill 管理页面（需要认证）
   */
  async goto() {
    await this.ensureAuthenticated('member');

    // 直接导航到 Skill 页面
    await this.page.goto('/skills');
    await this.page.waitForLoadState('domcontentloaded');

    // 等待页面加载
    await this.page.waitForTimeout(1000);
  }

  /**
   * 获取 Skill 数量
   */
  async getSkillCount(): Promise<number> {
    return await this.skillCards.count();
  }

  /**
   * 搜索技能
   */
  async searchSkills(query: string) {
    await this.searchInput.fill(query);
    await this.searchInput.press('Enter');
    await this.page.waitForTimeout(500);
  }

  /**
   * 刷新技能列表
   */
  async refreshSkills() {
    await this.refreshButton.click();
    await this.page.waitForTimeout(1000);
  }

  /**
   * 检查是否需要 Gateway 连接
   */
  async isGatewayRequired(): Promise<boolean> {
    return await this.gatewayRequired.isVisible({ timeout: 2000 }).catch(() => false);
  }

  /**
   * 验证技能存在
   */
  async expectSkillVisible(name: string) {
    const skillName = this.page.locator(`text="${name}"`);
    await expect(skillName).toBeVisible({ timeout: 5000 });
  }
}
