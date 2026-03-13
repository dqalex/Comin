/**
 * TeamClaw 文档截图生成脚本
 * 
 * 用途：自动生成产品文档所需的所有 UI 截图
 * 运行：npx tsx scripts/generate-screenshots.ts
 * 
 * 前置条件：
 * - 开发服务器已启动 (npm run dev)
 * - 演示数据已生成 (npx tsx scripts/generate-demo-data.ts)
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// 截图目录
const SCREENSHOT_DIR = 'docs/screenshots';

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function main() {
  log('\n📸 TeamClaw 文档截图生成器\n', 'blue');
  
  // 1. 检查截图目录
  log('📁 检查截图目录...', 'yellow');
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    log(`  ✅ 创建目录: ${SCREENSHOT_DIR}`, 'green');
  } else {
    log(`  ✅ 目录已存在: ${SCREENSHOT_DIR}`, 'green');
  }

  // 2. 检查开发服务器
  log('\n🔍 检查开发服务器...', 'yellow');
  try {
    const response = fetch('http://localhost:3000');
    log('  ✅ 开发服务器已运行', 'green');
  } catch {
    log('  ❌ 开发服务器未运行！', 'red');
    log('  请先运行: npm run dev', 'yellow');
    process.exit(1);
  }

  // 3. 检查演示数据
  log('\n📊 检查演示数据...', 'yellow');
  const dbPath = 'data/teamclaw.db';
  if (fs.existsSync(dbPath)) {
    log('  ✅ 数据库文件存在', 'green');
    log('  提示: 如需重新生成演示数据，运行: npx tsx scripts/generate-demo-data.ts', 'blue');
  } else {
    log('  ⚠️ 数据库文件不存在，将自动创建', 'yellow');
  }

  // 4. 运行截图测试
  log('\n🎬 开始生成截图...\n', 'yellow');
  
  try {
    execSync(
      'npx playwright test --config=playwright.screenshot.config.ts',
      { 
        stdio: 'inherit',
        cwd: process.cwd()
      }
    );
    
    log('\n✅ 截图生成完成！\n', 'green');
  } catch (error) {
    log('\n❌ 截图生成失败', 'red');
    log('  请检查测试输出了解详情', 'yellow');
    process.exit(1);
  }

  // 5. 列出生成的截图
  log('📷 生成的截图文件:', 'blue');
  const screenshots = fs.readdirSync(SCREENSHOT_DIR)
    .filter(file => file.endsWith('.png'))
    .sort();
  
  if (screenshots.length === 0) {
    log('  未找到截图文件', 'yellow');
  } else {
    screenshots.forEach(file => {
      const filePath = path.join(SCREENSHOT_DIR, file);
      const stats = fs.statSync(filePath);
      const sizeKB = Math.round(stats.size / 1024);
      log(`  - ${file} (${sizeKB} KB)`, 'green');
    });
  }

  // 6. 使用说明
  log('\n📖 如何在文档中使用截图:', 'blue');
  log('  Markdown 格式:', 'reset');
  log('  ![任务看板](./screenshots/task-board.png)', 'yellow');
  log('\n  建议图片大小:', 'reset');
  log('  - 宽度: 800-1200px', 'yellow');
  log('  - 文件大小: < 500KB', 'yellow');
  log('\n  图片优化:', 'reset');
  log('  npx tinypng-cli docs/screenshots/*.png', 'yellow');
}

main();
