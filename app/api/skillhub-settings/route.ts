/**
 * SkillHub 设置 API
 * 
 * GET - 获取 SkillHub 设置
 * PUT - 更新 SkillHub 设置（仅管理员）
 * 
 * 设置存储在系统配置表中
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { systemConfig } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { withAuth, type AuthResult } from '@/lib/with-auth';

export const dynamic = 'force-dynamic';

const CONFIG_KEY = 'skillhub_settings';

// 默认设置
const DEFAULT_SETTINGS = {
  publishMode: 'disabled' as const,
  externalHubUrl: '',
  externalHubApiKey: '',
  autoDiscoverEnabled: true,
  autoDiscoverInterval: 24,
  autoSnapshotEnabled: true,
  autoSnapshotInterval: 6,
};

// GET /api/skillhub-settings
export const GET = withAuth(async (
  request: NextRequest,
  auth: AuthResult
): Promise<NextResponse> => {
  try {
    const [config] = await db
      .select()
      .from(systemConfig)
      .where(eq(systemConfig.key, CONFIG_KEY))
      .limit(1);
    
    const settings = config?.value 
      ? { ...DEFAULT_SETTINGS, ...(config.value as Record<string, unknown>) }
      : DEFAULT_SETTINGS;
    
    // 脱敏 API Key
    const sanitizedSettings = {
      ...settings,
      externalHubApiKey: settings.externalHubApiKey 
        ? '••••••••' + (settings.externalHubApiKey as string).slice(-4)
        : '',
    };
    
    return NextResponse.json({ settings: sanitizedSettings });
  } catch (error) {
    console.error('[GET /api/skillhub-settings] Error:', error);
    return NextResponse.json(
      { error: 'Failed to load settings' },
      { status: 500 }
    );
  }
});

// PUT /api/skillhub-settings
export const PUT = withAuth(async (
  request: NextRequest,
  auth: AuthResult
): Promise<NextResponse> => {
  try {
    // 仅管理员可操作
    if (auth.userRole !== 'admin') {
      return NextResponse.json(
        { error: 'Only admin can update settings' },
        { status: 403 }
      );
    }
    
    const body = await request.json();
    
    // 验证字段
    const settings: Record<string, unknown> = {};
    
    if (body.publishMode !== undefined) {
      if (!['disabled', 'admin_only', 'auto'].includes(body.publishMode)) {
        return NextResponse.json({ error: 'Invalid publishMode' }, { status: 400 });
      }
      settings.publishMode = body.publishMode;
    }
    
    if (body.externalHubUrl !== undefined) {
      settings.externalHubUrl = String(body.externalHubUrl);
    }
    
    if (body.externalHubApiKey !== undefined && body.externalHubApiKey !== '' && !body.externalHubApiKey.startsWith('••')) {
      settings.externalHubApiKey = String(body.externalHubApiKey);
    }
    
    if (body.autoDiscoverEnabled !== undefined) {
      settings.autoDiscoverEnabled = Boolean(body.autoDiscoverEnabled);
    }
    
    if (body.autoDiscoverInterval !== undefined) {
      const interval = parseInt(body.autoDiscoverInterval);
      if (isNaN(interval) || interval < 1 || interval > 168) {
        return NextResponse.json({ error: 'Invalid autoDiscoverInterval' }, { status: 400 });
      }
      settings.autoDiscoverInterval = interval;
    }
    
    if (body.autoSnapshotEnabled !== undefined) {
      settings.autoSnapshotEnabled = Boolean(body.autoSnapshotEnabled);
    }
    
    if (body.autoSnapshotInterval !== undefined) {
      const interval = parseInt(body.autoSnapshotInterval);
      if (isNaN(interval) || interval < 1 || interval > 72) {
        return NextResponse.json({ error: 'Invalid autoSnapshotInterval' }, { status: 400 });
      }
      settings.autoSnapshotInterval = interval;
    }
    
    // 获取现有配置
    const [existing] = await db
      .select()
      .from(systemConfig)
      .where(eq(systemConfig.key, CONFIG_KEY))
      .limit(1);
    
    const mergedSettings = existing?.value
      ? { ...DEFAULT_SETTINGS, ...(existing.value as Record<string, unknown>), ...settings }
      : { ...DEFAULT_SETTINGS, ...settings };
    
    const now = new Date();
    
    if (existing) {
      await db
        .update(systemConfig)
        .set({
          value: mergedSettings,
          updatedAt: now,
        })
        .where(eq(systemConfig.key, CONFIG_KEY));
    } else {
      await db.insert(systemConfig).values({
        key: CONFIG_KEY,
        value: mergedSettings,
        description: 'SkillHub 发布和自动化设置',
        createdAt: now,
        updatedAt: now,
      });
    }
    
    return NextResponse.json({ success: true, settings: mergedSettings });
  } catch (error) {
    console.error('[PUT /api/skillhub-settings] Error:', error);
    return NextResponse.json(
      { error: 'Failed to save settings' },
      { status: 500 }
    );
  }
});
