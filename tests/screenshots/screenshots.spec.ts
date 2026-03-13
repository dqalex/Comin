/**
 * TeamClaw 文档截图测试
 * 
 * 用途：为产品文档生成 UI 截图
 * 运行：npx tsx scripts/generate-screenshots.ts
 * 
 * 截图保存位置：docs/screenshots/
 */

import { test, expect } from '@playwright/test';
import path from 'path';

// 截图保存目录
const SCREENSHOT_DIR = 'docs/screenshots';

// 辅助函数：生成截图路径
function screenshotPath(name: string): string {
  return path.join(SCREENSHOT_DIR, `${name}.png`);
}

// 辅助函数：等待页面稳定
async function waitForStable(page: any, timeout = 2000) {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(timeout);
}

test.describe('文档截图生成', () => {
  
  test.beforeEach(async ({ page }) => {
    // 确保已登录（使用演示账户）
    await page.goto('/');
    
    // 检查是否需要初始化
    const needsInit = await page.locator('text=创建管理员').isVisible().catch(() => false);
    if (needsInit) {
      // 完成初始化
      await page.fill('input[placeholder*="用户名"]', '演示管理员');
      await page.fill('input[placeholder*="邮箱"]', 'demo@teamclaw.ai');
      await page.fill('input[type="password"]', 'Demo1234');
      await page.click('button:has-text("创建管理员")');
      await page.waitForURL('**/dashboard');
    }
  });

  test('截图：登录页面', async ({ page }) => {
    // 先登出
    await page.goto('/api/auth/logout');
    await page.goto('/');
    await waitForStable(page);
    
    // 截图
    await page.screenshot({ 
      path: screenshotPath('login-page'),
      fullPage: false 
    });
  });

  test('截图：工作台', async ({ page }) => {
    await page.goto('/dashboard');
    await waitForStable(page);
    
    await page.screenshot({ 
      path: screenshotPath('dashboard'),
      fullPage: true 
    });
  });

  test('截图：任务看板', async ({ page }) => {
    await page.goto('/tasks');
    await waitForStable(page, 3000); // 等待看板渲染
    
    await page.screenshot({ 
      path: screenshotPath('task-board'),
      fullPage: true 
    });
  });

  test('截图：任务详情抽屉', async ({ page }) => {
    await page.goto('/tasks');
    await waitForStable(page, 3000);
    
    // 点击第一个任务卡片
    const firstTask = page.locator('[data-testid="task-card"]').first();
    if (await firstTask.isVisible()) {
      await firstTask.click();
      await page.waitForTimeout(1000);
      
      await page.screenshot({ 
        path: screenshotPath('task-drawer'),
        fullPage: false 
      });
    }
  });

  test('截图：文档 Wiki', async ({ page }) => {
    await page.goto('/wiki');
    await waitForStable(page, 2000);
    
    await page.screenshot({ 
      path: screenshotPath('wiki-list'),
      fullPage: true 
    });
  });

  test('截图：文档编辑器', async ({ page }) => {
    await page.goto('/wiki');
    await waitForStable(page, 2000);
    
    // 点击第一个文档
    const firstDoc = page.locator('[data-testid="document-item"]').first();
    if (await firstDoc.isVisible()) {
      await firstDoc.click();
      await page.waitForTimeout(1500);
      
      await page.screenshot({ 
        path: screenshotPath('document-editor'),
        fullPage: true 
      });
    }
  });

  test('截图：项目管理', async ({ page }) => {
    await page.goto('/projects');
    await waitForStable(page);
    
    await page.screenshot({ 
      path: screenshotPath('projects'),
      fullPage: true 
    });
  });

  test('截图：成员管理', async ({ page }) => {
    await page.goto('/members');
    await waitForStable(page);
    
    await page.screenshot({ 
      path: screenshotPath('members'),
      fullPage: true 
    });
  });

  test('截图：SOP 模板列表', async ({ page }) => {
    await page.goto('/sop');
    await waitForStable(page);
    
    await page.screenshot({ 
      path: screenshotPath('sop-templates'),
      fullPage: true 
    });
  });

  test('截图：SOP 进度条', async ({ page }) => {
    await page.goto('/tasks');
    await waitForStable(page, 3000);
    
    // 查找有 SOP 进度的任务
    const sopTask = page.locator('[data-testid="sop-progress"]').first();
    if (await sopTask.isVisible()) {
      await sopTask.click();
      await page.waitForTimeout(1000);
      
      await page.screenshot({ 
        path: screenshotPath('sop-progress'),
        fullPage: false 
      });
    }
  });

  test('截图：交付管理', async ({ page }) => {
    await page.goto('/deliveries');
    await waitForStable(page);
    
    await page.screenshot({ 
      path: screenshotPath('deliveries'),
      fullPage: true 
    });
  });

  test('截图：定时任务', async ({ page }) => {
    await page.goto('/schedule');
    await waitForStable(page);
    
    await page.screenshot({ 
      path: screenshotPath('schedule'),
      fullPage: true 
    });
  });

  test('截图：Agent 管理', async ({ page }) => {
    await page.goto('/agents');
    await waitForStable(page);
    
    await page.screenshot({ 
      path: screenshotPath('agents'),
      fullPage: true 
    });
  });

  test('截图：技能市场', async ({ page }) => {
    await page.goto('/skills');
    await waitForStable(page);
    
    await page.screenshot({ 
      path: screenshotPath('skills-market'),
      fullPage: true 
    });
  });

  test('截图：系统设置', async ({ page }) => {
    await page.goto('/settings');
    await waitForStable(page);
    
    await page.screenshot({ 
      path: screenshotPath('settings'),
      fullPage: true 
    });
  });

  test('截图：用户管理', async ({ page }) => {
    await page.goto('/users');
    await waitForStable(page);
    
    await page.screenshot({ 
      path: screenshotPath('user-management'),
      fullPage: true 
    });
  });

  test('截图：博客页面', async ({ page }) => {
    await page.goto('/blog');
    await waitForStable(page);
    
    await page.screenshot({ 
      path: screenshotPath('blog'),
      fullPage: true 
    });
  });

  test('截图：Skill 管理', async ({ page }) => {
    await page.goto('/skills-management');
    await waitForStable(page);
    
    await page.screenshot({ 
      path: screenshotPath('skill-management'),
      fullPage: true 
    });
  });

  test('截图：审批系统', async ({ page }) => {
    await page.goto('/approvals');
    await waitForStable(page);
    
    await page.screenshot({ 
      path: screenshotPath('approvals'),
      fullPage: true 
    });
  });

  test('截图：聊天面板', async ({ page }) => {
    await page.goto('/tasks');
    await waitForStable(page, 3000);
    
    // 打开聊天面板
    const chatButton = page.locator('[data-testid="chat-fab"]');
    if (await chatButton.isVisible()) {
      await chatButton.click();
      await page.waitForTimeout(1000);
      
      await page.screenshot({ 
        path: screenshotPath('chat-panel'),
        fullPage: false 
      });
    }
  });

  test('截图：侧边栏导航', async ({ page }) => {
    await page.goto('/dashboard');
    await waitForStable(page);
    
    // 截取侧边栏
    const sidebar = page.locator('[data-testid="sidebar"]');
    if (await sidebar.isVisible()) {
      await sidebar.screenshot({ 
        path: screenshotPath('sidebar')
      });
    }
  });

  test('截图：新建任务对话框', async ({ page }) => {
    await page.goto('/tasks');
    await waitForStable(page, 3000);
    
    // 点击新建任务按钮
    const newTaskButton = page.locator('button:has-text("新建任务")');
    if (await newTaskButton.isVisible()) {
      await newTaskButton.click();
      await page.waitForTimeout(500);
      
      await page.screenshot({ 
        path: screenshotPath('new-task-dialog'),
        fullPage: false 
      });
    }
  });

  test('截图：新建文档对话框', async ({ page }) => {
    await page.goto('/wiki');
    await waitForStable(page);
    
    // 点击新建文档按钮
    const newDocButton = page.locator('button:has-text("新建文档")');
    if (await newDocButton.isVisible()) {
      await newDocButton.click();
      await page.waitForTimeout(500);
      
      await page.screenshot({ 
        path: screenshotPath('new-document-dialog'),
        fullPage: false 
      });
    }
  });
});
