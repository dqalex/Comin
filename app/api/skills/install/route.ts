/**
 * Skill 安装 API
 * 
 * POST /api/skills/install - 从项目文件夹安装/更新 Skill
 * 
 * 请求体:
 * {
 *   skillPath: string;      // Skill 目录路径
 *   force?: boolean;        // 强制更新（忽略版本检查）
 * }
 * 
 * 功能:
 * - 新 Skill：创建并提交审批
 * - 已存在且版本更高：更新 Skill 信息
 * - 已存在且版本相同或更低：返回错误（除非 force=true）
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { skills, approvalRequests } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { generateIdWithPrefix } from '@/lib/id';
import { 
  validateSkillDirectory, 
  generateSkillKey, 
  extractNamespace,
  detectSensitiveContent 
} from '@/lib/skill-validator';
import { isVersionHigher, normalizeVersion } from '@/lib/version-utils';
import { eventBus } from '@/lib/event-bus';
import { withAuth, type AuthResult } from '@/lib/with-auth';
import { nanoid } from 'nanoid';
import { readFile } from 'fs/promises';
import path, { basename } from 'path';
import { getServerGatewayClient } from '@/lib/server-gateway-client';

/**
 * POST /api/skills/install - 安装或更新 Skill
 * 权限要求：管理员
 */
export const POST = withAuth(async (request: NextRequest, auth: AuthResult) => {
  try {
    // 权限检查：仅管理员可安装/更新 Skill
    if (auth.userRole !== 'admin') {
      return NextResponse.json(
        { error: 'Admin permission required to install skills' },
        { status: 403 }
      );
    }
    
    const body = await request.json();
    const { skillPath, force = false } = body;
    
    if (!skillPath) {
      return NextResponse.json(
        { error: 'skillPath is required' },
        { status: 400 }
      );
    }
    
    // 1. 验证 Skill 目录
    const validation = await validateSkillDirectory(skillPath);
    
    if (!validation.valid) {
      return NextResponse.json(
        { 
          error: 'Skill validation failed',
          details: validation.errors,
          warnings: validation.warnings,
        },
        { status: 400 }
      );
    }
    
    if (!validation.skill) {
      return NextResponse.json(
        { error: 'Skill structure not found' },
        { status: 400 }
      );
    }
    
    const skillData = validation.skill;
    const newVersion = normalizeVersion(skillData.version || '1.0.0');
    
    // 2. 读取 SKILL.md 内容
    let skillMdContent: string | null = null;
    try {
      const skillMdPath = path.join(skillPath, 'SKILL.md');
      skillMdContent = await readFile(skillMdPath, 'utf-8');
    } catch (err) {
      console.warn('Failed to read SKILL.md content:', err);
      // 不阻止安装，只是不存储原始内容
    }
    
    // 3. 生成 Skill Key - 使用目录名（与 Gateway 保持一致）
    const namespace = extractNamespace(skillPath);
    // Gateway 使用目录名作为 skillKey，例如 "teamclaw"
    const skillKey = namespace;
    
    // 4. 检查是否已存在
    const existing = await db
      .select()
      .from(skills)
      .where(eq(skills.skillKey, skillKey))
      .limit(1);
    
    // 5. 敏感内容检测
    const sensitiveDetection = detectSensitiveContent(
      `${skillData.name}\n${skillData.description}\n${skillData.objective || ''}\n${skillData.workflow || ''}`
    );
    
    const now = new Date();

    // 情况 A: 新 Skill - 创建
    if (existing.length === 0) {
      const skillId = generateIdWithPrefix('skill');

      await db.insert(skills).values({
        id: skillId,
        skillKey,
        name: skillData.name,
        description: skillData.description || '',
        version: newVersion,
        category: skillData.category || 'custom',
        source: 'teamclaw',
        sopTemplateId: null,
        createdBy: auth.userId!,
        trustStatus: 'pending',
        isSensitive: sensitiveDetection.isSensitive,
        sensitivityNote: sensitiveDetection.isSensitive 
          ? sensitiveDetection.reasons.join('; ')
          : null,
        status: 'draft',
        skillPath,
        skillMd: skillMdContent,
        createdAt: now,
        updatedAt: now,
      });
      
      // 创建审批请求
      const approvalId = nanoid(12);
      
      await db.insert(approvalRequests).values({
        id: approvalId,
        type: 'skill_publish',
        resourceType: 'skill',
        resourceId: skillId,
        requesterId: auth.userId!,
        payload: {
          skillKey,
          skillName: skillData.name,
          category: skillData.category,
          isSensitive: sensitiveDetection.isSensitive,
          validationWarnings: validation.warnings,
        } as Record<string, unknown>,
        requestNote: `Install skill from project folder: ${skillData.name}`,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      });
      
      // 发送 SSE 事件
      eventBus.emit({ 
        type: 'skill_update',
        resourceId: skillId,
        data: { 
          skillKey, 
          approvalId,
          isSensitive: sensitiveDetection.isSensitive,
        },
      });
      
      // 调用 Gateway 安装技能
      try {
        const gatewayClient = getServerGatewayClient();
        if (gatewayClient?.isConnected) {
          const skillDirName = basename(skillPath);
          await gatewayClient.request('skills.install', { 
            name: skillDirName, 
            installId: `install-${skillId}` 
          });
        }
      } catch (gatewayError) {
        console.warn('[Skill Install] Gateway install failed:', gatewayError);
        // Gateway 安装失败不阻止本地记录创建
      }
      
      return NextResponse.json({
        data: {
          id: skillId,
          skillKey,
          name: skillData.name,
          version: newVersion,
          status: 'draft',
          approvalId,
          action: 'created',
          isSensitive: sensitiveDetection.isSensitive,
          sensitivityReasons: sensitiveDetection.reasons,
          validationWarnings: validation.warnings,
        },
        message: sensitiveDetection.isSensitive 
          ? 'Skill installed with sensitive content detected. Approval required.'
          : 'Skill installed successfully. Waiting for approval.',
      }, { status: 201 });
    }
    
    // 情况 B: 已存在 - 检查是否需要更新
    const existingSkill = existing[0];
    const isUpdateAvailable = isVersionHigher(newVersion, existingSkill.version || '1.0.0');
    
    if (!isUpdateAvailable && !force) {
      return NextResponse.json({
        data: {
          id: existingSkill.id,
          skillKey,
          name: existingSkill.name,
          installedVersion: existingSkill.version,
          newVersion,
          action: 'no_update',
        },
        message: `Skill "${skillData.name}" is already installed with version ${existingSkill.version}. New version (${newVersion}) is not higher. Use force=true to override.`,
      }, { status: 200 });
    }
    
    // 情况 C: 更新现有 Skill
    // 权限已在入口处检查（仅管理员）
    
    // 更新 Skill
    await db
      .update(skills)
      .set({
        name: skillData.name,
        description: skillData.description || existingSkill.description,
        version: newVersion,
        category: skillData.category || existingSkill.category,
        isSensitive: sensitiveDetection.isSensitive,
        sensitivityNote: sensitiveDetection.isSensitive 
          ? sensitiveDetection.reasons.join('; ')
          : null,
        skillPath,
        skillMd: skillMdContent,
        updatedAt: now,
      })
      .where(eq(skills.id, existingSkill.id));
    
    // 发送 SSE 事件
    eventBus.emit({ 
      type: 'skill_update',
      resourceId: existingSkill.id,
      data: { 
        skillKey,
        previousVersion: existingSkill.version,
        newVersion,
      },
    });
    
    // 调用 Gateway 安装技能
    try {
      const gatewayClient = getServerGatewayClient();
      if (gatewayClient?.isConnected) {
        const skillDirName = basename(skillPath);
        await gatewayClient.request('skills.install', { 
          name: skillDirName, 
          installId: `install-${existingSkill.id}` 
        });
      }
    } catch (gatewayError) {
      console.warn('[Skill Install] Gateway install failed:', gatewayError);
    }
    
    return NextResponse.json({
      data: {
        id: existingSkill.id,
        skillKey,
        name: skillData.name,
        previousVersion: existingSkill.version,
        newVersion,
        action: 'updated',
        isSensitive: sensitiveDetection.isSensitive,
        sensitivityReasons: sensitiveDetection.reasons,
        validationWarnings: validation.warnings,
      },
      message: `Skill "${skillData.name}" updated from version ${existingSkill.version} to ${newVersion}.`,
    });
    
  } catch (error) {
    console.error('Error installing skill:', error);
    return NextResponse.json(
      { error: 'Failed to install skill' },
      { status: 500 }
    );
  }
});
