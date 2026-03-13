/**
 * 日志追加辅助工具
 * 用于安全地追加日志到 dev-changes.log 和 bug-knowledge.log
 * 防止意外覆盖历史记录
 */

import * as fs from 'fs';
import * as path from 'path';

const LOGS_DIR = path.join(process.cwd(), 'logs');

export type DevChangeType = 'feat' | 'fix' | 'refactor' | 'perf' | 'style' | 'chore' | 'docs' | 'test';

export interface DevChangeEntry {
  type: DevChangeType;
  scope: string;
  description: string;
  files: string[];
}

export interface BugKnowledgeEntry {
  id: string;
  phenomenon: string;
  rootCause: string;
  impact: string;
  fix: string;
  patterns: string[];
  prevention: string;
  relatedRule: string;
}

/**
 * 追加开发变更日志
 */
export function appendDevChange(entry: DevChangeEntry): void {
  const filePath = path.join(LOGS_DIR, 'dev-changes.log');
  const timestamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const line = `[${timestamp}] ${entry.type} | ${entry.scope} | ${entry.description} | ${entry.files.join(', ')}\n`;
  
  ensureLogsDir();
  fs.appendFileSync(filePath, line, 'utf-8');
}

/**
 * 追加 Bug 知识记录
 */
export function appendBugKnowledge(entry: BugKnowledgeEntry): void {
  const filePath = path.join(LOGS_DIR, 'bug-knowledge.log');
  const timestamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const patternTags = entry.patterns.map(p => `[${p}]`).join(' ');
  
  const block = `
---
\n[${timestamp}] ${entry.id}
现象: ${entry.phenomenon}
根因: ${entry.rootCause}
影响: ${entry.impact}
修复: ${entry.fix}
模式: ${patternTags}
防御: ${entry.prevention}
关联规则: ${entry.relatedRule}
`;
  
  ensureLogsDir();
  fs.appendFileSync(filePath, block, 'utf-8');
}

/**
 * 获取下一个 Bug 序号
 */
export function getNextBugId(): string {
  const filePath = path.join(LOGS_DIR, 'bug-knowledge.log');
  
  if (!fs.existsSync(filePath)) {
    return 'BUG-001';
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const matches = content.match(/BUG-\d{3}/g) || [];
  
  if (matches.length === 0) {
    return 'BUG-001';
  }
  
  const lastId = matches[matches.length - 1];
  const num = parseInt(lastId.replace('BUG-', ''), 10) + 1;
  return `BUG-${num.toString().padStart(3, '0')}`;
}

/**
 * 确保 logs 目录存在
 */
function ensureLogsDir(): void {
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }
}

/**
 * 读取当前 Bug 知识库统计
 */
export function getBugKnowledgeStats(): { total: number; byPattern: Record<string, number> } {
  const filePath = path.join(LOGS_DIR, 'bug-knowledge.log');
  
  if (!fs.existsSync(filePath)) {
    return { total: 0, byPattern: {} };
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const bugIds = content.match(/BUG-\d{3}/g) || [];
  const patterns = content.match(/\[[\u4e00-\u9fa5\w]+\]/g) || [];
  
  const byPattern: Record<string, number> = {};
  patterns.forEach(p => {
    byPattern[p] = (byPattern[p] || 0) + 1;
  });
  
  return {
    total: bugIds.length,
    byPattern
  };
}
