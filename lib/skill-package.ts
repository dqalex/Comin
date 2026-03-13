/**
 * Skill 安装包处理
 * 
 * 提供 Skill 安装包的打包和解析功能
 * 支持 .skill.zip 格式
 * 
 * @module lib/skill-package
 */

import type { 
  SOPTemplate, 
  SOPStage,
  ReferenceFile, 
  ScriptFile 
} from '@/db/schema';
import { 
  generateSkillFromSOP, 
  type SkillPackage, 
  type SkillManifest 
} from './skill-generator';
import { generateId } from './id';

// ============================================================================
// 类型定义
// ============================================================================

/** 解析结果 */
export interface ParseResult {
  success: boolean;
  error?: string;
  template?: Partial<SOPTemplate>;
  references?: ReferenceFile[];
  scripts?: ScriptFile[];
  manifest?: SkillManifest;
}

/** Zip 文件结构 */
interface ZipFileStructure {
  'SKILL.md': string;
  'manifest.json': string;
  'references'?: Record<string, string>;
  'scripts'?: Record<string, string>;
}

// ============================================================================
// 打包函数（纯 JS 实现，用于服务器端）
// ============================================================================

/**
 * 生成 Skill 安装包的文件结构
 * 
 * 注意：此函数返回文件结构对象，实际的 zip 打包需要在前端或通过 API 完成
 * 因为 Node.js 端没有内置的 zip 库，需要前端使用 JSZip 或类似库
 */
export function createSkillPackageFiles(
  template: SOPTemplate
): ZipFileStructure {
  const skillMd = generateSkillFromSOP(template);
  const references = template.references || [];
  const scripts = template.scripts || [];
  
  // 计算 checksum
  let checksum = 5381;
  for (let i = 0; i < skillMd.length; i++) {
    checksum = ((checksum << 5) + checksum) + skillMd.charCodeAt(i);
    checksum = checksum & checksum;
  }
  
  const manifest: SkillManifest = {
    version: template.version || '1.0.0',
    format: 'teamclaw-skill-package',
    sopTemplateId: template.id,
    createdAt: new Date().toISOString(),
    checksum: Math.abs(checksum).toString(16).padStart(8, '0'),
  };

  const files: ZipFileStructure = {
    'SKILL.md': skillMd,
    'manifest.json': JSON.stringify(manifest, null, 2),
  };

  // 添加参考文档
  if (references.length > 0) {
    files.references = {};
    references.forEach(ref => {
      files.references![ref.filename] = ref.content;
    });
  }

  // 添加脚本文件
  if (scripts.length > 0) {
    files.scripts = {};
    scripts.forEach(script => {
      files.scripts![script.filename] = script.content;
    });
  }

  return files;
}

/**
 * 从 SkillPackage 创建文件结构
 */
export function createFilesFromSkillPackage(pkg: SkillPackage): ZipFileStructure {
  const files: ZipFileStructure = {
    'SKILL.md': pkg.skillMd,
    'manifest.json': JSON.stringify(pkg.manifest, null, 2),
  };

  if (pkg.references.length > 0) {
    files.references = {};
    pkg.references.forEach(ref => {
      files.references![ref.filename] = ref.content;
    });
  }

  if (pkg.scripts.length > 0) {
    files.scripts = {};
    pkg.scripts.forEach(script => {
      files.scripts![script.filename] = script.content;
    });
  }

  return files;
}

// ============================================================================
// 解析函数
// ============================================================================

/**
 * 解析 Skill 安装包文件结构
 */
export function parseSkillPackageFiles(files: ZipFileStructure): ParseResult {
  try {
    // 验证必要文件
    if (!files['SKILL.md']) {
      return { success: false, error: 'Missing SKILL.md' };
    }
    if (!files['manifest.json']) {
      return { success: false, error: 'Missing manifest.json' };
    }

    // 解析 manifest
    let manifest: SkillManifest;
    try {
      manifest = JSON.parse(files['manifest.json']);
    } catch {
      return { success: false, error: 'Invalid manifest.json format' };
    }

    // 验证 manifest 格式
    if (manifest.format !== 'teamclaw-skill-package') {
      return { success: false, error: `Invalid package format: ${manifest.format}` };
    }

    // 解析 SKILL.md
    const skillMd = files['SKILL.md'];
    const parseResult = parseSkillMd(skillMd);
    
    if (!parseResult.success) {
      return { success: false, error: parseResult.error };
    }

    // 解析参考文档
    const references: ReferenceFile[] = [];
    if (files.references) {
      const now = new Date().toISOString();
      for (const [filename, content] of Object.entries(files.references)) {
        references.push({
          id: generateId(),
          filename,
          title: extractTitle(content) || filename.replace('.md', ''),
          content,
          type: inferReferenceType(filename),
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    // 解析脚本文件
    const scripts: ScriptFile[] = [];
    if (files.scripts) {
      const now = new Date().toISOString();
      for (const [filename, content] of Object.entries(files.scripts)) {
        scripts.push({
          id: generateId(),
          filename,
          description: extractDescription(content) ?? undefined,
          content,
          type: inferScriptType(filename),
          executable: filename.endsWith('.sh') || filename.endsWith('.py'),
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    return {
      success: true,
      template: parseResult.template,
      references,
      scripts,
      manifest,
    };
  } catch (error) {
    return { 
      success: false, 
      error: `Parse error: ${error instanceof Error ? error.message : String(error)}` 
    };
  }
}

/**
 * 解析 SKILL.md 内容
 */
function parseSkillMd(content: string): ParseResult {
  try {
    // 提取 frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) {
      return { success: false, error: 'Missing YAML frontmatter' };
    }

    const frontmatterText = frontmatterMatch[1];
    const frontmatter = parseYamlFrontmatter(frontmatterText);

    // 提取标题
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const name = titleMatch ? titleMatch[1] : frontmatter.name || 'Unknown Skill';

    // 提取描述
    const descMatch = content.match(/^> 📌 本 Skill 由 TeamClaw 自动生成/m);
    let description = '';
    if (descMatch) {
      const beforeDesc = content.slice(0, descMatch.index);
      const lines = beforeDesc.split('\n').filter(l => 
        l.trim() && !l.startsWith('#') && !l.startsWith('---') && !l.startsWith('>')
      );
      description = lines.join('\n').trim();
    }

    // 提取阶段（简化版本，只解析基本结构）
    const stages = extractStages(content);

    // 构建模板数据
    const template: Partial<SOPTemplate> = {
      id: frontmatter.sopTemplateId || generateId(),
      name,
      description,
      category: (frontmatter.category || 'custom') as 'custom' | 'content' | 'analysis' | 'research' | 'development' | 'operations' | 'media',
      version: frontmatter.version || '1.0.0',
      stages: stages as SOPStage[],
      status: 'draft',
    };

    return { success: true, template };
  } catch (error) {
    return { 
      success: false, 
      error: `SKILL.md parse error: ${error instanceof Error ? error.message : String(error)}` 
    };
  }
}

/**
 * 解析 YAML frontmatter（简化实现）
 */
function parseYamlFrontmatter(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = text.split('\n');
  
  for (const line of lines) {
    const match = line.match(/^(\w+):\s*(.+)$/);
    if (match) {
      const [, key, value] = match;
      // 移除引号
      result[key] = value.replace(/^["']|["']$/g, '');
    }
  }
  
  return result;
}

/**
 * 提取阶段信息（简化版本）
 */
function extractStages(content: string): unknown[] {
  const stages: unknown[] = [];
  const stageMatches = content.matchAll(/## 阶段 (\d+): (.+?)\n([\s\S]*?)(?=## 阶段|$)/g);
  
  for (const match of stageMatches) {
    const [, numStr, label, body] = match;
    const num = parseInt(numStr, 10);
    
    // 跳过固定阶段（0 和 N+1）
    if (num === 0 || body.includes('N+1')) continue;
    
    // 提取类型
    const typeMatch = body.match(/\*\*类型\*\*:\s*(\w+)/);
    const type = typeMatch ? typeMatch[1] : 'ai_auto';
    
    // 提取 AI 指令
    const promptMatch = body.match(/### AI 指令\s*\n```\s*\n([\s\S]*?)\n```/);
    const promptTemplate = promptMatch ? promptMatch[1] : undefined;
    
    stages.push({
      id: `stage-${num}`,
      label,
      type,
      promptTemplate,
    });
  }
  
  return stages;
}

/**
 * 从 Markdown 内容提取标题
 */
function extractTitle(content: string): string | null {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1] : null;
}

/**
 * 从内容提取描述（第一段非标题文本）
 */
function extractDescription(content: string): string | null {
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('```')) {
      return trimmed.slice(0, 100); // 限制长度
    }
  }
  return null;
}

/**
 * 根据文件名推断参考文档类型
 */
function inferReferenceType(filename: string): ReferenceFile['type'] {
  if (filename.includes('template') || filename.includes('模板')) return 'template';
  if (filename.includes('guide') || filename.includes('指南')) return 'guide';
  if (filename.includes('example') || filename.includes('示例')) return 'example';
  return 'doc';
}

/**
 * 根据文件名推断脚本类型
 */
function inferScriptType(filename: string): ScriptFile['type'] {
  if (filename.endsWith('.sh')) return 'bash';
  if (filename.endsWith('.py')) return 'python';
  if (filename.endsWith('.js') || filename.endsWith('.mjs')) return 'node';
  return 'other';
}

// ============================================================================
// 导出
// ============================================================================

export default {
  createSkillPackageFiles,
  createFilesFromSkillPackage,
  parseSkillPackageFiles,
};
