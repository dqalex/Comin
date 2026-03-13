/**
 * TeamClaw 截图生成脚本（简化版）
 * 
 * 直接使用 Playwright API 生成截图，避免测试框架开销
 */

import { chromium, Browser, Page, BrowserContext } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const SCREENSHOT_DIR = 'docs/screenshots';
const BASE_URL = 'http://localhost:3000';
const AUTH_FILE = 'tests/.auth/user.json';

interface ScreenshotTask {
  name: string;
  path: string;
  url: string;
  fullPage?: boolean;
  setup?: (page: Page) => Promise<void>;
}

const screenshots: ScreenshotTask[] = [
  { name: 'dashboard', path: 'dashboard.png', url: '/dashboard' },
  { name: 'task-board', path: 'task-board.png', url: '/tasks' },
  { 
    name: 'task-drawer', 
    path: 'task-drawer.png', 
    url: '/tasks',
    setup: async (page) => {
      // 等待任务看板加载
      await page.waitForTimeout(4000);
      
      // 尝试多种选择器
      const selectors = [
        '.card.cursor-pointer',
        'div.card.p-3',
        '[class*="card"][class*="cursor-pointer"]'
      ];
      
      for (const selector of selectors) {
        const taskCard = page.locator(selector).first();
        if (await taskCard.isVisible().catch(() => false)) {
          await taskCard.click();
          await page.waitForTimeout(2000);
          break;
        }
      }
    }
  },
  { name: 'wiki-list', path: 'wiki-list.png', url: '/wiki' },
  { name: 'projects', path: 'projects.png', url: '/projects' },
  { name: 'members', path: 'members.png', url: '/members' },
  { name: 'agents', path: 'agents.png', url: '/agents' },
  { name: 'deliveries', path: 'deliveries.png', url: '/deliveries' },
  { name: 'sop-templates', path: 'sop-templates.png', url: '/sop' },
  { name: 'settings', path: 'settings.png', url: '/settings' },
  { name: 'blog', path: 'blog.png', url: '/blog' },
  { name: 'skill-management', path: 'skill-management.png', url: '/skillhub' }, // 修正路由
  // approvals 路由不存在，移除
  { name: 'schedule', path: 'schedule.png', url: '/schedule' },
];

async function waitForStable(page: Page, timeout = 2000) {
  try {
    await page.waitForLoadState('domcontentloaded');
    await page.waitForLoadState('load');
  } catch {
    // 忽略加载状态超时
  }
  await page.waitForTimeout(timeout);
}

async function main() {
  console.log('\n📸 TeamClaw 截图生成器\n');
  
  // 1. 确保截图目录存在
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
  
  // 2. 检查服务器
  console.log('🔍 检查服务器...');
  try {
    const response = await fetch(BASE_URL);
    console.log('  ✅ 服务器已运行\n');
  } catch {
    console.log('  ❌ 服务器未运行！请先运行: npm run dev');
    process.exit(1);
  }
  
  // 3. 启动浏览器
  console.log('🚀 启动浏览器...');
  const browser = await chromium.launch({
    headless: true,
  });
  
  // 检查是否有保存的登录状态
  const hasAuth = fs.existsSync(AUTH_FILE);
  let context: BrowserContext;
  
  if (hasAuth) {
    console.log('  使用已保存的登录状态...');
    context = await browser.newContext({
      storageState: AUTH_FILE,
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 2,
    });
  } else {
    context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 2, // 高清截图
    });
  }
  
  const page = await context.newPage();
  
  // 4. 登录/初始化
  console.log('🔐 处理登录...');
  await page.goto(BASE_URL);
  await waitForStable(page);
  
  // 检查是否需要初始化
  const needsInit = await page.locator('text=创建管理员').isVisible().catch(() => false);
  if (needsInit) {
    console.log('  检测到需要初始化，创建演示账户...');
    
    // 点击"开始配置"按钮
    const getStartedBtn = page.locator('button:has-text("开始配置")');
    if (await getStartedBtn.isVisible()) {
      await getStartedBtn.click();
      await page.waitForTimeout(500);
    }
    
    // 填写表单
    await page.fill('input[placeholder="您的姓名"]', '演示管理员');
    await page.fill('input[placeholder="admin@example.com"]', 'demo@teamclaw.ai');
    await page.fill('input[placeholder="至少 8 位，包含字母和数字"]', 'Demo1234');
    await page.locator('input[type="password"]').nth(1).fill('Demo1234');
    
    // 点击创建按钮
    await page.click('button:has-text("创建管理员账户")');
    
    // 等待完成
    await page.waitForSelector('text=设置完成', { timeout: 30000 });
    await page.click('button:has-text("前往登录")');
    await page.waitForTimeout(1000);
    
    console.log('  ✅ 初始化完成');
  }
  
  // 检查当前页面是否是首页（未登录状态）
  const currentUrl = page.url();
  
  // 检查是否有登录按钮（在导航栏）
  const loginBtn = page.locator('a:has-text("登录"), button:has-text("登录")').first();
  const hasLoginBtn = await loginBtn.isVisible().catch(() => false);
  
  if (hasLoginBtn || currentUrl === BASE_URL + '/' || currentUrl === BASE_URL) {
    console.log('  检测到未登录，执行登录...');
    
    // 尝试通过 API 登录
    const loginResponse = await page.request.post(`${BASE_URL}/api/auth/login`, {
      data: {
        email: 'demo@teamclaw.ai',
        password: 'Demo1234',
      }
    });
    
    if (loginResponse.ok()) {
      console.log('  ✅ API 登录成功');
      // 刷新页面以获取 session
      await page.reload();
      await waitForStable(page);
    } else {
      const loginData = await loginResponse.json();
      console.log(`  ⚠️ API 登录失败: ${loginData.error}`);
      
      // 如果用户不存在，可能需要重新初始化
      if (loginData.error?.includes('Invalid')) {
        console.log('  尝试重新创建账户...');
        await page.goto(`${BASE_URL}/init`);
        await waitForStable(page);
      }
    }
  } else {
    console.log('  ✅ 已登录');
  }
  
  // 验证登录状态
  await page.goto(`${BASE_URL}/dashboard`);
  await waitForStable(page);
  const isOnDashboard = page.url().includes('/dashboard');
  if (!isOnDashboard) {
    console.log('  ⚠️ 登录验证失败，当前 URL:', page.url());
  } else {
    console.log('  ✅ 登录状态验证通过');
  }
  
  // 设置语言为英文（确保所有页面语言一致）
  await page.evaluate(() => {
    localStorage.setItem('teamclaw-language', 'en');
  });
  console.log('  ✅ 语言设置为英文');
  
  // 保存登录状态
  const authDir = path.dirname(AUTH_FILE);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }
  await context.storageState({ path: AUTH_FILE });
  console.log('  ✅ 登录状态已保存');
  
  // 5. 生成截图
  console.log('\n🎬 生成截图...\n');
  
  const results: { name: string; status: string; size?: number }[] = [];
  
  for (const task of screenshots) {
    try {
      process.stdout.write(`  ${task.name}... `);
      
      await page.goto(`${BASE_URL}${task.url}`);
      await waitForStable(page, 3000);
      
      // 执行自定义 setup
      if (task.setup) {
        await task.setup(page);
      }
      
      const screenshotPath = path.join(SCREENSHOT_DIR, task.path);
      await page.screenshot({
        path: screenshotPath,
        fullPage: task.fullPage !== false,
      });
      
      const stats = fs.statSync(screenshotPath);
      const sizeKB = Math.round(stats.size / 1024);
      
      console.log(`✅ (${sizeKB} KB)`);
      results.push({ name: task.name, status: 'success', size: sizeKB });
    } catch (error) {
      console.log(`❌ ${(error as Error).message}`);
      results.push({ name: task.name, status: 'failed' });
    }
  }
  
  // 6. 关闭浏览器
  await browser.close();
  
  // 7. 输出统计
  console.log('\n📊 生成统计:');
  const success = results.filter(r => r.status === 'success');
  const failed = results.filter(r => r.status === 'failed');
  
  console.log(`  ✅ 成功: ${success.length}`);
  console.log(`  ❌ 失败: ${failed.length}`);
  
  if (success.length > 0) {
    console.log('\n📷 生成的截图:');
    success.forEach(r => {
      console.log(`  - ${r.name}.png (${r.size} KB)`);
    });
  }
  
  console.log('\n');
}

main().catch(console.error);
