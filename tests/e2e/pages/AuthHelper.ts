import { Page, Locator, expect } from '@playwright/test';

/**
 * E2E 认证辅助工具
 *
 * TeamClaw v3.0 使用 Session Cookie 认证：
 * - 登录: POST /api/auth/login { email, password }
 * - 注册: POST /api/auth/register { email, password, name }
 * - 登出: POST /api/auth/logout
 * - 当前用户: GET /api/auth/me
 *
 * 没有独立的登录页面，认证通过 API 完成
 */
export class AuthHelper {
  readonly page: Page;

  // 测试用户凭证
  static readonly TEST_USERS = {
    admin: {
      email: 'e2e-admin@teamclaw.test',
      password: 'TestAdmin123!',
      name: 'E2E 管理员',
    },
    member: {
      email: 'e2e-member@teamclaw.test',
      password: 'TestMember123!',
      name: 'E2E 成员',
    },
  };

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * 通过 API 注册用户
   */
  async register(email: string, password: string, name: string): Promise<{ success: boolean; user?: unknown }> {
    const response = await this.page.request.post('/api/auth/register', {
      headers: { 'Content-Type': 'application/json' },
      data: { email, password, name },
    });

    const data = await response.json();

    if (response.ok()) {
      return { success: true, user: data.user };
    }

    // 用户已存在不算失败
    if (response.status() === 409) {
      return { success: true };
    }

    console.log('[AuthHelper] 注册失败:', data.error);
    return { success: false };
  }

  /**
   * 通过 API 登录
   */
  async login(email: string, password: string): Promise<boolean> {
    const response = await this.page.request.post('/api/auth/login', {
      headers: { 'Content-Type': 'application/json' },
      data: { email, password },
    });

    if (response.ok()) {
      // 登录成功后，刷新页面以获取 session cookie
      return true;
    }

    console.log('[AuthHelper] 登录失败:', await response.text());
    return false;
  }

  /**
   * 快速登录（注册 + 登录）
   *
   * v3.0: 直接通过 API 认证，不需要 UI 页面
   */
  async quickLogin(role: 'admin' | 'member' = 'member'): Promise<boolean> {
    const user = AuthHelper.TEST_USERS[role];

    // 先尝试登录
    const loginSuccess = await this.login(user.email, user.password);
    if (loginSuccess) {
      // 验证登录状态
      const me = await this.page.request.get('/api/auth/me');
      if (me.ok()) {
        return true;
      }
    }

    // 登录失败，尝试注册
    await this.register(user.email, user.password, user.name);

    // 再次尝试登录
    const retrySuccess = await this.login(user.email, user.password);
    if (retrySuccess) {
      // 验证登录状态
      const me = await this.page.request.get('/api/auth/me');
      return me.ok();
    }

    return false;
  }

  /**
   * 通过 API 登出
   */
  async logout(): Promise<void> {
    await this.page.request.post('/api/auth/logout');

    // 等待登出完成
    await this.page.waitForTimeout(500);
  }

  /**
   * 检查是否已登录（通过 API 验证）
   */
  async isLoggedIn(): Promise<boolean> {
    try {
      const response = await this.page.request.get('/api/auth/me');
      if (response.ok()) {
        const data = await response.json();
        return !!data.user;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * 获取当前用户信息
   */
  async getCurrentUser(): Promise<unknown | null> {
    try {
      const response = await this.page.request.get('/api/auth/me');
      if (response.ok()) {
        const data = await response.json();
        return data.user;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * 确保已登录（在测试 beforeEach 中调用）
   *
   * 流程：
   * 1. 检查当前登录状态
   * 2. 如果未登录，尝试 quickLogin
   * 3. 导航到受保护页面验证
   */
  async ensureLoggedIn(role: 'admin' | 'member' = 'member'): Promise<void> {
    // 检查是否已登录
    const loggedIn = await this.isLoggedIn();

    if (!loggedIn) {
      // 尝试登录
      const success = await this.quickLogin(role);

      if (!success) {
        throw new Error(`无法登录测试用户: ${role}`);
      }
    }

    // 导航到一个受保护页面以确保 session cookie 生效
    // 这是 Playwright 的特殊行为：API 请求设置的 cookie 需要通过页面访问来激活
    await this.page.goto('/dashboard');
    await this.page.waitForLoadState('domcontentloaded');

    // 等待侧边栏出现，确认页面已加载
    try {
      await this.page.waitForSelector('nav, [role="navigation"], [data-testid="sidebar"]', { timeout: 10000 });
    } catch {
      // 如果侧边栏没有出现，可能是跳转到了其他页面
    }

    // 再次验证登录状态
    const user = await this.getCurrentUser();
    if (!user) {
      throw new Error('登录后仍无法获取用户信息');
    }
  }
}
