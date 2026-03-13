import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Agent 管理页面 Page Object
 *
 * v3.0 支持认证系统
 * 需要 Gateway 连接
 *
 * Agent 管理功能：
 * - 查看 Agent 列表
 * - 创建/编辑/删除 Agent
 * - 查看 Agent 详情（文件、工具、技能、频道、定时任务、会话）
 */
export class AgentsPage extends BasePage {
  readonly agentList: Locator;
  readonly createAgentButton: Locator;
  readonly agentCards: Locator;
  readonly overviewTab: Locator;
  readonly filesTab: Locator;
  readonly toolsTab: Locator;
  readonly skillsTab: Locator;
  readonly channelsTab: Locator;
  readonly cronTab: Locator;
  readonly sessionsTab: Locator;
  readonly gatewayRequired: Locator;

  constructor(page: Page) {
    super(page);

    // Agent 列表
    this.agentList = page.locator('[data-testid="agent-list"]').or(
      page.locator('[class*="agent-list"]').or(
        page.locator('[class*="AgentList"]')
      )
    );

    // 创建 Agent 按钮
    this.createAgentButton = page.locator('button:has-text("New Agent")').or(
      page.locator('button:has-text("新建 Agent")').or(
        page.locator('button:has-text("创建 Agent")')
      )
    );

    // Agent 卡片
    this.agentCards = page.locator('[data-testid="agent-card"]').or(
      page.locator('[class*="agent-card"]').or(
        page.locator('[class*="AgentCard"]')
      )
    );

    // 标签页
    this.overviewTab = page.locator('button:has-text("Overview")').or(
      page.locator('button:has-text("概览")')
    );
    this.filesTab = page.locator('button:has-text("Files")').or(
      page.locator('button:has-text("文件")')
    );
    this.toolsTab = page.locator('button:has-text("Tools")').or(
      page.locator('button:has-text("工具")')
    );
    this.skillsTab = page.locator('button:has-text("Skills")').or(
      page.locator('button:has-text("技能")')
    );
    this.channelsTab = page.locator('button:has-text("Channels")').or(
      page.locator('button:has-text("频道")')
    );
    this.cronTab = page.locator('button:has-text("Cron")').or(
      page.locator('button:has-text("定时任务")')
    );
    this.sessionsTab = page.locator('button:has-text("Sessions")').or(
      page.locator('button:has-text("会话")')
    );

    // Gateway 未连接提示
    this.gatewayRequired = page.locator('text=/Gateway.*required|需要.*Gateway|Connect.*Gateway/i').or(
      page.locator('[class*="gateway-required"]').or(
        page.locator('[data-testid="gateway-required"]')
      )
    );
  }

  /**
   * 导航到 Agent 管理页面（需要认证）
   */
  async goto() {
    await this.ensureAuthenticated('member');

    // 直接导航到 Agent 页面
    await this.page.goto('/agents');
    await this.page.waitForLoadState('domcontentloaded');

    // 等待页面加载
    await this.page.waitForTimeout(1000);
  }

  /**
   * 获取 Agent 数量
   */
  async getAgentCount(): Promise<number> {
    return await this.agentCards.count();
  }

  /**
   * 点击 Agent 卡片
   */
  async clickAgent(name: string) {
    await this.agentCards.filter({ hasText: name }).click();
  }

  /**
   * 检查是否需要 Gateway 连接
   */
  async isGatewayRequired(): Promise<boolean> {
    return await this.gatewayRequired.isVisible({ timeout: 2000 }).catch(() => false);
  }

  /**
   * 验证 Agent 存在
   */
  async expectAgentVisible(name: string) {
    const agentName = this.page.locator(`text="${name}"`);
    await expect(agentName).toBeVisible({ timeout: 5000 });
  }
}
