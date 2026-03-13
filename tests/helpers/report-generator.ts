/**
 * 测试报告生成器
 * 
 * 用于生成各类测试报告，统一格式和存储位置
 */

import * as fs from 'fs';
import * as path from 'path';

// 报告类型
export type ReportType = 'e2e' | 'stress' | 'security' | 'performance';

// 测试结果统计
export interface TestStatistics {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number; // 毫秒
}

// 性能指标
export interface PerformanceMetrics {
  avgResponseTime: number;
  maxResponseTime: number;
  minResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  requestsPerSecond: number;
  errorRate: number;
}

// 压力测试场景结果
export interface StressTestScenario {
  name: string;
  description: string;
  concurrentUsers: number;
  duration: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  metrics: PerformanceMetrics;
  errors: Array<{
    code: string;
    message: string;
    count: number;
  }>;
}

// 安全测试漏洞
export interface SecurityVulnerability {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  endpoint: string;
  method: string;
  payload?: string;
  impact: string;
  recommendation: string;
  references: string[];
}

// 报告数据结构
export interface ReportData {
  type: ReportType;
  title: string;
  generatedAt: string;
  environment: {
    nodeVersion: string;
    platform: string;
    testTarget: 'local' | 'remote';
    baseUrl: string;
  };
  statistics?: TestStatistics;
  scenarios?: StressTestScenario[];
  vulnerabilities?: SecurityVulnerability[];
  issues?: Array<{
    id: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    title: string;
    description: string;
    file?: string;
    line?: number;
    recommendation: string;
  }>;
  recommendations?: string[];
  summary: string;
}

// 报告生成器类
export class ReportGenerator {
  private reportsDir: string;

  constructor() {
    this.reportsDir = path.join(process.cwd(), 'tests', 'reports');
    this.ensureDirectoryExists();
  }

  private ensureDirectoryExists(): void {
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }
  }

  /**
   * 生成报告文件名
   */
  private generateFileName(type: ReportType): string {
    const now = new Date();
    const timestamp = now.toISOString()
      .replace(/[-:]/g, '')
      .replace('T', '-')
      .replace(/\..+/, '');
    return `${type}-report-${timestamp}.md`;
  }

  /**
   * 格式化持续时间
   */
  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }

  /**
   * 生成 E2E 测试报告
   */
  generateE2EReport(data: {
    title: string;
    statistics: TestStatistics;
    testFiles: Array<{
      name: string;
      passed: number;
      failed: number;
      duration: number;
      errors?: string[];
    }>;
    issues?: ReportData['issues'];
  }): string {
    const report: ReportData = {
      type: 'e2e',
      title: data.title,
      generatedAt: new Date().toISOString(),
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        testTarget: process.env.TEST_TARGET === 'remote' ? 'remote' : 'local',
        baseUrl: process.env.BASE_URL || 'http://localhost:3000',
      },
      statistics: data.statistics,
      issues: data.issues,
      recommendations: this.generateE2ERecommendations(data),
      summary: this.generateE2ESummary(data),
    };

    return this.writeReport(report);
  }

  /**
   * 生成压力测试报告
   */
  generateStressReport(data: {
    title: string;
    totalDuration: number;
    scenarios: StressTestScenario[];
    systemMetrics?: {
      peakMemoryUsage: number;
      avgCpuUsage: number;
      dbConnections: number;
    };
  }): string {
    const allMetrics = data.scenarios.map(s => s.metrics);
    const totalRequests = data.scenarios.reduce((sum, s) => sum + s.totalRequests, 0);
    const totalFailed = data.scenarios.reduce((sum, s) => sum + s.failedRequests, 0);

    const report: ReportData = {
      type: 'stress',
      title: data.title,
      generatedAt: new Date().toISOString(),
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        testTarget: process.env.TEST_TARGET === 'remote' ? 'remote' : 'local',
        baseUrl: process.env.BASE_URL || 'http://localhost:3000',
      },
      scenarios: data.scenarios,
      recommendations: this.generateStressRecommendations(data),
      summary: `## 压力测试总结\n\n` +
        `- **总测试时长**: ${this.formatDuration(data.totalDuration)}\n` +
        `- **测试场景数**: ${data.scenarios.length}\n` +
        `- **总请求数**: ${totalRequests.toLocaleString()}\n` +
        `- **失败请求**: ${totalFailed.toLocaleString()} (${((totalFailed / totalRequests) * 100).toFixed(2)}%)\n` +
        `- **平均响应时间**: ${(allMetrics.reduce((s, m) => s + m.avgResponseTime, 0) / allMetrics.length).toFixed(0)}ms\n` +
        `- **P95 响应时间**: ${Math.max(...allMetrics.map(m => m.p95ResponseTime))}ms\n`,
    };

    return this.writeReport(report);
  }

  /**
   * 生成安全测试报告
   */
  generateSecurityReport(data: {
    title: string;
    vulnerabilities: SecurityVulnerability[];
    testedEndpoints: string[];
    testCategories: Array<{
      name: string;
      testCount: number;
      passedCount: number;
    }>;
  }): string {
    const criticalCount = data.vulnerabilities.filter(v => v.severity === 'critical').length;
    const highCount = data.vulnerabilities.filter(v => v.severity === 'high').length;
    const mediumCount = data.vulnerabilities.filter(v => v.severity === 'medium').length;
    const lowCount = data.vulnerabilities.filter(v => v.severity === 'low').length;

    const report: ReportData = {
      type: 'security',
      title: data.title,
      generatedAt: new Date().toISOString(),
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        testTarget: process.env.TEST_TARGET === 'remote' ? 'remote' : 'local',
        baseUrl: process.env.BASE_URL || 'http://localhost:3000',
      },
      vulnerabilities: data.vulnerabilities,
      recommendations: this.generateSecurityRecommendations(data),
      summary: `## 安全测试总结\n\n` +
        `### 漏洞统计\n\n` +
        `| 严重级别 | 数量 |\n` +
        `|----------|------|\n` +
        `| 🔴 Critical | ${criticalCount} |\n` +
        `| 🟠 High | ${highCount} |\n` +
        `| 🟡 Medium | ${mediumCount} |\n` +
        `| 🟢 Low | ${lowCount} |\n\n` +
        `### 测试覆盖\n\n` +
        `- **测试端点数**: ${data.testedEndpoints.length}\n` +
        `- **测试类别数**: ${data.testCategories.length}\n` +
        `- **发现漏洞总数**: ${data.vulnerabilities.length}\n`,
    };

    return this.writeReport(report);
  }

  /**
   * 写入报告文件
   */
  private writeReport(data: ReportData): string {
    const fileName = this.generateFileName(data.type);
    const filePath = path.join(this.reportsDir, fileName);
    const content = this.renderMarkdown(data);

    fs.writeFileSync(filePath, content, 'utf-8');
    return filePath;
  }

  /**
   * 渲染 Markdown 格式报告
   */
  private renderMarkdown(data: ReportData): string {
    let md = `# ${data.title}\n\n`;
    md += `**生成时间**: ${data.generatedAt}\n\n`;
    md += `---\n\n`;

    // 环境信息
    md += `## 环境信息\n\n`;
    md += `| 项目 | 值 |\n`;
    md += `|------|----|\n`;
    md += `| Node 版本 | ${data.environment.nodeVersion} |\n`;
    md += `| 平台 | ${data.environment.platform} |\n`;
    md += `| 测试目标 | ${data.environment.testTarget} |\n`;
    md += `| 基础 URL | ${data.environment.baseUrl} |\n\n`;

    // 摘要
    md += data.summary + '\n\n';

    // 统计信息
    if (data.statistics) {
      md += `## 测试统计\n\n`;
      md += `| 指标 | 值 |\n`;
      md += `|------|----|\n`;
      md += `| 总用例数 | ${data.statistics.total} |\n`;
      md += `| 通过 | ✅ ${data.statistics.passed} |\n`;
      md += `| 失败 | ❌ ${data.statistics.failed} |\n`;
      md += `| 跳过 | ⏭️ ${data.statistics.skipped} |\n`;
      md += `| 耗时 | ${this.formatDuration(data.statistics.duration)} |\n`;
      md += `| 通过率 | ${((data.statistics.passed / data.statistics.total) * 100).toFixed(1)}% |\n\n`;
    }

    // 压力测试场景
    if (data.scenarios && data.scenarios.length > 0) {
      md += `## 测试场景\n\n`;
      for (const scenario of data.scenarios) {
        md += `### ${scenario.name}\n\n`;
        md += `${scenario.description}\n\n`;
        md += `| 指标 | 值 |\n`;
        md += `|------|----|\n`;
        md += `| 并发用户 | ${scenario.concurrentUsers} |\n`;
        md += `| 持续时间 | ${this.formatDuration(scenario.duration)} |\n`;
        md += `| 总请求数 | ${scenario.totalRequests.toLocaleString()} |\n`;
        md += `| 成功请求 | ${scenario.successfulRequests.toLocaleString()} |\n`;
        md += `| 失败请求 | ${scenario.failedRequests.toLocaleString()} |\n`;
        md += `| 平均响应时间 | ${scenario.metrics.avgResponseTime}ms |\n`;
        md += `| 最大响应时间 | ${scenario.metrics.maxResponseTime}ms |\n`;
        md += `| P95 响应时间 | ${scenario.metrics.p95ResponseTime}ms |\n`;
        md += `| P99 响应时间 | ${scenario.metrics.p99ResponseTime}ms |\n`;
        md += `| RPS | ${scenario.metrics.requestsPerSecond.toFixed(2)} |\n`;
        md += `| 错误率 | ${(scenario.metrics.errorRate * 100).toFixed(2)}% |\n\n`;

        if (scenario.errors.length > 0) {
          md += `**错误详情**:\n\n`;
          for (const error of scenario.errors) {
            md += `- \`${error.code}\`: ${error.message} (${error.count} 次)\n`;
          }
          md += '\n';
        }
      }
    }

    // 安全漏洞
    if (data.vulnerabilities && data.vulnerabilities.length > 0) {
      md += `## 发现的漏洞\n\n`;
      
      const grouped = {
        critical: data.vulnerabilities.filter(v => v.severity === 'critical'),
        high: data.vulnerabilities.filter(v => v.severity === 'high'),
        medium: data.vulnerabilities.filter(v => v.severity === 'medium'),
        low: data.vulnerabilities.filter(v => v.severity === 'low'),
      };

      for (const [severity, vulns] of Object.entries(grouped)) {
        if (vulns.length === 0) continue;
        
        const severityEmojiMap: Record<string, string> = { critical: '🔴', high: '🟠', medium: '🟡', low: '🟢' };
        const emoji = severityEmojiMap[severity] || '⚪';
        md += `### ${emoji} ${severity.toUpperCase()} (${vulns.length})\n\n`;

        for (const vuln of vulns) {
          md += `#### ${vuln.id}: ${vuln.title}\n\n`;
          md += `**描述**: ${vuln.description}\n\n`;
          md += `**端点**: \`${vuln.method} ${vuln.endpoint}\`\n\n`;
          if (vuln.payload) {
            md += `**攻击载荷**:\n\`\`\`\n${vuln.payload}\n\`\`\`\n\n`;
          }
          md += `**影响**: ${vuln.impact}\n\n`;
          md += `**修复建议**: ${vuln.recommendation}\n\n`;
          if (vuln.references.length > 0) {
            md += `**参考**: ${vuln.references.join(', ')}\n\n`;
          }
        }
      }
    }

    // 问题列表
    if (data.issues && data.issues.length > 0) {
      md += `## 发现的问题\n\n`;
      for (const issue of data.issues) {
        const emoji = { critical: '🔴', high: '🟠', medium: '🟡', low: '🟢' }[issue.severity];
        md += `### ${emoji} ${issue.id}: ${issue.title}\n\n`;
        md += `**描述**: ${issue.description}\n\n`;
        if (issue.file) {
          md += `**文件**: \`${issue.file}\`${issue.line ? `:${issue.line}` : ''}\n\n`;
        }
        md += `**修复建议**: ${issue.recommendation}\n\n`;
      }
    }

    // 建议
    if (data.recommendations && data.recommendations.length > 0) {
      md += `## 优化建议\n\n`;
      for (let i = 0; i < data.recommendations.length; i++) {
        md += `${i + 1}. ${data.recommendations[i]}\n`;
      }
      md += '\n';
    }

    md += `---\n\n`;
    md += `*报告由 TeamClaw 测试框架自动生成*\n`;

    return md;
  }

  /**
   * 生成 E2E 测试建议
   */
  private generateE2ERecommendations(data: {
    statistics: TestStatistics;
    testFiles: Array<{ passed: number; failed: number; errors?: string[] }>;
  }): string[] {
    const recommendations: string[] = [];
    const failureRate = data.statistics.failed / data.statistics.total;

    if (failureRate > 0.1) {
      recommendations.push('🔴 失败率超过 10%，建议优先修复失败测试');
    }

    if (failureRate > 0.05) {
      recommendations.push('🟠 部分测试失败，建议检查 API 返回格式是否一致');
    }

    const filesWithFailures = data.testFiles.filter(f => f.failed > 0);
    if (filesWithFailures.length > 0) {
      recommendations.push(`📋 建议优先检查以下测试文件: ${filesWithFailures.map((f, i) => `test-file-${i + 1}`).join(', ')}`);
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ 所有测试通过，建议添加更多边界条件测试');
    }

    return recommendations;
  }

  /**
   * 生成 E2E 测试摘要
   */
  private generateE2ESummary(data: {
    statistics: TestStatistics;
    testFiles: Array<{ name: string; passed: number; failed: number }>;
  }): string {
    const passRate = ((data.statistics.passed / data.statistics.total) * 100).toFixed(1);
    return `## E2E 测试总结\n\n` +
      `- **测试文件数**: ${data.testFiles.length}\n` +
      `- **测试用例总数**: ${data.statistics.total}\n` +
      `- **通过**: ✅ ${data.statistics.passed}\n` +
      `- **失败**: ❌ ${data.statistics.failed}\n` +
      `- **跳过**: ⏭️ ${data.statistics.skipped}\n` +
      `- **通过率**: ${passRate}%\n` +
      `- **耗时**: ${this.formatDuration(data.statistics.duration)}\n`;
  }

  /**
   * 生成压力测试建议
   */
  private generateStressRecommendations(data: {
    scenarios: StressTestScenario[];
    systemMetrics?: { peakMemoryUsage: number; avgCpuUsage: number };
  }): string[] {
    const recommendations: string[] = [];

    for (const scenario of data.scenarios) {
      if (scenario.metrics.errorRate > 0.05) {
        recommendations.push(`🔴 [${scenario.name}] 错误率 ${(scenario.metrics.errorRate * 100).toFixed(2)}% 超过 5%，建议检查服务稳定性`);
      }

      if (scenario.metrics.p95ResponseTime > 2000) {
        recommendations.push(`🟠 [${scenario.name}] P95 响应时间 ${scenario.metrics.p95ResponseTime}ms 超过 2s，建议优化慢查询`);
      }

      if (scenario.metrics.avgResponseTime > 500) {
        recommendations.push(`🟡 [${scenario.name}] 平均响应时间 ${scenario.metrics.avgResponseTime}ms 较高，建议检查 N+1 查询`);
      }
    }

    if (data.systemMetrics) {
      if (data.systemMetrics.peakMemoryUsage > 1024 * 1024 * 1024) {
        recommendations.push(`🔴 内存峰值 ${(data.systemMetrics.peakMemoryUsage / 1024 / 1024 / 1024).toFixed(2)}GB 超过 1GB，建议检查内存泄漏`);
      }

      if (data.systemMetrics.avgCpuUsage > 80) {
        recommendations.push(`🟠 CPU 平均使用率 ${data.systemMetrics.avgCpuUsage.toFixed(1)}% 较高，建议优化计算密集型任务`);
      }
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ 系统在高并发下表现良好，建议继续监控生产环境指标');
    }

    return recommendations;
  }

  /**
   * 生成安全测试建议
   */
  private generateSecurityRecommendations(data: {
    vulnerabilities: SecurityVulnerability[];
  }): string[] {
    const recommendations: string[] = [];
    const critical = data.vulnerabilities.filter(v => v.severity === 'critical');
    const high = data.vulnerabilities.filter(v => v.severity === 'high');

    if (critical.length > 0) {
      recommendations.push(`🔴 发现 ${critical.length} 个严重漏洞，必须立即修复！`);
    }

    if (high.length > 0) {
      recommendations.push(`🟠 发现 ${high.length} 个高危漏洞，建议尽快修复`);
    }

    // 检查常见漏洞类型
    const hasAuthIssue = data.vulnerabilities.some(v => v.title.toLowerCase().includes('auth'));
    if (hasAuthIssue) {
      recommendations.push('🔐 检测到认证相关漏洞，建议增强认证中间件');
    }

    const hasSqlInjection = data.vulnerabilities.some(v => v.title.toLowerCase().includes('sql'));
    if (hasSqlInjection) {
      recommendations.push('🗄️ 检测到 SQL 注入风险，建议使用参数化查询');
    }

    const hasXss = data.vulnerabilities.some(v => v.title.toLowerCase().includes('xss'));
    if (hasXss) {
      recommendations.push('🛡️ 检测到 XSS 风险，建议对用户输入进行转义');
    }

    const hasCsrf = data.vulnerabilities.some(v => v.title.toLowerCase().includes('csrf'));
    if (hasCsrf) {
      recommendations.push('🔒 检测到 CSRF 风险，建议检查 CSRF Token 机制');
    }

    if (data.vulnerabilities.length === 0) {
      recommendations.push('✅ 未发现安全漏洞，建议定期进行安全审计');
    }

    return recommendations;
  }
}

// 导出单例
export const reportGenerator = new ReportGenerator();
