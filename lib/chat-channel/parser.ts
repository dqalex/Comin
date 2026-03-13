/**
 * 对话信道数据交互模块 - 解析器
 * 
 * 解析 AI 回复中的 JSON actions 指令
 * 格式：{"actions": [{...}, {...}]}
 */

import type { Action, ActionType, ParseResult, UnrecognizedAction } from './types';
import { ACTION_DEFINITIONS, isChatSupported } from './actions';

// 所有有效的 action type 列表（缓存）
const VALID_ACTION_TYPES = Object.keys(ACTION_DEFINITIONS) as ActionType[];

/**
 * 计算两个字符串的编辑距离（Levenshtein）
 */
function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/**
 * 规范化 action type：将各种变体转换为标准 snake_case
 * 支持：camelCase, PascalCase, kebab-case, 带空格等
 */
function normalizeActionType(rawType: string): string {
  return rawType
    // camelCase / PascalCase → snake_case
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    // kebab-case → snake_case
    .replace(/-/g, '_')
    // 空格 → 下划线
    .replace(/\s+/g, '_')
    .toLowerCase();
}

/**
 * 模糊匹配 action type
 * 返回最佳匹配的 ActionType 和相似度分数
 */
function fuzzyMatchActionType(rawType: string): { matched: ActionType | null; distance: number; autoFix: boolean } {
  // 1. 先尝试规范化后精确匹配
  const normalized = normalizeActionType(rawType);
  if (ACTION_DEFINITIONS[normalized as ActionType]) {
    return { matched: normalized as ActionType, distance: 0, autoFix: true };
  }
  
  // 2. 编辑距离模糊匹配
  let bestMatch: ActionType | null = null;
  let bestDistance = Infinity;
  
  for (const validType of VALID_ACTION_TYPES) {
    const dist = levenshteinDistance(normalized, validType);
    if (dist < bestDistance) {
      bestDistance = dist;
      bestMatch = validType;
    }
  }
  
  // 编辑距离阈值：type 长度的 30% 以内认为可自动修正
  const threshold = Math.max(2, Math.floor(normalized.length * 0.3));
  const autoFix = bestDistance <= 2; // 编辑距离 ≤ 2 自动修正
  
  if (bestDistance <= threshold) {
    return { matched: bestMatch, distance: bestDistance, autoFix };
  }
  
  return { matched: bestMatch, distance: bestDistance, autoFix: false };
}

/** 快速检测文本中是否包含 actions 标记 */
const ACTIONS_QUICK_TEST = /\{"actions"\s*:\s*\[/;

/**
 * 从文本中提取所有平衡的 {"actions": [...]} JSON 块
 * 使用括号计数而非正则，正确处理嵌套数组/对象
 */
function extractBalancedActionsBlocks(text: string): string[] {
  const blocks: string[] = [];
  const marker = /\{"actions"\s*:\s*\[/g;
  let markerMatch: RegExpExecArray | null;
  
  while ((markerMatch = marker.exec(text)) !== null) {
    const start = markerMatch.index;
    let depth = 0;
    let inString = false;
    let escape = false;
    
    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      
      if (escape) {
        escape = false;
        continue;
      }
      
      if (ch === '\\' && inString) {
        escape = true;
        continue;
      }
      
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      
      if (inString) continue;
      
      if (ch === '{' || ch === '[') {
        depth++;
      } else if (ch === '}' || ch === ']') {
        depth--;
        if (depth === 0) {
          blocks.push(text.substring(start, i + 1));
          break;
        }
      }
    }
  }
  
  return blocks;
}

/** 单个 action 正则（用于 loose 模式匹配简单 action） */
const SINGLE_ACTION_REGEX_SOURCE = /\{"type"\s*:\s*"[^"]+"\s*[,\s\S]*?\}/;
function createSingleActionPattern(): RegExp {
  return new RegExp(SINGLE_ACTION_REGEX_SOURCE.source, 'g');
}

/**
 * 从 AI 回复文本中解析 actions
 * 
 * @param text AI 回复的完整文本
 * @returns 解析结果
 */
export function parseChatActions(text: string): ParseResult {
  const actions: Action[] = [];
  const unrecognized: UnrecognizedAction[] = [];
  let cleanContent = text;
  let parseError: string | undefined;
  
  // 查找所有 actions JSON 块（使用括号平衡算法，正确处理嵌套）
  const matches = extractBalancedActionsBlocks(text);
  
  if (matches) {
    for (const match of matches) {
      try {
        const parsed = JSON.parse(match);
        
        if (parsed.actions && Array.isArray(parsed.actions)) {
          for (const rawAction of parsed.actions) {
            // 验证并转换 action（支持模糊匹配）
            const result = validateAndConvertAction(rawAction);
            if (result.action) {
              actions.push(result.action);
            }
            if (result.unrecognized) {
              unrecognized.push(result.unrecognized);
            }
          }
        }
        
        // 从原文中移除 JSON 块
        cleanContent = cleanContent.replace(match, '').trim();
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : '未知解析错误';
        parseError = `JSON 解析失败: ${errorMsg}`;
        console.warn('[chat-channel/parser] Failed to parse actions JSON:', errorMsg);
      }
    }
  }
  
  // 清理多余的空行
  cleanContent = cleanContent
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  
  return {
    actions,
    cleanContent,
    hasActions: actions.length > 0,
    parseError,
    unrecognized: unrecognized.length > 0 ? unrecognized : undefined,
  };
}

/**
 * 验证并转换 action（支持模糊匹配）
 * 返回 action 和/或未识别信息
 */
function validateAndConvertAction(rawAction: unknown): { action: Action | null; unrecognized?: UnrecognizedAction } {
  if (typeof rawAction !== 'object' || rawAction === null) {
    return { action: null };
  }
  
  const action = rawAction as Record<string, unknown>;
  
  // 检查 type 字段
  if (!action.type || typeof action.type !== 'string') {
    console.warn('[chat-channel/parser] Action missing type field');
    return { action: null };
  }
  
  const rawType = action.type as string;
  let type = rawType as ActionType;
  
  // 精确匹配
  if (ACTION_DEFINITIONS[type]) {
    // 检查是否支持对话信道
    if (!isChatSupported(type)) {
      console.warn(`[chat-channel/parser] Action ${type} not supported in chat channel`);
      return { action: null };
    }
    return { action: normalizeAction(type, action) };
  }
  
  // 模糊匹配
  const fuzzyResult = fuzzyMatchActionType(rawType);
  
  if (fuzzyResult.autoFix && fuzzyResult.matched) {
    // 自动修正：相似度够高，直接使用修正后的 type
    type = fuzzyResult.matched;
    console.log(`[chat-channel/parser] 自动修正 action type: "${rawType}" → "${type}" (距离: ${fuzzyResult.distance})`);
    
    if (!isChatSupported(type)) {
      console.warn(`[chat-channel/parser] Action ${type} not supported in chat channel`);
      return {
        action: null,
        unrecognized: {
          originalType: rawType,
          suggestedType: type,
          autoFixed: false,
        },
      };
    }
    
    return {
      action: normalizeAction(type, { ...action, type }),
      unrecognized: {
        originalType: rawType,
        suggestedType: type,
        autoFixed: true,
      },
    };
  }
  
  // 无法自动修正，返回建议
  console.warn(`[chat-channel/parser] Unknown action type: "${rawType}"${fuzzyResult.matched ? `, 最近的匹配: "${fuzzyResult.matched}" (距离: ${fuzzyResult.distance})` : ''}`);
  return {
    action: null,
    unrecognized: {
      originalType: rawType,
      suggestedType: fuzzyResult.matched ?? undefined,
      autoFixed: false,
    },
  };
}

/**
 * 标准化 action 参数
 */
function normalizeAction(type: ActionType, raw: Record<string, unknown>): Action {
  // 复制所有字段
  const action: Action = {
    type,
    ...raw,
  } as Action;
  
  // 类型转换和清理
  if (action.task_id !== undefined) {
    action.task_id = String(action.task_id);
  }
  if (action.document_id !== undefined) {
    action.document_id = String(action.document_id);
  }
  if (action.project_id !== undefined) {
    action.project_id = String(action.project_id);
  }
  if (action.progress !== undefined) {
    action.progress = Number(action.progress);
  }
  if (action.member_id !== undefined) {
    action.member_id = String(action.member_id);
  }
  
  return action;
}

/**
 * 检查文本中是否包含 actions
 */
export function hasChatActions(text: string): boolean {
  // 使用非全局正则快速检测
  return ACTIONS_QUICK_TEST.test(text);
}

/**
 * 提取文本中所有 actions JSON 块
 */
export function extractActionJson(text: string): string[] {
  return extractBalancedActionsBlocks(text);
}

/**
 * 从非标准格式解析 actions（兼容处理）
 * 
 * 支持格式：
 * - 单个 action：{"type": "update_task_status", ...}
 * - actions 数组：[{"type": ...}, {"type": ...}]
 */
export function parseLooseActions(text: string): ParseResult {
  const actions: Action[] = [];
  const unrecognized: UnrecognizedAction[] = [];
  let cleanContent = text;
  
  // 尝试匹配单个 action
  const singleMatches = text.match(createSingleActionPattern());
  if (singleMatches) {
    for (const match of singleMatches) {
      try {
        const action = JSON.parse(match);
        const result = validateAndConvertAction(action);
        if (result.action) {
          actions.push(result.action);
          cleanContent = cleanContent.replace(match, '').trim();
        }
        if (result.unrecognized) {
          unrecognized.push(result.unrecognized);
        }
      } catch {
        // 忽略解析错误
      }
    }
  }
  
  // 如果没有找到单个 action，尝试标准格式
  if (actions.length === 0 && unrecognized.length === 0) {
    return parseChatActions(text);
  }
  
  cleanContent = cleanContent.replace(/\n{3,}/g, '\n\n').trim();
  
  return {
    actions,
    cleanContent,
    hasActions: actions.length > 0,
    unrecognized: unrecognized.length > 0 ? unrecognized : undefined,
  };
}

/**
 * 构建标准 actions JSON
 */
export function buildActionsJson(actions: Action[]): string {
  return JSON.stringify({ actions });
}

/**
 * 合并多个 actions（去重）
 */
export function mergeActions(existing: Action[], newActions: Action[]): Action[] {
  const merged = [...existing];
  
  for (const newAction of newActions) {
    // 简单去重：同类型同 task_id/document_id 的只保留最后一个
    const existingIndex = merged.findIndex(a => 
      a.type === newAction.type && 
      (a.task_id && a.task_id === newAction.task_id) ||
      (a.document_id && a.document_id === newAction.document_id)
    );
    
    if (existingIndex >= 0) {
      merged[existingIndex] = newAction;
    } else {
      merged.push(newAction);
    }
  }
  
  return merged;
}
