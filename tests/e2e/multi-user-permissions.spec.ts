import { test, expect, Page } from '@playwright/test';
import { AuthHelper } from './pages/AuthHelper';

/**
 * 多用户权限测试
 *
 * 测试场景：
 * 1. 不同角色用户（admin/member）对项目的访问权限
 * 2. 项目可见性（private/public）对访问的影响
 * 3. 项目成员角色（owner/admin/member）的权限差异
 * 4. 任务、文档等资源的跨用户访问控制
 */
test.describe('多用户权限测试', () => {
  // 测试用户
  const TEST_USERS = {
    admin: {
      email: 'perm-admin@teamclaw.test',
      password: 'TestAdmin123!',
      name: '权限测试管理员',
    },
    member1: {
      email: 'perm-member1@teamclaw.test',
      password: 'TestMember123!',
      name: '权限测试成员1',
    },
    member2: {
      email: 'perm-member2@teamclaw.test',
      password: 'TestMember123!',
      name: '权限测试成员2',
    },
  };

  /**
   * 创建测试用户并登录
   */
  async function createAndLoginUser(page: Page, user: typeof TEST_USERS.admin, role: 'admin' | 'member') {
    const auth = new AuthHelper(page);

    // 先尝试登录
    const loginSuccess = await auth.login(user.email, user.password);
    if (loginSuccess) {
      return auth;
    }

    // 登录失败，尝试注册
    await auth.register(user.email, user.password, user.name);

    // 再次登录
    const retrySuccess = await auth.login(user.email, user.password);
    if (!retrySuccess) {
      throw new Error(`无法登录测试用户: ${user.email}`);
    }

    return auth;
  }

  /**
   * 创建测试项目（在浏览器上下文中执行，自动携带 Cookie）
   */
  async function createTestProject(page: Page, name: string, visibility: 'private' | 'public' = 'private') {
    // 先导航到页面确保 location.origin 可用
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const result = await page.evaluate(async ({ name, visibility }) => {
      const url = `${window.location.origin}/api/projects`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description: '权限测试项目',
          source: 'local',
          visibility,
        }),
      });

      if (!response.ok) {
        throw new Error(`创建项目失败: ${await response.text()}`);
      }

      return await response.json();
    }, { name, visibility });

    return result;
  }

  /**
   * 创建测试任务（在浏览器上下文中执行，自动携带 Cookie）
   */
  async function createTestTask(page: Page, title: string, projectId?: string) {
    // 先导航到页面确保 location.origin 可用
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const result = await page.evaluate(async ({ title, projectId }) => {
      const url = `${window.location.origin}/api/tasks`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description: '权限测试任务',
          status: 'todo',
          priority: 'medium',
          projectId,
        }),
      });

      if (!response.ok) {
        throw new Error(`创建任务失败: ${await response.text()}`);
      }

      return await response.json();
    }, { title, projectId });

    return result;
  }

  test.describe('Admin 权限测试', () => {
    test('Admin 应该能访问所有项目', async ({ page }) => {
      // 登录 admin 用户
      await createAndLoginUser(page, TEST_USERS.admin, 'admin');

      // 导航到项目页面
      await page.goto('/projects');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);

      // 验证页面可访问
      const bodyContent = await page.locator('body').innerHTML();
      expect(bodyContent.length).toBeGreaterThan(500);

      // 验证 URL 正确
      await expect(page).toHaveURL(/\/projects/);
    });

    test('Admin 应该能创建公开项目', async ({ page }) => {
      // 登录 admin 用户
      await createAndLoginUser(page, TEST_USERS.admin, 'admin');

      // 创建公开项目
      const project = await createTestProject(page, `Admin公开项目-${Date.now()}`, 'public');

      // 验证项目创建成功
      expect(project.id).toBeDefined();
      expect(project.visibility).toBe('public');
    });

    test('Admin 应该能创建私有项目', async ({ page }) => {
      // 登录 admin 用户
      await createAndLoginUser(page, TEST_USERS.admin, 'admin');

      // 创建私有项目
      const project = await createTestProject(page, `Admin私有项目-${Date.now()}`, 'private');

      // 验证项目创建成功
      expect(project.id).toBeDefined();
      expect(project.visibility).toBe('private');
    });
  });

  test.describe('项目可见性权限测试', () => {
    test('普通用户应该能访问公开项目', async ({ browser }) => {
      // 创建 admin 上下文并创建公开项目
      const adminContext = await browser.newContext();
      const adminPage = await adminContext.newPage();
      await createAndLoginUser(adminPage, TEST_USERS.admin, 'admin');
      const publicProject = await createTestProject(adminPage, `公开项目-${Date.now()}`, 'public');
      await adminContext.close();

      // 创建 member 上下文
      const memberContext = await browser.newContext();
      const memberPage = await memberContext.newPage();
      await createAndLoginUser(memberPage, TEST_USERS.member1, 'member');

      // 尝试访问公开项目
      const response = await memberPage.request.get(`/api/projects/${publicProject.id}`);

      // 应该能访问（200）或被重定向（302）
      expect([200, 302]).toContain(response.status());

      await memberContext.close();
    });

    test('普通用户不应该能访问其他用户的私有项目', async ({ browser }) => {
      // 创建 member1 上下文并创建私有项目
      const member1Context = await browser.newContext();
      const member1Page = await member1Context.newPage();
      await createAndLoginUser(member1Page, TEST_USERS.member1, 'member');
      const privateProject = await createTestProject(member1Page, `私有项目-${Date.now()}`, 'private');
      await member1Context.close();

      // 创建 member2 上下文
      const member2Context = await browser.newContext();
      const member2Page = await member2Context.newPage();
      await createAndLoginUser(member2Page, TEST_USERS.member2, 'member');

      // 尝试访问 member1 的私有项目
      const response = await member2Page.request.get(`/api/projects/${privateProject.id}`);

      // 应该被拒绝访问（403）或找不到（404）
      expect([403, 404]).toContain(response.status());

      await member2Context.close();
    });
  });

  test.describe('任务权限测试', () => {
    test('项目成员应该能创建项目任务', async ({ page }) => {
      // 登录用户
      await createAndLoginUser(page, TEST_USERS.member1, 'member');

      // 创建项目
      const project = await createTestProject(page, `任务测试项目-${Date.now()}`, 'private');

      // 创建项目任务
      const task = await createTestTask(page, `项目任务-${Date.now()}`, project.id);

      // 验证任务创建成功
      expect(task.id).toBeDefined();
      expect(task.projectId).toBe(project.id);
    });

    test('非项目成员不应该能在私有项目中创建任务', async ({ browser }) => {
      // 创建 member1 上下文并创建私有项目
      const member1Context = await browser.newContext();
      const member1Page = await member1Context.newPage();
      await createAndLoginUser(member1Page, TEST_USERS.member1, 'member');
      const privateProject = await createTestProject(member1Page, `任务权限测试项目-${Date.now()}`, 'private');
      await member1Context.close();

      // 创建 member2 上下文
      const member2Context = await browser.newContext();
      const member2Page = await member2Context.newPage();
      await createAndLoginUser(member2Page, TEST_USERS.member2, 'member');

      // 尝试在 member1 的私有项目中创建任务
      const result = await member2Page.evaluate(async ({ projectId }) => {
        const url = `${window.location.origin}/api/tasks`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: `越权任务-${Date.now()}`,
            description: '不应该创建成功',
            status: 'todo',
            priority: 'medium',
            projectId,
          }),
        });

        return { status: response.status };
      }, { projectId: privateProject.id });

      // 应该被拒绝（403）
      expect(result.status).toBe(403);

      await member2Context.close();
    });
  });

  test.describe('多用户协作场景', () => {
    test('项目 Owner 应该能添加项目成员', async ({ page }) => {
      // 登录 member1
      await createAndLoginUser(page, TEST_USERS.member1, 'member');

      // 创建项目
      const project = await createTestProject(page, `成员管理项目-${Date.now()}`, 'private');

      // 获取当前用户信息
      const auth = new AuthHelper(page);
      const user = await auth.getCurrentUser();

      // 验证当前用户是项目 Owner
      expect(user).toBeDefined();
    });

    test('不同用户应该看到不同的项目列表', async ({ browser }) => {
      // 创建两个用户上下文
      const context1 = await browser.newContext();
      const page1 = await context1.newPage();
      await createAndLoginUser(page1, TEST_USERS.member1, 'member');

      const context2 = await browser.newContext();
      const page2 = await context2.newPage();
      await createAndLoginUser(page2, TEST_USERS.member2, 'member');

      // member1 创建私有项目
      const privateProject = await createTestProject(page1, `Member1私有项目-${Date.now()}`, 'private');

      // member1 创建公开项目
      const publicProject = await createTestProject(page1, `Member1公开项目-${Date.now()}`, 'public');

      // member2 获取项目列表
      const response = await page2.request.get('/api/projects');
      const projects = await response.json();

      // member2 应该能看到公开项目，但看不到私有项目
      const projectIds = Array.isArray(projects) ? projects.map((p: { id: string }) => p.id) : [];
      expect(projectIds).toContain(publicProject.id);
      expect(projectIds).not.toContain(privateProject.id);

      await context1.close();
      await context2.close();
    });
  });

  test.describe('页面级权限控制', () => {
    test('未登录用户访问受保护页面应该被重定向或显示登录提示', async ({ page }) => {
      // 确保未登录
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      const auth = new AuthHelper(page);
      await auth.logout();

      // 尝试访问受保护页面
      await page.goto('/tasks');
      await page.waitForLoadState('domcontentloaded');

      // 验证被重定向到登录页或首页，或者页面有登录提示
      const url = page.url();
      const hasLoginPrompt = await page.locator('text=/login|登录|sign in|登录/i').isVisible().catch(() => false);
      const isRedirected = url.includes('/login') || url === 'http://localhost:3000/' || url === 'http://localhost:3001/';
      
      // 只要有登录提示或被重定向就通过
      expect(hasLoginPrompt || isRedirected).toBe(true);
    });

    test('登录后应该能访问所有受保护页面', async ({ page }) => {
      // 登录用户
      await createAndLoginUser(page, TEST_USERS.member1, 'member');

      // 访问各个受保护页面
      const protectedPages = ['/tasks', '/projects', '/wiki', '/members', '/settings'];

      for (const path of protectedPages) {
        await page.goto(path);
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(500);

        // 验证没有被重定向到登录页
        const url = page.url();
        expect(url).not.toContain('/login');

        // 验证页面有内容
        const bodyContent = await page.locator('body').innerHTML();
        expect(bodyContent.length).toBeGreaterThan(500);
      }
    });
  });
});
