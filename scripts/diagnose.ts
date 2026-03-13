#!/usr/bin/env tsx
/**
 * 项目诊断脚本
 * 自动检测项目问题并生成优化建议
 * 
 * 用法: npx tsx scripts/diagnose.ts
 */

import { execSync } from 'child_process';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// 诊断结果接口
interface DiagnosticResult {
  timestamp: string;
  p0: {
    buildErrors: number;
    typeErrors: number;
    lintErrors: number;
    securityVulnerabilities: number;
  };
  p1: {
    testFailures: number;
    testTotal: number;
    testPassRate: number;
    techDebtP1: number;
  };
  p2: {
    filesOverLimit: Array<{ path: string; lines: number }>;
    useMemoMissing: number;
    techDebtP2: number;
  };
  p3: {
    i18nMissingNamespace: number;
    techDebtP3: number;
  };
  recommendations: string[];
}

const ROOT_DIR = process.cwd();
const LOGS_DIR = join(ROOT_DIR, 'logs');

function ensureLogsDir() {
  if (!existsSync(LOGS_DIR)) {
    mkdirSync(LOGS_DIR, { recursive: true });
  }
}

function runCommand(cmd: string, defaultValue = ''): string {
  try {
    return execSync(cmd, { 
      encoding: 'utf-8', 
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 60000 
    }).toString();
  } catch (error: unknown) {
    const execError = error as { stdout?: string; stderr?: string };
    return execError.stdout || execError.stderr || defaultValue;
  }
}

function countLines(filePath: string): number {
  try {
    const result = runCommand(`wc -l < "${filePath}"`);
    return parseInt(result.trim(), 10) || 0;
  } catch {
    return 0;
  }
}

function diagnose(): DiagnosticResult {
  const timestamp = new Date().toISOString();
  console.log('🔍 开始项目诊断...\n');

  // P0: 构建检查
  console.log('📋 P0 检查（阻塞性问题）...');
  
  let buildErrors = 0;
  let typeErrors = 0;
  let lintErrors = 0;
  
  // 类型检查（比完整构建更快）
  console.log('  检查类型错误...');
  const typeOutput = runCommand('npx tsc --noEmit 2>&1');
  typeErrors = (typeOutput.match(/error TS\d+/g) || []).length;
  console.log(`    类型错误: ${typeErrors}`);

  // Lint 检查
  console.log('  检查 Lint 错误...');
  const lintOutput = runCommand('npm run lint 2>&1');
  const lintErrorMatch = lintOutput.match(/(\d+) error/);
  const lintWarningMatch = lintOutput.match(/(\d+) warning/);
  lintErrors = lintErrorMatch ? parseInt(lintErrorMatch[1], 10) : 0;
  const lintWarnings = lintWarningMatch ? parseInt(lintWarningMatch[1], 10) : 0;
  console.log(`    Lint 错误: ${lintErrors}, 警告: ${lintWarnings}`);

  // 安全漏洞检查（简化版）
  console.log('  检查安全漏洞...');
  const auditOutput = runCommand('npm audit --json 2>/dev/null');
  let securityVulnerabilities = 0;
  try {
    const audit = JSON.parse(auditOutput || '{}');
    securityVulnerabilities = (audit.metadata?.vulnerabilities?.total || 0);
  } catch {
    // 解析失败，默认为 0
  }
  console.log(`    安全漏洞: ${securityVulnerabilities}`);

  // P1: 核心质量
  console.log('\n📋 P1 检查（核心质量）...');
  
  console.log('  检查测试结果...');
  const testOutput = runCommand('npm test -- --passWithNoTests --reporter=json 2>&1');
  let testFailures = 0;
  let testTotal = 0;
  let testPassRate = 100;
  
  try {
    // 尝试解析测试结果
    const testMatch = testOutput.match(/"numFailedTests"\s*:\s*(\d+)/);
    const totalMatch = testOutput.match(/"numTotalTests"\s*:\s*(\d+)/);
    if (testMatch && totalMatch) {
      testFailures = parseInt(testMatch[1], 10);
      testTotal = parseInt(totalMatch[1], 10);
      testPassRate = testTotal > 0 ? ((testTotal - testFailures) / testTotal * 100) : 100;
    }
  } catch {
    // 解析失败
  }
  console.log(`    测试: ${testTotal - testFailures}/${testTotal} 通过 (${testPassRate.toFixed(1)}%)`);

  // 技术债统计
  console.log('  检查技术债...');
  const techDebtContent = runCommand('cat docs/process/TECH_DEBT.md 2>/dev/null');
  const techDebtP1 = (techDebtContent.match(/\*\*优先级\*\*：P1\n\*\*状态\*\*：open/g) || []).length;
  const techDebtP2 = (techDebtContent.match(/\*\*优先级\*\*：P2\n\*\*状态\*\*：open/g) || []).length;
  const techDebtP3 = (techDebtContent.match(/\*\*优先级\*\*：P3\n\*\*状态\*\*：open/g) || []).length;
  console.log(`    技术债: P1=${techDebtP1}, P2=${techDebtP2}, P3=${techDebtP3}`);

  // P2: 性能优化
  console.log('\n📋 P2 检查（性能优化）...');
  
  // 大文件检查
  console.log('  检查文件行数...');
  const largeFilesOutput = runCommand(
    'find . -name "*.ts" -o -name "*.tsx" 2>/dev/null | grep -v node_modules | grep -v ".next" | xargs wc -l 2>/dev/null | awk \'$1 > 800 {print $0}\''
  );
  const filesOverLimit = largeFilesOutput
    .split('\n')
    .filter(line => line.trim() && !line.includes('total'))
    .map(line => {
      const parts = line.trim().split(/\s+/);
      return {
        path: parts.slice(1).join(' '),
        lines: parseInt(parts[0], 10) || 0
      };
    })
    .filter(f => f.path);
  console.log(`    文件超过 800 行: ${filesOverLimit.length} 个`);
  filesOverLimit.forEach(f => console.log(`      - ${f.path}: ${f.lines} 行`));

  // useMemo 检查
  console.log('  检查 useMemo 使用...');
  const useMemoOutput = runCommand(
    'grep -rn "\\.map(\\|\\.filter(\\|\\.sort(" --include="*.tsx" components/ app/ 2>/dev/null | grep -v "useMemo\\|components/ui/" | wc -l'
  );
  const useMemoMissing = parseInt(useMemoOutput.trim(), 10) || 0;
  console.log(`    派生计算未使用 useMemo: ${useMemoMissing} 处`);

  // P3: 代码质量
  console.log('\n📋 P3 检查（代码质量）...');
  
  // i18n 命名空间检查
  console.log('  检查 i18n 命名空间...');
  const i18nOutput = runCommand(
    'grep -rn "useTranslation()" --include="*.tsx" app/ components/ 2>/dev/null | wc -l'
  );
  const i18nMissingNamespace = parseInt(i18nOutput.trim(), 10) || 0;
  console.log(`    useTranslation() 未指定命名空间: ${i18nMissingNamespace} 处`);

  // 生成建议
  const recommendations: string[] = [];
  
  if (typeErrors > 0) {
    recommendations.push(`修复 ${typeErrors} 个 TypeScript 类型错误`);
  }
  if (lintErrors > 0) {
    recommendations.push(`修复 ${lintErrors} 个 ESLint 错误`);
  }
  if (securityVulnerabilities > 0) {
    recommendations.push(`修复 ${securityVulnerabilities} 个安全漏洞`);
  }
  if (testFailures > 0) {
    recommendations.push(`修复 ${testFailures} 个失败的测试用例`);
  }
  if (techDebtP1 > 0) {
    recommendations.push(`解决 ${techDebtP1} 个 P1 级技术债`);
  }
  if (filesOverLimit.length > 0) {
    recommendations.push(`拆分 ${filesOverLimit.length} 个超过 800 行的文件`);
  }
  if (useMemoMissing > 50) {
    recommendations.push(`优化 ${Math.min(useMemoMissing, 50)} 处派生计算添加 useMemo`);
  }
  if (i18nMissingNamespace > 10) {
    recommendations.push(`为 ${Math.min(i18nMissingNamespace, 10)} 处 useTranslation 添加命名空间`);
  }

  return {
    timestamp,
    p0: { buildErrors, typeErrors, lintErrors, securityVulnerabilities },
    p1: { testFailures, testTotal, testPassRate, techDebtP1 },
    p2: { filesOverLimit, useMemoMissing, techDebtP2 },
    p3: { i18nMissingNamespace, techDebtP3 },
    recommendations
  };
}

function generateReport(result: DiagnosticResult): string {
  const lines: string[] = [
    `# 项目诊断报告`,
    ``,
    `**生成时间**: ${result.timestamp}`,
    ``,
    `---`,
    ``,
    `## 问题汇总`,
    ``,
    `| 优先级 | 指标 | 数量 | 状态 |`,
    `|--------|------|------|------|`,
    `| P0 | 类型错误 | ${result.p0.typeErrors} | ${result.p0.typeErrors === 0 ? '✅' : '❌'} |`,
    `| P0 | Lint 错误 | ${result.p0.lintErrors} | ${result.p0.lintErrors === 0 ? '✅' : '❌'} |`,
    `| P0 | 安全漏洞 | ${result.p0.securityVulnerabilities} | ${result.p0.securityVulnerabilities === 0 ? '✅' : '❌'} |`,
    `| P1 | 测试失败 | ${result.p1.testFailures} | ${result.p1.testFailures === 0 ? '✅' : '❌'} |`,
    `| P1 | 测试通过率 | ${result.p1.testPassRate.toFixed(1)}% | ${result.p1.testPassRate >= 95 ? '✅' : '⚠️'} |`,
    `| P1 | 技术债 P1 | ${result.p1.techDebtP1} | ${result.p1.techDebtP1 === 0 ? '✅' : '❌'} |`,
    `| P2 | 文件超标 | ${result.p2.filesOverLimit.length} | ${result.p2.filesOverLimit.length === 0 ? '✅' : '⚠️'} |`,
    `| P2 | useMemo 缺失 | ${result.p2.useMemoMissing} | ${result.p2.useMemoMissing < 50 ? '✅' : '⚠️'} |`,
    `| P3 | i18n 命名空间 | ${result.p3.i18nMissingNamespace} | ${result.p3.i18nMissingNamespace < 10 ? '✅' : '⚠️'} |`,
    ``,
    `---`,
    ``,
    `## 文件行数超标详情`,
    ``,
  ];

  if (result.p2.filesOverLimit.length > 0) {
    lines.push(`| 文件 | 行数 | 建议 |`);
    lines.push(`|------|------|------|`);
    result.p2.filesOverLimit.forEach(f => {
      lines.push(`| ${f.path} | ${f.lines} | 拆分为子模块 |`);
    });
  } else {
    lines.push(`✅ 所有文件行数在 800 行以内`);
  }

  lines.push(``, `---`, ``, `## 优化建议`, ``);

  if (result.recommendations.length > 0) {
    result.recommendations.forEach((rec, i) => {
      lines.push(`${i + 1}. ${rec}`);
    });
  } else {
    lines.push(`✅ 项目状态良好，无紧急优化项`);
  }

  lines.push(``, `---`, ``, `## 是否继续优化`, ``);

  const hasP0orP1 = 
    result.p0.typeErrors > 0 ||
    result.p0.lintErrors > 0 ||
    result.p0.securityVulnerabilities > 0 ||
    result.p1.testFailures > 0 ||
    result.p1.techDebtP1 > 0;

  if (hasP0orP1) {
    lines.push(`**建议继续优化** - 存在 P0/P1 级别问题需要解决`);
  } else if (result.recommendations.length > 0) {
    lines.push(`**可选继续优化** - 仅有 P2/P3 级别改进空间`);
  } else {
    lines.push(`**优化完成** - 无明显改进空间`);
  }

  return lines.join('\n');
}

function main() {
  ensureLogsDir();
  
  const result = diagnose();
  const report = generateReport(result);
  
  // 保存诊断报告
  const reportPath = join(LOGS_DIR, 'diagnostic-report.md');
  writeFileSync(reportPath, report);
  
  // 追加到优化循环日志
  const loopLogPath = join(LOGS_DIR, 'optimization-loop.log');
  const logEntry = [
    ``,
    `[${result.timestamp}] ========== 诊断 ==========`,
    `P0: 类型=${result.p0.typeErrors}, Lint=${result.p0.lintErrors}, 安全=${result.p0.securityVulnerabilities}`,
    `P1: 测试失败=${result.p1.testFailures}, 技术债=${result.p1.techDebtP1}`,
    `P2: 文件超标=${result.p2.filesOverLimit.length}, useMemo缺失=${result.p2.useMemoMissing}`,
    `P3: i18n未指定=${result.p3.i18nMissingNamespace}`,
    `建议: ${result.recommendations.length} 项`,
  ].join('\n');
  
  if (existsSync(loopLogPath)) {
    const existing = runCommand(`cat "${loopLogPath}"`);
    writeFileSync(loopLogPath, existing + logEntry);
  } else {
    writeFileSync(loopLogPath, logEntry);
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 诊断完成');
  console.log('='.repeat(50));
  console.log(`\n报告已保存: ${reportPath}`);
  console.log(`日志已更新: ${loopLogPath}`);
  console.log('\n' + report);
}

main();
