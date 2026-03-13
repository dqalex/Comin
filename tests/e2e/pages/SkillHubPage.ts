import { Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * SkillHub 页面 Page Object
 *
 * 页面路径：
 * - /skillhub - 列表页
 * - /skillhub/[id] - 详情页
 * - /skillhub/create - 创建页
 * - /skillhub/risk-alerts - 风险报告页（管理员）
 */
export class SkillHubPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  /**
   * 导航到 SkillHub 列表页
   */
  async gotoList() {
    await this.ensureAuthenticated('member');
    await this.page.goto('/skillhub');
    await this.waitForLoad();
  }

  /**
   * 导航到 SkillHub 详情页
   */
  async gotoDetail(skillId: string) {
    await this.ensureAuthenticated('member');
    await this.page.goto(`/skillhub/${skillId}`);
    await this.waitForLoad();
  }

  /**
   * 导航到 SkillHub 创建页
   */
  async gotoCreate() {
    await this.ensureAuthenticated('member');
    await this.page.goto('/skillhub/create');
    await this.waitForLoad();
  }

  /**
   * 导航到风险报告页（需要管理员权限）
   */
  async gotoRiskAlerts() {
    await this.ensureAuthenticated('admin');
    await this.page.goto('/skillhub/risk-alerts');
    await this.waitForLoad();
  }
}
