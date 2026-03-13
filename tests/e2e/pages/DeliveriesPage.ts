import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * 投递管理页面 Page Object
 *
 * v3.0 支持认证系统
 *
 * 投递管理功能：
 * - 查看投递列表
 * - 审核投递（批准/拒绝/需要修订）
 * - 筛选投递（按状态/平台）
 */
export class DeliveriesPage extends BasePage {
  readonly deliveryList: Locator;
  readonly statusFilter: Locator;
  readonly platformFilter: Locator;
  readonly pendingTab: Locator;
  readonly approvedTab: Locator;
  readonly rejectedTab: Locator;
  readonly deliveryCards: Locator;
  readonly approveButton: Locator;
  readonly rejectButton: Locator;
  readonly revisionButton: Locator;

  constructor(page: Page) {
    super(page);

    // 投递列表容器
    this.deliveryList = page.locator('[data-testid="delivery-list"]').or(
      page.locator('[class*="delivery-list"]').or(
        page.locator('main')
      )
    );

    // 状态筛选器
    this.statusFilter = page.locator('select[name="status"]').or(
      page.locator('[data-testid="status-filter"]').or(
        page.locator('button:has-text("All")').or(
          page.locator('button:has-text("全部")')
        )
      )
    );

    // 平台筛选器
    this.platformFilter = page.locator('select[name="platform"]').or(
      page.locator('[data-testid="platform-filter"]')
    );

    // 状态标签页
    this.pendingTab = page.locator('button:has-text("Pending")').or(
      page.locator('button:has-text("待审核")')
    );
    this.approvedTab = page.locator('button:has-text("Approved")').or(
      page.locator('button:has-text("已批准")')
    );
    this.rejectedTab = page.locator('button:has-text("Rejected")').or(
      page.locator('button:has-text("已拒绝")')
    );

    // 投递卡片
    this.deliveryCards = page.locator('[data-testid="delivery-card"]').or(
      page.locator('[class*="delivery-card"]').or(
        page.locator('[class*="DeliveryCard"]')
      )
    );

    // 审核按钮
    this.approveButton = page.locator('button:has-text("Approve")').or(
      page.locator('button:has-text("批准")').or(
        page.locator('button:has-text("通过")')
      )
    );
    this.rejectButton = page.locator('button:has-text("Reject")').or(
      page.locator('button:has-text("拒绝")').or(
        page.locator('button:has-text("驳回")')
      )
    );
    this.revisionButton = page.locator('button:has-text("Revision")').or(
      page.locator('button:has-text("修订")').or(
        page.locator('button:has-text("需要修改")')
      )
    );
  }

  /**
   * 导航到投递管理页面（需要认证）
   */
  async goto() {
    await this.ensureAuthenticated('member');

    // 直接导航到投递页面
    await this.page.goto('/deliveries');
    await this.page.waitForLoadState('domcontentloaded');

    // 等待页面加载
    await this.page.waitForTimeout(1000);
  }

  /**
   * 获取投递卡片数量
   */
  async getDeliveryCount(): Promise<number> {
    return await this.deliveryCards.count();
  }

  /**
   * 点击投递卡片
   */
  async clickDelivery(title: string) {
    await this.deliveryCards.filter({ hasText: title }).click();
  }

  /**
   * 批准投递
   */
  async approveDelivery(deliveryId: string) {
    const card = this.deliveryCards.filter({ has: this.page.locator(`text="${deliveryId}"`) });
    await card.locator(this.approveButton).click();

    // 等待 API 响应
    await this.page.waitForResponse(resp =>
      resp.url().includes('/api/deliveries') && resp.request().method() === 'PUT',
      { timeout: 10000 }
    ).catch(() => {});

    await this.page.waitForTimeout(500);
  }

  /**
   * 拒绝投递
   */
  async rejectDelivery(deliveryId: string) {
    const card = this.deliveryCards.filter({ has: this.page.locator(`text="${deliveryId}"`) });
    await card.locator(this.rejectButton).click();

    // 等待 API 响应
    await this.page.waitForResponse(resp =>
      resp.url().includes('/api/deliveries') && resp.request().method() === 'PUT',
      { timeout: 10000 }
    ).catch(() => {});

    await this.page.waitForTimeout(500);
  }

  /**
   * 筛选投递状态
   */
  async filterByStatus(status: string) {
    if (status === 'pending') {
      await this.pendingTab.click();
    } else if (status === 'approved') {
      await this.approvedTab.click();
    } else if (status === 'rejected') {
      await this.rejectedTab.click();
    }
    await this.page.waitForTimeout(500);
  }

  /**
   * 验证投递存在
   */
  async expectDeliveryVisible(title: string) {
    const deliveryTitle = this.page.locator(`text="${title}"`);
    await expect(deliveryTitle).toBeVisible({ timeout: 5000 });
  }
}
