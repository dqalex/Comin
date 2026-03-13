/**
 * Skill 发现 API
 * 
 * GET /api/skills/discover - 扫描项目 skills 文件夹，发现可安装的 Skill
 * 
 * 返回:
 * - 发现的 Skill 列表（包含版本信息）
 * - 安装状态（未安装/已安装/可更新）
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { skills } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { discoverSkills, compareWithInstalledSkills } from '@/lib/skill-discovery';
import { withAuth, type AuthResult } from '@/lib/with-auth';

/**
 * GET /api/skills/discover - 发现项目内可安装的 Skill
 * 权限要求：管理员
 */
export const GET = withAuth(async (request: NextRequest, auth: AuthResult) => {
  try {
    // 权限检查：仅管理员可发现/安装 Skill
    if (auth.userRole !== 'admin') {
      return NextResponse.json(
        { error: 'Admin permission required to discover skills' },
        { status: 403 }
      );
    }
    
    // 1. 扫描 skills 文件夹
    const discoveryResult = await discoverSkills();
    
    // 2. 获取已安装的 Skill（包括 draft/pending_approval/active 状态）
    // draft = 已发现未激活, pending_approval = 待审批, active = 已激活
    // 都不应该显示为"未安装"
    const installedSkills = await db
      .select({
        id: skills.id,
        skillKey: skills.skillKey,
        version: skills.version,
        status: skills.status,
      })
      .from(skills)
      .where(inArray(skills.status, ['draft', 'pending_approval', 'active']));
    
    // 3. 对比发现的 Skill 与已安装的
    const skillsWithStatus = compareWithInstalledSkills(
      discoveryResult.skills,
      installedSkills
    );
    
    // 4. 分类统计
    const stats = {
      total: skillsWithStatus.length,
      valid: skillsWithStatus.filter(s => s.valid).length,
      notInstalled: skillsWithStatus.filter(s => s.installStatus === 'not_installed').length,
      installed: skillsWithStatus.filter(s => s.installStatus === 'installed').length,
      updateAvailable: skillsWithStatus.filter(s => s.installStatus === 'update_available').length,
    };
    
    return NextResponse.json({
      skills: skillsWithStatus,
      stats,
      skillsFolderPath: discoveryResult.skillsFolderPath,
      errors: discoveryResult.errors.length > 0 ? discoveryResult.errors : undefined,
    });
    
  } catch (error) {
    console.error('Error discovering skills:', error);
    return NextResponse.json(
      { error: 'Failed to discover skills' },
      { status: 500 }
    );
  }
});
