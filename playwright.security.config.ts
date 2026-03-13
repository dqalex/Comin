import { defineConfig, devices } from '@playwright/test';

/**
 * 安全测试 Playwright 配置
 * 
 * 特点：
 * - 完整的 trace 和截图记录
 * - 详细日志输出
 * - 不重试（安全测试需要精确结果）
 */
export default defineConfig({
  testDir: './tests/security',
  fullyParallel: false, // 安全测试串行执行，避免干扰
  forbidOnly: !!process.env.CI,
  retries: 0, // 安全测试不重试
  workers: 1, // 单线程执行
  timeout: 60000, // 1分钟超时
  reporter: [
    ['html', { open: 'never', outputFolder: 'tests/reports/security-report' }],
    ['json', { outputFile: 'tests/reports/security-result.json' }],
    ['list'],
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on', // 安全测试记录完整 trace
    screenshot: 'on', // 安全测试截图
    video: 'on', // 安全测试录像
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },
  projects: [
    {
      name: 'chromium-security',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'PLAYWRIGHT_TEST=true npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
