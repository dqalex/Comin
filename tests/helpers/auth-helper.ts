/**
 * 认证辅助工具 (v3.0)
 *
 * 提供用户注册、登录、Session 管理等功能的测试辅助方法。
 * 支持 TeamClaw v3.0 的认证系统。
 *
 * 使用方式：
 * ```ts
 * import { AuthHelper } from '@/tests/helpers/auth-helper';
 *
 * const auth = new AuthHelper();
 * await auth.setup(); // 注册并登录测试用户
 * const headers = auth.getAuthHeaders(); // 获取认证头
 * ```
 */

import { apiPost, apiGet } from './api-client';
import type { ApiResponse } from './api-client';

/** 测试用户配置 */
export interface TestUserConfig {
  email: string;
  password: string;
  name: string;
  role?: 'admin' | 'member' | 'viewer';
}

/** 用户信息 */
export interface UserInfo {
  id: string;
  email: string;
  name: string;
  role: string;
  avatar?: string | null;
}

/** 认证状态 */
export interface AuthState {
  user: UserInfo | null;
  sessionCookie: string | null;
  isAuthenticated: boolean;
}

/** 预定义的测试用户 */
export const TEST_USERS = {
  admin: {
    email: 'test-admin@teamclaw.test',
    password: 'TestAdmin123!',
    name: '测试管理员',
    role: 'admin' as const,
  },
  member: {
    email: 'test-member@teamclaw.test',
    password: 'TestMember123!',
    name: '测试成员',
    role: 'member' as const,
  },
  viewer: {
    email: 'test-viewer@teamclaw.test',
    password: 'TestViewer123!',
    name: '测试观察者',
    role: 'viewer' as const,
  },
};

/**
 * 认证辅助类
 */
export class AuthHelper {
  private state: AuthState = {
    user: null,
    sessionCookie: null,
    isAuthenticated: false,
  };

  private userConfig: TestUserConfig;
  private registered: boolean = false;

  constructor(userConfig: TestUserConfig = TEST_USERS.member) {
    // 为每个测试实例生成唯一的邮箱地址
    const uniqueId = Date.now().toString(36);
    this.userConfig = {
      ...userConfig,
      email: userConfig.email.replace('@teamclaw.test', `-${uniqueId}@teamclaw.test`),
    };
  }

  /**
   * 获取测试用户配置
   */
  getUserConfig(): TestUserConfig {
    return this.userConfig;
  }

  /**
   * 设置认证（注册 + 登录）
   */
  async setup(): Promise<AuthState> {
    // 尝试注册
    await this.register();

    // 登录获取 session
    await this.login();

    return this.state;
  }

  /**
   * 注册用户
   */
  async register(): Promise<ApiResponse> {
    const res = await apiPost('/api/auth/register', {
      email: this.userConfig.email,
      password: this.userConfig.password,
      name: this.userConfig.name,
    });

    if (res.ok || res.status === 409) {
      // 成功或用户已存在
      this.registered = true;
      if (res.ok) {
        this.state.user = (res.data as { user: UserInfo }).user;
      }
    }

    return res;
  }

  /**
   * 登录获取 Session
   */
  async login(): Promise<ApiResponse> {
    const res = await apiPost('/api/auth/login', {
      email: this.userConfig.email,
      password: this.userConfig.password,
    });

    if (res.ok) {
      // 提取 session cookie
      const setCookie = res.headers.get('set-cookie');
      if (setCookie) {
        const match = setCookie.match(/cms_session=([^;]+)/);
        if (match) {
          this.state.sessionCookie = match[1];
          this.state.isAuthenticated = true;
        }
      }

      // 提取用户信息
      const data = res.data as { user?: UserInfo };
      if (data.user) {
        this.state.user = data.user;
      }
    }

    return res;
  }

  /**
   * 登出
   */
  async logout(): Promise<void> {
    if (!this.state.sessionCookie) return;

    await apiPost('/api/auth/logout', {}, {
      headers: this.getAuthHeaders(),
    });

    this.state.sessionCookie = null;
    this.state.isAuthenticated = false;
  }

  /**
   * 获取当前用户信息
   */
  async getCurrentUser(): Promise<UserInfo | null> {
    if (!this.state.sessionCookie) return null;

    const res = await apiGet('/api/auth/me', {
      headers: this.getAuthHeaders(),
    });

    if (res.ok) {
      this.state.user = res.data as UserInfo;
      return this.state.user;
    }

    return null;
  }

  /**
   * 获取认证头
   */
  getAuthHeaders(): { Cookie: string } {
    if (!this.state.sessionCookie) {
      throw new Error('未登录，请先调用 setup() 或 login()');
    }
    return { Cookie: `cms_session=${this.state.sessionCookie}` };
  }

  /**
   * 获取 Session Cookie
   */
  getSessionCookie(): string | null {
    return this.state.sessionCookie;
  }

  /**
   * 获取用户信息
   */
  getUser(): UserInfo | null {
    return this.state.user;
  }

  /**
   * 是否已认证
   */
  isAuthenticated(): boolean {
    return this.state.isAuthenticated;
  }

  /**
   * 获取认证状态
   */
  getState(): AuthState {
    return { ...this.state };
  }
}

/**
 * 创建管理员认证辅助
 */
export function createAdminAuth(): AuthHelper {
  return new AuthHelper(TEST_USERS.admin);
}

/**
 * 创建成员认证辅助
 */
export function createMemberAuth(): AuthHelper {
  return new AuthHelper(TEST_USERS.member);
}

/**
 * 创建观察者认证辅助
 */
export function createViewerAuth(): AuthHelper {
  return new AuthHelper(TEST_USERS.viewer);
}

/**
 * 快速设置认证（单行调用）
 */
export async function setupAuth(role: 'admin' | 'member' | 'viewer' = 'member'): Promise<AuthHelper> {
  const configs = {
    admin: TEST_USERS.admin,
    member: TEST_USERS.member,
    viewer: TEST_USERS.viewer,
  };

  const auth = new AuthHelper(configs[role]);
  await auth.setup();
  return auth;
}
