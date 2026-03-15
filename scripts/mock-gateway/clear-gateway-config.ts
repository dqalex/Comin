/**
 * 清除 Gateway 配置
 * 
 * 用途：删除所有 Gateway 配置，用于重置测试环境
 */

import { db } from '../../db';
import { gatewayConfigs } from '../../db/schema';
import { eq } from 'drizzle-orm';

async function clearGatewayConfig() {
  console.log('🧹 清除 Gateway 配置...\n');

  try {
    const existing = await db.select().from(gatewayConfigs);
    
    if (existing.length === 0) {
      console.log('ℹ️  没有现有的 Gateway 配置');
      return;
    }

    // 删除所有配置
    for (const config of existing) {
      await db.delete(gatewayConfigs).where(eq(gatewayConfigs.id, config.id));
      console.log(`   ✓ 已删除配置: ${config.id}`);
    }

    console.log('\n✅ 所有 Gateway 配置已清除');

  } catch (error) {
    console.error('❌ 清除失败:', error);
    process.exit(1);
  }
}

clearGatewayConfig();
