import { Page, Locator, expect } from '@playwright/test';
import { AuthHelper } from './AuthHelper';

/**
 * 基础页面类 - 所有 Page Object 的父类
 * 
 * v3.0 支持认证系统
 */
export class BasePage {
  readonly page: Page;
  readonly auth: AuthHelper;
  private _isLoggedIn: boolean = false;

  constructor(page: Page) {
    this.page = page;
    this.auth = new AuthHelper(page);
  }

  /**
   * 确保已登录（在 beforeEach 中调用）
   */
  async ensureAuthenticated(role: 'admin' | 'member' = 'member') {
    if (!this._isLoggedIn) {
      await this.auth.ensureLoggedIn(role);
      this._isLoggedIn = true;
    }
  }

  /**
   * 导航到指定路径
   */
  async goto(path: string = '/') {
    await this.page.goto(path);
  }

  /**
   * 导航到受保护页面（自动处理登录）
   */
  async gotoProtected(path: string, role: 'admin' | 'member' = 'member') {
    await this.ensureAuthenticated(role);
    await this.page.goto(path);
    await this.waitForLoad();
  }

  /**
   * 等待页面加载完成
   * 注意：不使用 networkidle，因为页面可能有持续的 WebSocket 连接
   */
  async waitForLoad() {
    await this.page.waitForLoadState('domcontentloaded');
    // 额外等待一下让 React 渲染完成
    await this.page.waitForTimeout(500);
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

  /**
   * 等待 API 响应
   */
  async waitForApiResponse(endpoint: string, method: string = 'GET') {
    await this.page.waitForResponse(resp =>
      resp.url().includes(endpoint) && resp.request().method() === method
    );
  }

  /**
   * 检查是否在登录页
   */
  async isOnLoginPage(): Promise<boolean> {
    return this.page.url().includes('/login');
  }

  /**
   * 检查是否已登录（检查是否在受保护页面）
   */
  async checkLoggedIn(): Promise<boolean> {
    const url = this.page.url();
    // 如果在登录页，则未登录
    if (url.includes('/login')) {
      return false;
    }
    // 检查是否有侧边栏（登录后才有）
    const sidebar = this.page.locator('[data-testid="sidebar"]');
    return await sidebar.isVisible({ timeout: 2000 }).catch(() => false);
  }
}
