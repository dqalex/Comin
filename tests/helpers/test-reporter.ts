/**
 * 测试诊断报告生成器
 *
 * 用于生成结构化的测试报告，支持基线报告（R1）和验证报告（R2）的对比。
 *
 * 使用方式：
 *   import { TestReporter } from '@/tests/helpers/test-reporter';
 *   const reporter = new TestReporter('REQ-005');
 *   reporter.addResult({ name: '功能A', status: 'pass', duration: 120 });
 *   reporter.save('R1');
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import { getTargetName, getBaseUrl } from './api-client';

// 单个测试结果
export interface TestResult {
  name: string;
  category: 'feature' | 'upstream' | 'downstream' | 'regression';
  status: 'pass' | 'fail' | 'skip' | 'error';
  duration: number; // ms
  error?: string;
  details?: string;
}

// 完整报告
export interface TestReport {
  reqId: string;
  reportId: string; // R1, R2, R2b, ...
  timestamp: string;
  target: string; // local / remote
  baseUrl: string;
  summary: {
    total: number;
    pass: number;
    fail: number;
    skip: number;
    error: number;
    duration: number;
  };
  results: TestResult[];
}

// 对比结果
export interface CompareResult {
  reqId: string;
  baselineId: string;
  verifyId: string;
  changes: Array<{
    name: string;
    category: string;
    baseline: string;
    verify: string;
    verdict: 'improved' | 'regressed' | 'unchanged';
  }>;
  verdict: 'pass' | 'fail';
  message: string;
}

const REPORTS_DIR = path.resolve(__dirname, '..', 'reports');

export class TestReporter {
  private reqId: string;
  private results: TestResult[] = [];

  constructor(reqId: string) {
    this.reqId = reqId;
    // 确保 reports 目录存在
    if (!existsSync(REPORTS_DIR)) {
      mkdirSync(REPORTS_DIR, { recursive: true });
    }
  }

  /**
   * 添加测试结果
   */
  addResult(result: TestResult): void {
    this.results.push(result);
  }

  /**
   * 生成并保存报告
   */
  save(reportId: string): TestReport {
    const report: TestReport = {
      reqId: this.reqId,
      reportId,
      timestamp: new Date().toISOString(),
      target: getTargetName(),
      baseUrl: getBaseUrl(),
      summary: {
        total: this.results.length,
        pass: this.results.filter(r => r.status === 'pass').length,
        fail: this.results.filter(r => r.status === 'fail').length,
        skip: this.results.filter(r => r.status === 'skip').length,
        error: this.results.filter(r => r.status === 'error').length,
        duration: this.results.reduce((sum, r) => sum + r.duration, 0),
      },
      results: this.results,
    };

    const filePath = path.join(REPORTS_DIR, `${this.reqId}-${reportId}.json`);
    writeFileSync(filePath, JSON.stringify(report, null, 2), 'utf-8');

    return report;
  }

  /**
   * 加载已有报告
   */
  static load(reqId: string, reportId: string): TestReport | null {
    const filePath = path.join(REPORTS_DIR, `${reqId}-${reportId}.json`);
    if (!existsSync(filePath)) {
      return null;
    }
    const content = readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as TestReport;
  }

  /**
   * 对比两份报告
   */
  static compare(reqId: string, baselineId: string, verifyId: string): CompareResult {
    const baseline = TestReporter.load(reqId, baselineId);
    const verify = TestReporter.load(reqId, verifyId);

    if (!baseline) {
      throw new Error(`基线报告不存在: ${reqId}-${baselineId}`);
    }
    if (!verify) {
      throw new Error(`验证报告不存在: ${reqId}-${verifyId}`);
    }

    const changes: CompareResult['changes'] = [];
    let hasRegression = false;

    // 按名称索引基线结果
    const baselineMap = new Map(baseline.results.map(r => [r.name, r]));

    for (const verifyResult of verify.results) {
      const baselineResult = baselineMap.get(verifyResult.name);
      const baseStatus = baselineResult?.status ?? 'skip';
      const verifyStatus = verifyResult.status;

      let verdict: 'improved' | 'regressed' | 'unchanged';
      if (baseStatus === verifyStatus) {
        verdict = 'unchanged';
      } else if (baseStatus === 'fail' && verifyStatus === 'pass') {
        verdict = 'improved';
      } else if (baseStatus === 'pass' && verifyStatus === 'fail') {
        verdict = 'regressed';
        hasRegression = true;
      } else {
        verdict = verifyStatus === 'pass' ? 'improved' : 'regressed';
        if (verifyStatus === 'fail') hasRegression = true;
      }

      changes.push({
        name: verifyResult.name,
        category: verifyResult.category,
        baseline: baseStatus,
        verify: verifyStatus,
        verdict,
      });
    }

    const improved = changes.filter(c => c.verdict === 'improved').length;
    const regressed = changes.filter(c => c.verdict === 'regressed').length;

    return {
      reqId,
      baselineId,
      verifyId,
      changes,
      verdict: hasRegression ? 'fail' : 'pass',
      message: hasRegression
        ? `❌ 存在回归：${regressed} 个测试从 PASS 变为 FAIL`
        : `✅ 验证通过：${improved} 个测试从 FAIL 变为 PASS，无回归`,
    };
  }

  /**
   * 格式化报告为可读文本
   */
  static formatReport(report: TestReport): string {
    const lines: string[] = [];
    lines.push(`# 测试报告: ${report.reqId}-${report.reportId}`);
    lines.push(`时间: ${report.timestamp}`);
    lines.push(`环境: ${report.target} (${report.baseUrl})`);
    lines.push(`结果: ${report.summary.pass} PASS / ${report.summary.fail} FAIL / ${report.summary.total} TOTAL`);
    lines.push(`耗时: ${report.summary.duration}ms`);
    lines.push('');

    const categories = ['feature', 'upstream', 'downstream', 'regression'] as const;
    for (const cat of categories) {
      const catResults = report.results.filter(r => r.category === cat);
      if (catResults.length === 0) continue;
      lines.push(`## ${cat}`);
      for (const r of catResults) {
        const icon = r.status === 'pass' ? '✅' : r.status === 'fail' ? '❌' : '⏭️';
        lines.push(`  ${icon} ${r.name} (${r.duration}ms)`);
        if (r.error) lines.push(`     错误: ${r.error}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * 格式化对比结果为可读文本
   */
  static formatCompare(compare: CompareResult): string {
    const lines: string[] = [];
    lines.push(`# 报告对比: ${compare.reqId} (${compare.baselineId} → ${compare.verifyId})`);
    lines.push(compare.message);
    lines.push('');
    lines.push('| 测试项 | 分类 | 基线 | 验证 | 判定 |');
    lines.push('|--------|------|------|------|------|');
    for (const c of compare.changes) {
      const icon = c.verdict === 'improved' ? '🟢' : c.verdict === 'regressed' ? '🔴' : '⚪';
      lines.push(`| ${c.name} | ${c.category} | ${c.baseline} | ${c.verify} | ${icon} ${c.verdict} |`);
    }

    return lines.join('\n');
  }
}
