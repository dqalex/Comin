/**
 * Skill 验证工具
 * 验证 SKILL.md 结构是否符合规范
 */

import { readFile, access } from 'fs/promises';
import { constants } from 'fs';
import path from 'path';

/**
 * Skill 结构定义（符合 skill-creator 规范）
 */
export interface SkillStructure {
  name: string;
  description: string;
  version?: string;
  category?: 'content' | 'analysis' | 'research' | 'development' | 'operations' | 'media' | 'custom';

  // 核心内容（推荐但非必需）
  objective?: string;        // 目标
  principles?: string[];     // 原则
  workflow?: string;         // 工作流程

  // 可选部分
  tools?: string[];          // 使用工具
  examples?: string[];       // 示例
  references?: string[];     // 参考资料
  validation?: string;       // 验证标准
}

/**
 * 验证结果
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  skill?: SkillStructure;
}

/**
 * 必需字段（仅 name 和 description）
 */
const REQUIRED_FIELDS = ['name', 'description'];

/**
 * 核心字段（缺失时警告，不阻止安装）
 */
const CORE_FIELDS = ['objective', 'workflow'];

/**
 * 推荐字段（缺失时警告）
 */
const RECOMMENDED_FIELDS = ['version', 'category', 'principles', 'tools'];

/**
 * 解析 SKILL.md 的 Front Matter
 * 支持 YAML front matter 格式
 */
function parseFrontMatter(content: string): Record<string, unknown> {
  const frontMatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);

  if (!frontMatterMatch) {
    return {};
  }

  const frontMatter = frontMatterMatch[1];
  const result: Record<string, unknown> = {};

  // 简单的 YAML 解析（仅支持 key: value 格式）
  const lines = frontMatter.split('\n');
  for (const line of lines) {
    const match = line.match(/^(\w+):\s*(.+)$/);
    if (match) {
      const key = match[1];
      let value: unknown = match[2].trim();

      // 尝试解析 JSON 值
      if (typeof value === 'string') {
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        } else if (value === 'true') {
          value = true;
        } else if (value === 'false') {
          value = false;
        } else if (value === 'null') {
          value = null;
        }
      }

      result[key] = value;
    }
  }

  return result;
}

/**
 * 验证 SKILL.md 文件内容
 */
export async function validateSkillMarkdown(content: string): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 解析 front matter
  const frontMatter = parseFrontMatter(content);

  // 1. 检查必需字段
  const fields: Partial<SkillStructure> = {};

  // 提取 name（优先 front matter）
  if (frontMatter.name) {
    fields.name = String(frontMatter.name);
  } else {
    const nameMatch = content.match(/^#\s+(.+)$/m);
    if (nameMatch) {
      fields.name = nameMatch[1].trim();
    } else {
      errors.push('Missing required field: name (should be # Title format or in front matter)');
    }
  }

  // 提取 description（优先 front matter）
  if (frontMatter.description) {
    fields.description = String(frontMatter.description);
  } else {
    // 提取第一个段落（跳过 front matter 和 blockquote）
    // 先移除 front matter
    let contentWithoutFrontMatter = content.replace(/^---\s*\n[\s\S]*?\n---\n?/, '');
    // 提取标题后第一个非 blockquote 段落
    const descMatch = contentWithoutFrontMatter.match(/^#\s+.+\n\n(?!>)([\s\S]+?)(?:\n\n|$)/);
    if (descMatch) {
      fields.description = descMatch[1].trim();
    } else {
      // 备用：尝试匹配标题后任意段落
      const altDescMatch = contentWithoutFrontMatter.match(/^#\s+.+\n\n([\s\S]+?)(?:\n\n|$)/);
      if (altDescMatch && !altDescMatch[1].trim().startsWith('>')) {
        fields.description = altDescMatch[1].trim();
      }
    }

    if (!fields.description) {
      errors.push('Missing required field: description (first paragraph after title or in front matter)');
    }
  }
  
  // 提取 objective（核心字段，缺失时警告）
  const objMatch = content.match(/^##\s+(?:目标|Objective)\s*\n([\s\S]+?)(?=\n##|\n###|$)/im);
  if (objMatch) {
    fields.objective = objMatch[1].trim();
  } else {
    warnings.push('Missing core field: objective (## 目标 or ## Objective) - recommended for skill clarity');
  }
  
  // 提取 workflow（核心字段，缺失时警告）
  const workflowMatch = content.match(/^##\s+(?:工作流程|Workflow)\s*\n([\s\S]+?)(?=\n##|\n###|$)/im);
  if (workflowMatch) {
    fields.workflow = workflowMatch[1].trim();
  } else {
    warnings.push('Missing core field: workflow (## 工作流程 or ## Workflow) - recommended for skill clarity');
  }
  
  // 提取可选字段
  // 版本：优先 front matter 的 teamclaw_version 或 version
  if (frontMatter.teamclaw_version) {
    fields.version = String(frontMatter.teamclaw_version);
  } else if (frontMatter.version) {
    fields.version = String(frontMatter.version);
  } else {
    const versionMatch = content.match(/^版本[：:]\s*(.+)$/m);
    if (versionMatch) {
      fields.version = versionMatch[1].trim();
    }
  }

  // 分类：优先 front matter
  if (frontMatter.category && typeof frontMatter.category === 'string') {
    const cat = frontMatter.category;
    if (['content', 'analysis', 'research', 'development', 'operations', 'media', 'custom'].includes(cat)) {
      fields.category = cat as SkillStructure['category'];
    }
  } else {
    const categoryMatch = content.match(/^分类[：:]\s*(.+)$/m);
    if (categoryMatch) {
      const cat = categoryMatch[1].trim();
      if (['content', 'analysis', 'research', 'development', 'operations', 'media', 'custom'].includes(cat)) {
        fields.category = cat as SkillStructure['category'];
      }
    }
  }

  // 提取 principles
  const principlesMatch = content.match(/^##\s+(?:原则|Principles)\s*\n([\s\S]+?)(?=\n##|\n###|$)/im);
  if (principlesMatch) {
    const lines = principlesMatch[1].trim().split('\n').filter(l => l.trim().startsWith('-'));
    fields.principles = lines.map(l => l.replace(/^-\s*/, '').trim());
  }
  
  // 提取 tools
  const toolsMatch = content.match(/^##\s+(?:工具|Tools)\s*\n([\s\S]+?)(?=\n##|\n###|$)/im);
  if (toolsMatch) {
    const lines = toolsMatch[1].trim().split('\n').filter(l => l.trim().startsWith('-'));
    fields.tools = lines.map(l => l.replace(/^-\s*/, '').trim());
  }
  
  // 2. 检查推荐字段
  if (!fields.version) {
    warnings.push('Missing recommended field: version');
  }
  if (!fields.category) {
    warnings.push('Missing recommended field: category');
  }
  if (!fields.principles || fields.principles.length === 0) {
    warnings.push('Missing recommended field: principles');
  }
  if (!fields.tools || fields.tools.length === 0) {
    warnings.push('Missing recommended field: tools');
  }
  
  // 3. 结构完整性检查
  if (!content.includes('## 目标') && !content.includes('## Objective')) {
    warnings.push('Consider using Chinese section headers for better localization');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    skill: errors.length === 0 ? (fields as SkillStructure) : undefined,
  };
}

/**
 * 验证 Skill 目录
 */
export async function validateSkillDirectory(skillPath: string): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  try {
    // 检查目录是否存在
    await access(skillPath, constants.R_OK);
    
    // 检查 SKILL.md 是否存在
    const skillMdPath = path.join(skillPath, 'SKILL.md');
    try {
      await access(skillMdPath, constants.R_OK);
    } catch {
      errors.push(`SKILL.md not found at ${skillMdPath}`);
      return { valid: false, errors, warnings };
    }
    
    // 读取并验证 SKILL.md 内容
    const content = await readFile(skillMdPath, 'utf-8');
    return validateSkillMarkdown(content);
    
  } catch (error) {
    errors.push(`Cannot access skill directory: ${skillPath}`);
    return { valid: false, errors, warnings };
  }
}

/**
 * 生成 Skill Key
 * 格式: <namespace>.<category>.<name>
 */
export function generateSkillKey(
  namespace: string,
  category: string,
  name: string
): string {
  // 规范化名称：转小写、空格转连字符、移除特殊字符
  const normalizedName = name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
  
  const normalizedCategory = category.toLowerCase().replace(/[^a-z0-9]/g, '');
  const normalizedNamespace = namespace.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  return `${normalizedNamespace}.${normalizedCategory}.${normalizedName}`;
}

/**
 * 从 Skill 路径提取命名空间
 */
export function extractNamespace(skillPath: string): string {
  // 从路径中提取：skills/<namespace>/<skill-name>
  const parts = skillPath.split('/');
  const skillsIndex = parts.findIndex(p => p === 'skills');
  
  if (skillsIndex >= 0 && skillsIndex + 1 < parts.length) {
    return parts[skillsIndex + 1];
  }
  
  return 'unknown';
}

/**
 * 敏感内容检测
 */
export function detectSensitiveContent(content: string): {
  isSensitive: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  
  // 检测敏感关键词
  const sensitivePatterns = [
    { pattern: /password/i, reason: 'Contains password-related content' },
    { pattern: /api[_-]?key/i, reason: 'Contains API key references' },
    { pattern: /secret/i, reason: 'Contains secret references' },
    { pattern: /token/i, reason: 'Contains token references' },
    { pattern: /private[_-]?key/i, reason: 'Contains private key references' },
    { pattern: /credential/i, reason: 'Contains credential references' },
  ];
  
  for (const { pattern, reason } of sensitivePatterns) {
    if (pattern.test(content)) {
      reasons.push(reason);
    }
  }
  
  return {
    isSensitive: reasons.length > 0,
    reasons,
  };
}
