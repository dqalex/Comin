/**
 * 同步 landing MD 文件到数据库
 * 用法：npx tsx scripts/sync-landing.ts
 */

import { db, landingPages } from '../../db';
import { eq } from 'drizzle-orm';
import { readFileSync } from 'fs';
import { join } from 'path';

const LOCALES = ['en', 'zh'] as const;

async function syncLanding() {
  console.log('🔄 开始同步 landing page 内容...\n');

  for (const locale of LOCALES) {
    const mdPath = join(process.cwd(), 'docs', 'landing', `landing-${locale}.md`);
    
    try {
      const content = readFileSync(mdPath, 'utf-8');
      const landingId = locale === 'zh' ? 'landing-zh' : 'landing-en';
      
      // 检查是否存在
      const [existing] = await db.select()
        .from(landingPages)
        .where(eq(landingPages.id, landingId));
      
      if (existing) {
        // 更新
        await db.update(landingPages)
          .set({
            content,
            status: 'published',
            updatedAt: new Date(),
          })
          .where(eq(landingPages.id, landingId));
        console.log(`✅ 更新成功: ${locale} (${content.length} chars)`);
      } else {
        // 插入
        const now = new Date();
        await db.insert(landingPages).values({
          id: landingId,
          locale,
          title: locale === 'zh' ? 'TeamClaw 首页' : 'TeamClaw Landing',
          content,
          status: 'published',
          renderTemplateId: 'rt-builtin-landing-page',
          createdAt: now,
          updatedAt: now,
        });
        console.log(`✅ 创建成功: ${locale} (${content.length} chars)`);
      }
    } catch (error) {
      console.error(`❌ 同步失败 ${locale}:`, error);
    }
  }

  console.log('\n✨ 同步完成！');
  process.exit(0);
}

syncLanding().catch(console.error);
