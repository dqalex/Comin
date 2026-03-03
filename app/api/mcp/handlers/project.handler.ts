/**
 * MCP Handler: 项目操作
 */

import { db } from '@/db';
import { projects, members } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { sanitizeMember } from '@/lib/sanitize';

export async function handleGetProject(params: Record<string, unknown>) {
  const { project_id } = params as { project_id: string };
  const [project] = await db.select().from(projects).where(eq(projects.id, project_id));
  if (!project) {
    return { success: false, error: '项目不存在' };
  }
  return { success: true, data: project };
}

export async function handleGetProjectMembers(params: Record<string, unknown> = {}) {
  const { project_id } = params as { project_id?: string };
  // 当前成员不按项目分组，返回所有成员（保留参数以便后续扩展项目-成员关系）
  const allMembers = await db.select().from(members);
  return { success: true, data: allMembers.map(m => sanitizeMember(m)) };
}
