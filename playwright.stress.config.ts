import { defineConfig, devices } from '@playwright/test';

/**
 * 压力测试 Playwright 配置
 * 
 * 特点：
 * - 更长的超时时间
 * - 更多的重试次数
 * - 输出详细报告
 */
export default defineConfig({
  testDir: './tests/stress',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0, // 压力测试不重试
  workers: 4, // 并发执行
  timeout: 120000, // 2分钟超时
  reporter: [
    ['html', { open: 'never', outputFolder: 'tests/reports/stress-report' }],
    ['json', { outputFile: 'tests/reports/stress-result.json' }],
    ['list'],
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'off', // 压力测试不记录 trace
    screenshot: 'off', // 压力测试不截图
    video: 'off', // 压力测试不录像
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },
  projects: [
    {
      name: 'chromium-stress',
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
