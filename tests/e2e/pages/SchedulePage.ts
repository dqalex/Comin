import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Schedule 管理页面 Page Object
 *
 * v3.0 支持认证系统
 * 需要 Gateway 连接
 *
 * Schedule 管理功能：
 * - 查看定时任务列表
 * - 创建/编辑/删除定时任务
 * - 启用/禁用定时任务
 * - 手动执行定时任务
 * - 查看执行历史
 */
export class SchedulePage extends BasePage {
  readonly jobList: Locator;
  readonly createJobButton: Locator;
  readonly jobCards: Locator;
  readonly refreshButton: Locator;
  readonly statsSection: Locator;
  readonly timelineSection: Locator;
  readonly gatewayRequired: Locator;

  constructor(page: Page) {
    super(page);

    // Job 列表
    this.jobList = page.locator('[data-testid="job-list"]').or(
      page.locator('[class*="job-list"]').or(
        page.locator('[class*="JobList"]')
      )
    );

    // 创建定时任务按钮
    this.createJobButton = page.locator('button:has-text("New Job")').or(
      page.locator('button:has-text("新建任务")').or(
        page.locator('button:has-text("创建定时任务")')
      )
    );

    // Job 卡片
    this.jobCards = page.locator('[data-testid="job-card"]').or(
      page.locator('[class*="job-card"]').or(
        page.locator('[class*="JobCard"]')
      )
    );

    // 刷新按钮
    this.refreshButton = page.locator('button:has-text("Refresh")').or(
      page.locator('button:has-text("刷新")')
    );

    // 统计区域
    this.statsSection = page.locator('[data-testid="schedule-stats"]').or(
      page.locator('[class*="schedule-stats"]').or(
        page.locator('[class*="ScheduleStats"]')
      )
    );

    // 时间线区域
    this.timelineSection = page.locator('[data-testid="schedule-timeline"]').or(
      page.locator('[class*="schedule-timeline"]').or(
        page.locator('[class*="ScheduleTimeline"]')
      )
    );

    // Gateway 未连接提示
    this.gatewayRequired = page.locator('text=/Gateway.*required|需要.*Gateway|Connect.*Gateway/i').or(
      page.locator('[class*="gateway-required"]').or(
        page.locator('[data-testid="gateway-required"]')
      )
    );
  }

  /**
   * 导航到 Schedule 管理页面（需要认证）
   */
  async goto() {
    await this.ensureAuthenticated('member');

    // 直接导航到 Schedule 页面
    await this.page.goto('/schedule');
    await this.page.waitForLoadState('domcontentloaded');

    // 等待页面加载
    await this.page.waitForTimeout(1000);
  }

  /**
   * 获取 Job 数量
   */
  async getJobCount(): Promise<number> {
    return await this.jobCards.count();
  }

  /**
   * 刷新任务列表
   */
  async refreshJobs() {
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
   * 验证任务存在
   */
  async expectJobVisible(name: string) {
    const jobName = this.page.locator(`text="${name}"`);
    await expect(jobName).toBeVisible({ timeout: 5000 });
  }
}
