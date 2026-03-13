#!/usr/bin/env tsx
/**
 * i18n 翻译完整性检查脚本
 * 
 * 功能：
 * 1. 扫描所有 tsx/ts 文件中的翻译调用
 * 2. 提取使用的翻译键（支持 t() 和 i18nKey 属性）
 * 3. 对比 zh.ts 和 en.ts 中的定义
 * 4. 报告缺失的翻译键及使用位置
 * 5. 支持自动修复（--fix 模式）
 * 
 * 用法：
 *   npx tsx scripts/check-i18n.ts              # 检查所有
 *   npx tsx scripts/check-i18n.ts --ns=sop     # 只检查 sop 命名空间
 *   npx tsx scripts/check-i18n.ts --fix        # 自动修复缺失的键
 *   npx tsx scripts/check-i18n.ts --verbose    # 显示详细信息
 */

import * as fs from 'fs';
import * as path from 'path';

// 配置
const LOCALES_DIR = path.join(process.cwd(), 'lib/locales');
const SRC_DIRS = [
  path.join(process.cwd(), 'app'),
  path.join(process.cwd(), 'components'),
  path.join(process.cwd(), 'hooks'),
  path.join(process.cwd(), 'store'),
  path.join(process.cwd(), 'core'),
];

const EXCLUDE_PATTERNS = [
  /node_modules/,
  /\.next/,
  /dist/,
  /coverage/,
  /test/,
  /spec/,
  /__tests__/,
  /scripts\/check-i18n\.ts/, // 排除脚本本身
];

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// 递归获取所有 tsx/ts 文件
function getAllFiles(dir: string): string[] {
  const files: string[] = [];
  
  if (!fs.existsSync(dir)) return files;
  
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      if (EXCLUDE_PATTERNS.some(p => p.test(fullPath))) continue;
      files.push(...getAllFiles(fullPath));
    } else if (/\.(tsx|ts)$/.test(item) && !item.endsWith('.d.ts')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

// 从文件提取翻译键及其位置
function extractKeysFromFile(filePath: string): Array<{ key: string; line: number; column: number; context: string }> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const results: Array<{ key: string; line: number; column: number; context: string }> = [];
  
  // 匹配模式：
  // 1. t('namespace.key') 或 t("namespace.key")
  // 2. t('namespace.key', ...) - 带参数的调用
  // 3. i18nKey="namespace.key"
  // 4. t(`namespace.${variable}`) - 模板字符串（警告）
  const patterns = [
    { regex: /t\(['"]([a-zA-Z][a-zA-Z0-9_]*\.[a-zA-Z][a-zA-Z0-9_.]+)['"]\)/g, type: 't()' },
    { regex: /t\(['"]([a-zA-Z][a-zA-Z0-9_]*\.[a-zA-Z][a-zA-Z0-9_.]+)['"]\s*,/g, type: 't() with params' },
    { regex: /i18nKey=['"]([a-zA-Z][a-zA-Z0-9_]*\.[a-zA-Z][a-zA-Z0-9_.]+)['"]/g, type: 'i18nKey' },
  ];
  
  const lines = content.split('\n');
  
  for (const { regex, type } of patterns) {
    regex.lastIndex = 0; // 重置正则
    let match;
    
    while ((match = regex.exec(content)) !== null) {
      const key = match[1];
      
      // 过滤无效键
      if (
        key.includes('/') ||
        key.startsWith('@') ||
        key.includes(' ') ||
        key.length < 3 ||
        /^[a-zA-Z]$/.test(key)
      ) {
        continue;
      }
      
      // 计算行列位置
      const upToMatch = content.slice(0, match.index);
      const line = upToMatch.split('\n').length;
      const lastNewline = upToMatch.lastIndexOf('\n');
      const column = match.index - lastNewline;
      
      // 获取上下文（所在行的内容）
      const context = lines[line - 1]?.trim() || '';
      
      results.push({ key, line, column, context });
    }
  }
  
  // 检测动态键（模板字符串）
  // eslint-disable-next-line no-template-curly-in-string
  const dynamicPattern = new RegExp("t\\(`([^`]+\\$\\{[^}]+\\}[^`]*)`\\)", "g");
  let dynamicMatch;
  while ((dynamicMatch = dynamicPattern.exec(content)) !== null) {
    const upToMatch = content.slice(0, dynamicMatch.index);
    const line = upToMatch.split('\n').length;
    log(`⚠️  ${path.relative(process.cwd(), filePath)}:${line} 发现动态翻译键: ${dynamicMatch[0]}`, 'yellow');
  }
  
  return results;
}

// 解析翻译文件 - 使用更健壮的方式
function parseLocaleFile(filePath: string): { data: Record<string, unknown>; rawContent: string } {
  const content = fs.readFileSync(filePath, 'utf-8');
  
  // 方法1: 尝试直接作为 TypeScript 模块导入（如果可能）
  try {
    // 使用 require 尝试加载（适用于编译后的 JS）
    delete require.cache[require.resolve(filePath)];
    const module = require(filePath);
    if (module.default && typeof module.default === 'object') {
      return { data: module.default, rawContent: content };
    }
  } catch {
    // 失败则使用方法2
  }
  
  // 方法2: 正则提取所有定义的键
  const definedKeys = new Map<string, string>(); // key -> value
  
  // 匹配模式: keyName: 'value' 或 keyName: "value"
  // 支持嵌套对象结构
  const lines = content.split('\n');
  const namespaceStack: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // 检测命名空间开始
    const nsMatch = line.match(/^(\s+)([a-zA-Z][a-zA-Z0-9_]*):\s*\{/);
    if (nsMatch && !trimmed.startsWith('//') && !trimmed.startsWith('/*')) {
      const indent = nsMatch[1].length;
      const nsName = nsMatch[2];
      
      // 根据缩进调整栈
      while (namespaceStack.length > 0 && namespaceStack[namespaceStack.length - 1].length >= indent) {
        namespaceStack.pop();
      }
      namespaceStack.push(nsName);
      continue;
    }
    
    // 检测键值对
    const keyMatch = line.match(/^(\s+)([a-zA-Z][a-zA-Z0-9_]+):\s*(['"'])([^'"]*)\3/);
    if (keyMatch && !trimmed.startsWith('//')) {
      const indent = keyMatch[1].length;
      const keyName = keyMatch[2];
      const value = keyMatch[4];
      
      // 根据缩进调整栈
      while (namespaceStack.length > 0) {
        // 简化判断：如果当前缩进小于上一个命名空间的缩进，弹出
        const lastLine = lines.slice(0, i).reverse().find(l => l.match(/^(\s+)([a-zA-Z][a-zA-Z0-9_]*):\s*\{/));
        if (!lastLine) break;
        const lastIndent = lastLine.match(/^(\s+)/)?.[1].length || 0;
        if (indent <= lastIndent && namespaceStack.length > 1) {
          namespaceStack.pop();
        } else {
          break;
        }
      }
      
      const fullKey = [...namespaceStack, keyName].join('.');
      definedKeys.set(fullKey, value);
    }
  }
  
  // 将扁平化的键转换回嵌套对象
  const result: Record<string, unknown> = {};
  for (const [flatKey, value] of definedKeys) {
    const parts = flatKey.split('.');
    let current: Record<string, unknown> = result;
    
    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]]) {
        current[parts[i]] = {};
      }
      current = current[parts[i]] as Record<string, unknown>;
    }
    
    current[parts[parts.length - 1]] = value;
  }
  
  return { data: result, rawContent: content };
}

// 检查键是否存在（支持嵌套）
function hasKey(obj: Record<string, unknown>, keyPath: string): boolean {
  const parts = keyPath.split('.');
  let current: unknown = obj;
  
  for (const part of parts) {
    if (current === null || typeof current !== 'object') return false;
    current = (current as Record<string, unknown>)[part];
    if (current === undefined) return false;
  }
  
  return true;
}

// 获取嵌套键的完整路径
function getNestedKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      keys.push(...getNestedKeys(value as Record<string, unknown>, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  
  return keys;
}

// 生成修复代码片段
function generateFixCode(
  missingKeys: Array<{ key: string; locations: Array<{ file: string; line: number; context: string }> }>,
  locale: 'zh' | 'en'
): string {
  if (missingKeys.length === 0) return '';
  
  // 按命名空间分组
  const byNamespace = new Map<string, string[]>();
  for (const { key } of missingKeys) {
    const parts = key.split('.');
    const ns = parts[0];
    const shortKey = parts.slice(1).join('.');
    if (!byNamespace.has(ns)) {
      byNamespace.set(ns, []);
    }
    byNamespace.get(ns)!.push(shortKey);
  }
  
  // 生成代码
  let output = '';
  for (const [ns, keys] of byNamespace) {
    output += `\n  // ${ns} ${locale === 'zh' ? '命名空间缺失的键' : 'namespace missing keys'}\n`;
    output += `  ${ns}: {\n`;
    for (const key of [...new Set(keys)]) {
      output += `    ${key}: '${locale === 'zh' ? key : key}', // TODO: ${locale === 'zh' ? '添加翻译' : 'Add translation'}\n`;
    }
    output += `  }\n`;
  }
  
  return output;
}

// 主函数
async function main() {
  const args = process.argv.slice(2);
  const shouldFix = args.includes('--fix');
  const verbose = args.includes('--verbose');
  const filterNs = args.find(arg => arg.startsWith('--ns='))?.replace('--ns=', '');
  
  log('🔍 扫描翻译键...', 'cyan');
  log(`   扫描目录: ${SRC_DIRS.map(d => path.relative(process.cwd(), d)).join(', ')}`, 'gray');
  
  // 1. 收集所有使用的翻译键及其位置
  const usedKeys = new Map<string, Array<{ file: string; line: number; context: string }>>();
  let filesScanned = 0;
  
  for (const dir of SRC_DIRS) {
    const files = getAllFiles(dir);
    
    for (const file of files) {
      filesScanned++;
      const keys = extractKeysFromFile(file);
      const relativePath = path.relative(process.cwd(), file);
      
      for (const { key, line, context } of keys) {
        // 如果指定了命名空间过滤
        if (filterNs && !key.startsWith(filterNs + '.')) continue;
        
        if (!usedKeys.has(key)) {
          usedKeys.set(key, []);
        }
        usedKeys.get(key)!.push({ file: relativePath, line, context });
      }
    }
  }
  
  log(`   已扫描 ${filesScanned} 个文件`, 'gray');
  log(`   找到 ${usedKeys.size} 个使用的翻译键`, 'green');
  
  if (usedKeys.size === 0) {
    log('\n✅ 未发现翻译键使用', 'green');
    return;
  }
  
  // 2. 解析翻译文件
  log('\n📖 解析翻译文件...', 'cyan');
  const zhResult = parseLocaleFile(path.join(LOCALES_DIR, 'zh.ts'));
  const enResult = parseLocaleFile(path.join(LOCALES_DIR, 'en.ts'));
  
  const zhAllKeys = new Set(getNestedKeys(zhResult.data));
  const enAllKeys = new Set(getNestedKeys(enResult.data));
  
  log(`   zh.ts: ${zhAllKeys.size} 个已定义键`, 'gray');
  log(`   en.ts: ${enAllKeys.size} 个已定义键`, 'gray');
  
  // 3. 检查缺失的键
  const zhMissing: Array<{ key: string; locations: Array<{ file: string; line: number; context: string }> }> = [];
  const enMissing: Array<{ key: string; locations: Array<{ file: string; line: number; context: string }> }> = [];
  
  for (const [key, locations] of usedKeys) {
    if (!zhAllKeys.has(key)) {
      zhMissing.push({ key, locations });
    }
    if (!enAllKeys.has(key)) {
      enMissing.push({ key, locations });
    }
  }
  
  // 4. 报告结果
  let hasErrors = false;
  
  if (zhMissing.length === 0 && enMissing.length === 0) {
    log('\n✅ 所有翻译键已定义！', 'green');
  } else {
    hasErrors = true;
    
    // 按命名空间分组
    const allMissing = new Set([...zhMissing.map(m => m.key), ...enMissing.map(m => m.key)]);
    const byNamespace = new Map<string, { 
      zh: Array<{ key: string; locations: Array<{ file: string; line: number; context: string }> }>, 
      en: Array<{ key: string; locations: Array<{ file: string; line: number; context: string }> }> 
    }>();
    
    for (const key of allMissing) {
      const ns = key.split('.')[0];
      if (!byNamespace.has(ns)) {
        byNamespace.set(ns, { zh: [], en: [] });
      }
      const zhEntry = zhMissing.find(m => m.key === key);
      const enEntry = enMissing.find(m => m.key === key);
      if (zhEntry) byNamespace.get(ns)!.zh.push(zhEntry);
      if (enEntry) byNamespace.get(ns)!.en.push(enEntry);
    }
    
    log('\n❌ 翻译缺失汇总:', 'red');
    log('═'.repeat(80), 'red');
    
    for (const [ns, data] of byNamespace) {
      const zhCount = data.zh.length;
      const enCount = data.en.length;
      
      log(`\n📁 ${ns}`, 'cyan');
      log(`   中文缺失: ${zhCount} | 英文缺失: ${enCount}`, 'yellow');
      
      // 显示具体的键和使用位置
      const allKeys = new Map<string, { zh: boolean; en: boolean; locations: Array<{ file: string; line: number; context: string }> }>();
      
      for (const { key, locations } of data.zh) {
        if (!allKeys.has(key)) {
          allKeys.set(key, { zh: false, en: false, locations });
        }
        allKeys.get(key)!.zh = true;
      }
      for (const { key, locations } of data.en) {
        if (!allKeys.has(key)) {
          allKeys.set(key, { zh: false, en: false, locations });
        }
        allKeys.get(key)!.en = true;
      }
      
      for (const [key, info] of allKeys) {
        const shortKey = key.split('.').slice(1).join('.');
        const missingZh = info.zh ? '🇨🇳' : '  ';
        const missingEn = info.en ? '🇺🇸' : '  ';
        log(`   ${missingZh}${missingEn} ${shortKey}`, 'yellow');
        
        if (verbose) {
          // 显示使用位置
          for (const loc of info.locations.slice(0, 3)) {
            log(`      ↳ ${loc.file}:${loc.line}`, 'gray');
            if (loc.context) {
              log(`        ${loc.context.slice(0, 60)}${loc.context.length > 60 ? '...' : ''}`, 'gray');
            }
          }
          if (info.locations.length > 3) {
            log(`      ... 还有 ${info.locations.length - 3} 处使用`, 'gray');
          }
        }
      }
    }
    
    log('\n' + '═'.repeat(80), 'red');
    log(`总计: 中文缺失 ${zhMissing.length} 个 | 英文缺失 ${enMissing.length} 个`, 'red');
  }
  
  // 5. 输出快速修复代码
  if (hasErrors && !shouldFix) {
    log('\n📋 快速修复代码 (添加到 zh.ts):', 'green');
    log('─'.repeat(60), 'green');
    
    const byNamespace = new Map<string, string[]>();
    for (const { key } of zhMissing) {
      const ns = key.split('.')[0];
      const shortKey = key.split('.').slice(1).join('.');
      if (!byNamespace.has(ns)) {
        byNamespace.set(ns, []);
      }
      byNamespace.get(ns)!.push(shortKey);
    }
    
    for (const [ns, keys] of byNamespace) {
      log(`\n  // ${ns} 命名空间缺失的键`, 'green');
      log(`  ${ns}: {`, 'green');
      for (const key of [...new Set(keys)]) {
        log(`    ${key}: '', // TODO: 添加中文翻译`, 'yellow');
      }
      log('  }', 'green');
    }
    
    log('\n📋 快速修复代码 (添加到 en.ts):', 'green');
    log('─'.repeat(60), 'green');
    
    const byNamespaceEn = new Map<string, string[]>();
    for (const { key } of enMissing) {
      const ns = key.split('.')[0];
      const shortKey = key.split('.').slice(1).join('.');
      if (!byNamespaceEn.has(ns)) {
        byNamespaceEn.set(ns, []);
      }
      byNamespaceEn.get(ns)!.push(shortKey);
    }
    
    for (const [ns, keys] of byNamespaceEn) {
      log(`\n  // ${ns} namespace missing keys`, 'green');
      log(`  ${ns}: {`, 'green');
      for (const key of [...new Set(keys)]) {
        log(`    ${key}: '', // TODO: Add English translation`, 'yellow');
      }
      log('  }', 'green');
    }
  }
  
  // 6. 自动修复
  if (shouldFix && hasErrors) {
    log('\n🔧 正在自动修复...', 'cyan');
    
    // 准备修复数据
    const zhFixData: Array<{ ns: string; key: string; fullKey: string }> = [];
    const enFixData: Array<{ ns: string; key: string; fullKey: string }> = [];
    
    for (const { key } of zhMissing) {
      const parts = key.split('.');
      zhFixData.push({ ns: parts[0], key: parts.slice(1).join('.'), fullKey: key });
    }
    for (const { key } of enMissing) {
      const parts = key.split('.');
      enFixData.push({ ns: parts[0], key: parts.slice(1).join('.'), fullKey: key });
    }
    
    // 由于自动修复比较复杂，这里只输出提示
    log('   ⚠️  自动修复功能需要手动确认，请参考上面的代码片段', 'yellow');
    log('   💡 建议: 复制代码片段到对应的翻译文件中', 'cyan');
  }
  
  // 7. 检查未使用的键
  if (!filterNs) {
    const unusedKeys = [...zhAllKeys].filter(k => !usedKeys.has(k));
    
    if (unusedKeys.length > 0) {
      log(`\n⚠️  未使用的翻译键 (${unusedKeys.length} 个，可保留):`, 'yellow');
      for (const key of unusedKeys.slice(0, 10)) {
        log(`   - ${key}`, 'blue');
      }
      if (unusedKeys.length > 10) {
        log(`   ... 还有 ${unusedKeys.length - 10} 个`, 'blue');
      }
    }
  }
  
  // 8. 显示使用帮助
  log('\n💡 使用帮助:', 'cyan');
  log('   npx tsx scripts/check-i18n.ts              # 检查所有', 'blue');
  log('   npx tsx scripts/check-i18n.ts --ns=sop     # 只检查 sop 命名空间', 'blue');
  log('   npx tsx scripts/check-i18n.ts --verbose    # 显示详细使用位置', 'blue');
  
  if (hasErrors) {
    log('\n❌ 发现缺失的翻译键！', 'red');
    process.exit(1);
  } else {
    log('\n✅ 检查通过！', 'green');
    process.exit(0);
  }
}

main().catch(err => {
  log(`\n❌ 错误: ${err.message}`, 'red');
  process.exit(1);
});
