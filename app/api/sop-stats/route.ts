/**
 * SOP 执行统计 API
 * 
 * 提供以下统计数据：
 * - SOP 执行次数/成功率
 * - 平均阶段耗时
 * - AI 成员活跃度
 * - 任务完成率趋势
 */

import { NextRequest, NextResponse } from 'next/server';

// 标记为动态路由，避免静态生成错误
export const dynamic = 'force-dynamic';
import { db, tasks, sopTemplates, activityLogs, members } from '@/db';
import { and, eq, sql, gte, lte, desc } from 'drizzle-orm';
import { generateId } from '@/lib/id';
import { successResponse, errorResponse, ApiErrors } from '@/lib/api-route-factory';

interface StageStats {
  stageId: string;
  stageLabel: string;
  avgDuration: number; // ms
  successRate: number; // 0-100
  executionCount: number;
}

interface SOPStats {
  templateId: string;
  templateName: string;
  totalExecutions: number;
  successCount: number;
  failureCount: number;
  avgDuration: number; // ms
  stageStats: StageStats[];
}

interface DailyTrend {
  date: string;
  completed: number;
  created: number;
  inProgress: number;
}

interface MemberActivity {
  memberId: string;
  memberName: string;
  actionCount: number;
  lastActiveAt: Date | null;
  topActions: { action: string; count: number }[];
}

interface SOPStatsResponse {
  // 概览统计
  overview: {
    totalSOPTasks: number;
    completedSOPTasks: number;
    inProgressSOPTasks: number;
    avgCompletionTime: number; // ms
    successRate: number; // 0-100
  };
  // 模板统计
  templates: SOPStats[];
  // 任务完成趋势（最近 7 天）
  dailyTrend: DailyTrend[];
  // AI 成员活跃度
  memberActivity: MemberActivity[];
}

export async function GET(request: NextRequest) {
  const requestId = generateId();
  try {
    const searchParams = request.nextUrl.searchParams;
    const projectId = searchParams.get('projectId');
    const days = parseInt(searchParams.get('days') || '7', 10);
    
    const now = new Date();
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const startTimestamp = Math.floor(startDate.getTime() / 1000);

    // 1. 获取 SOP 任务概览
    const sopTasks = await db.select()
      .from(tasks)
      .where(projectId 
        ? and(sql`${tasks.sopTemplateId} IS NOT NULL`, eq(tasks.projectId, projectId))
        : sql`${tasks.sopTemplateId} IS NOT NULL`
      );

    const completedTasks = sopTasks.filter(t => t.status === 'completed');
    const inProgressTasks = sopTasks.filter(t => ['in_progress', 'reviewing'].includes(t.status));

    // 计算平均完成时间
    let totalCompletionTime = 0;
    let completionCount = 0;
    
    for (const task of completedTasks) {
      if (task.stageHistory && Array.isArray(task.stageHistory) && task.stageHistory.length > 0) {
        const history = task.stageHistory as Array<{ startedAt?: string; completedAt?: string; status: string }>;
        const firstStage = history[0];
        const lastStage = history[history.length - 1];
        
        if (firstStage?.startedAt && lastStage?.completedAt) {
          const duration = new Date(lastStage.completedAt).getTime() - new Date(firstStage.startedAt).getTime();
          if (duration > 0) {
            totalCompletionTime += duration;
            completionCount++;
          }
        }
      }
    }

    const avgCompletionTime = completionCount > 0 ? totalCompletionTime / completionCount : 0;

    // 2. 按模板统计
    const templateMap = new Map<string, {
      templateId: string;
      templateName: string;
      tasks: typeof sopTasks;
    }>();

    for (const task of sopTasks) {
      if (task.sopTemplateId) {
        if (!templateMap.has(task.sopTemplateId)) {
          templateMap.set(task.sopTemplateId, {
            templateId: task.sopTemplateId,
            templateName: 'Unknown',
            tasks: [],
          });
        }
        templateMap.get(task.sopTemplateId)!.tasks.push(task);
      }
    }

    // 获取模板名称
    const templateIds = Array.from(templateMap.keys());
    const templates = templateIds.length > 0 
      ? await db.select().from(sopTemplates).where(sql`${sopTemplates.id} IN (${sql.raw(templateIds.map(id => `'${id}'`).join(','))})`)
      : [];
    
    for (const template of templates) {
      const entry = templateMap.get(template.id);
      if (entry) {
        entry.templateName = template.name;
      }
    }

    const templateStats: SOPStats[] = Array.from(templateMap.values()).map(entry => {
      const completed = entry.tasks.filter(t => t.status === 'completed').length;
      const failed = entry.tasks.filter(t => t.status === 'todo' && t.stageHistory && (t.stageHistory as Array<{ status: string }>).some(s => s.status === 'failed')).length;
      
      return {
        templateId: entry.templateId,
        templateName: entry.templateName,
        totalExecutions: entry.tasks.length,
        successCount: completed,
        failureCount: failed,
        avgDuration: 0, // TODO: 计算平均时长
        stageStats: [], // TODO: 计算阶段统计
      };
    });

    // 3. 任务完成趋势（最近 N 天）
    const dailyTrend: DailyTrend[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      const dayStart = new Date(dateStr + 'T00:00:00.000Z');
      const dayEnd = new Date(dateStr + 'T23:59:59.999Z');
      
      const dayTasks = sopTasks.filter(t => {
        const createdAt = t.createdAt ? new Date(t.createdAt) : null;
        const updatedAt = t.updatedAt ? new Date(t.updatedAt) : null;
        return (createdAt && createdAt >= dayStart && createdAt <= dayEnd) ||
               (updatedAt && updatedAt >= dayStart && updatedAt <= dayEnd);
      });

      dailyTrend.push({
        date: dateStr,
        created: dayTasks.filter(t => t.createdAt && new Date(t.createdAt) >= dayStart && new Date(t.createdAt) <= dayEnd).length,
        completed: dayTasks.filter(t => t.status === 'completed' && t.updatedAt && new Date(t.updatedAt) >= dayStart && new Date(t.updatedAt) <= dayEnd).length,
        inProgress: dayTasks.filter(t => ['in_progress', 'reviewing'].includes(t.status)).length,
      });
    }

    // 4. AI 成员活跃度
    const aiMembers = await db.select()
      .from(members)
      .where(eq(members.type, 'ai'));

    const memberIds = aiMembers.map(m => m.id);
    
    const recentActivity = memberIds.length > 0
      ? await db.select()
          .from(activityLogs)
          .where(and(
            sql`${activityLogs.memberId} IN (${sql.raw(memberIds.map(id => `'${id}'`).join(','))})`,
            gte(activityLogs.createdAt, new Date(startTimestamp * 1000))
          ))
          .orderBy(desc(activityLogs.createdAt))
          .limit(500)
      : [];

    const memberActivity: MemberActivity[] = aiMembers.map(member => {
      const memberLogs = recentActivity.filter(log => log.memberId === member.id);
      
      // 统计 action 数量
      const actionCounts = new Map<string, number>();
      for (const log of memberLogs) {
        const count = actionCounts.get(log.action) || 0;
        actionCounts.set(log.action, count + 1);
      }
      
      const topActions = Array.from(actionCounts.entries())
        .map(([action, count]) => ({ action, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      return {
        memberId: member.id,
        memberName: member.name || 'Unknown',
        actionCount: memberLogs.length,
        lastActiveAt: memberLogs[0]?.createdAt || null,
        topActions,
      };
    }).sort((a, b) => b.actionCount - a.actionCount);

    const response: SOPStatsResponse = {
      overview: {
        totalSOPTasks: sopTasks.length,
        completedSOPTasks: completedTasks.length,
        inProgressSOPTasks: inProgressTasks.length,
        avgCompletionTime,
        successRate: sopTasks.length > 0 ? (completedTasks.length / sopTasks.length) * 100 : 0,
      },
      templates: templateStats,
      dailyTrend,
      memberActivity,
    };

    return successResponse(response);
  } catch (error) {
    console.error(`[GET /api/sop-stats] ${requestId}:`, error);
    return errorResponse(ApiErrors.internal('Failed to fetch SOP statistics'), requestId);
  }
}
