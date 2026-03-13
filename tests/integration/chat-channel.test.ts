/**
 * 对话信道数据交互模块 - 单元测试
 * 
 * 测试覆盖：
 * - 解析器
 * - 类型验证
 * - 错误处理
 * - 日志系统
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  parseChatActions,
  hasChatActions,
  buildActionsJson,
  validateActionParams,
  isChatSupported,
  getChatSupportedActions,
  ChannelLogger,
  generateRequestId,
  ActionError,
  ErrorCode,
  missingParamError,
  toActionError,
  isRetryable,
  ActionType,
} from '@/lib/chat-channel';

// ============================================================================
// 解析器测试
// ============================================================================

describe('Parser', () => {
  describe('parseChatActions', () => {
    it('应该正确解析标准格式的 actions', () => {
      const text = '任务已开始执行！{"actions":[{"type":"update_task_status","task_id":"task-123","status":"in_progress"}]}';
      const result = parseChatActions(text);
      
      expect(result.hasActions).toBe(true);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].type).toBe('update_task_status');
      expect(result.actions[0].task_id).toBe('task-123');
      expect(result.cleanContent).toBe('任务已开始执行！');
    });

    it('应该正确解析多个 actions', () => {
      const text = '{"actions":[{"type":"update_task_status","task_id":"task-123","status":"in_progress"},{"type":"add_comment","task_id":"task-123","content":"开始执行"}]}';
      const result = parseChatActions(text);
      
      expect(result.actions).toHaveLength(2);
      expect(result.actions[0].type).toBe('update_task_status');
      expect(result.actions[1].type).toBe('add_comment');
    });

    it('应该清理多余的空行', () => {
      const text = '内容1\n\n\n\n\n内容2{"actions":[{"type":"update_status","status":"working"}]}';
      const result = parseChatActions(text);
      
      expect(result.cleanContent).toBe('内容1\n\n内容2');
    });

    it('应该过滤不支持对话信道的 actions', () => {
      const text = '{"actions":[{"type":"get_task","task_id":"task-123"}]}';
      const result = parseChatActions(text);
      
      // get_task 不支持对话信道
      expect(result.actions).toHaveLength(0);
    });

    it('应该处理无效 JSON', () => {
      const text = '{"actions":[{"type":"update_task_status"';
      const result = parseChatActions(text);
      
      // 无效 JSON 无法解析出 actions，返回空数组
      expect(result.actions).toHaveLength(0);
      expect(result.hasActions).toBe(false);
    });

    it('应该处理没有 actions 的文本', () => {
      const text = '这是一条普通的回复，没有 actions';
      const result = parseChatActions(text);
      
      expect(result.hasActions).toBe(false);
      expect(result.actions).toHaveLength(0);
      expect(result.cleanContent).toBe(text);
    });
  });

  describe('hasChatActions', () => {
    it('应该检测到 actions', () => {
      const text = '{"actions":[{"type":"update_status","status":"working"}]}';
      expect(hasChatActions(text)).toBe(true);
    });

    it('应该检测到嵌入在文本中的 actions', () => {
      const text = '好的，我来处理这个任务。{"actions":[{"type":"update_status","status":"working"}]}';
      expect(hasChatActions(text)).toBe(true);
    });

    it('应该对没有 actions 的文本返回 false', () => {
      const text = '这是一条普通的回复';
      expect(hasChatActions(text)).toBe(false);
    });
  });

  describe('buildActionsJson', () => {
    it('应该构建标准格式的 actions JSON', () => {
      const actions = [
        { type: 'update_task_status' as const, task_id: 'task-123', status: 'in_progress' as const },
      ];
      const json = buildActionsJson(actions);
      const parsed = JSON.parse(json);
      
      expect(parsed.actions).toHaveLength(1);
      expect(parsed.actions[0].type).toBe('update_task_status');
    });
  });
});

// ============================================================================
// Action 验证测试
// ============================================================================

describe('Action Validation', () => {
  describe('validateActionParams', () => {
    it('应该通过有效参数', () => {
      const result = validateActionParams('update_task_status', {
        task_id: 'task-123',
        status: 'in_progress',
      });
      
      expect(result.valid).toBe(true);
      expect(result.missing).toHaveLength(0);
    });

    it('应该检测缺失的必填参数', () => {
      const result = validateActionParams('update_task_status', {
        task_id: 'task-123',
        // 缺少 status
      });
      
      expect(result.valid).toBe(false);
      expect(result.missing).toContain('status');
    });

    it('应该对未知类型返回错误', () => {
      const result = validateActionParams('unknown_action' as any, {});
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('未知的操作类型');
    });
  });

  describe('isChatSupported', () => {
    it('应该对支持对话信道的操作返回 true', () => {
      expect(isChatSupported('update_task_status')).toBe(true);
      expect(isChatSupported('add_comment')).toBe(true);
      expect(isChatSupported('update_status')).toBe(true);
    });

    it('应该对不支持对话信道的操作返回 false', () => {
      expect(isChatSupported('get_task')).toBe(false);
      expect(isChatSupported('list_my_tasks')).toBe(false);
      expect(isChatSupported('set_do_not_disturb')).toBe(false);
    });
  });

  describe('getChatSupportedActions', () => {
    it('应该返回所有支持对话信道的操作', () => {
      const actions = getChatSupportedActions();
      
      expect(actions).toContain('update_task_status');
      expect(actions).toContain('add_comment');
      expect(actions).toContain('create_document');
      expect(actions).toContain('update_status');
      expect(actions).not.toContain('get_task');
    });
  });
});

// ============================================================================
// 错误处理测试
// ============================================================================

describe('Error Handling', () => {
  describe('ActionError', () => {
    it('应该创建正确的错误对象', () => {
      const error = new ActionError(
        ErrorCode.NOT_FOUND,
        '任务不存在',
        { taskId: 'task-123' }
      );
      
      expect(error.code).toBe(ErrorCode.NOT_FOUND);
      expect(error.message).toBe('任务不存在');
      expect(error.details).toEqual({ taskId: 'task-123' });
    });

    it('应该转换为 ActionResult', () => {
      const error = new ActionError(ErrorCode.NOT_FOUND, '任务不存在');
      const result = error.toResult('update_task_status', 'req-123');
      
      expect(result.success).toBe(false);
      expect(result.type).toBe('update_task_status');
      expect(result.errorCode).toBe(ErrorCode.NOT_FOUND);
      expect(result.requestId).toBe('req-123');
    });

    it('应该返回用户友好的错误消息', () => {
      const error = new ActionError(ErrorCode.TIMEOUT, '操作超时');
      expect(error.getUserMessage()).toBe('操作超时，请稍后重试');
    });

    it('应该返回恢复建议', () => {
      const error = new ActionError(ErrorCode.NETWORK_ERROR, '网络错误');
      expect(error.getRecoverySuggestion()).toContain('网络');
    });
  });

  describe('missingParamError', () => {
    it('应该创建参数缺失错误', () => {
      const error = missingParamError('task_id', 'update_task_status');
      
      expect(error.code).toBe(ErrorCode.MISSING_REQUIRED);
      expect(error.message).toContain('task_id');
      expect(error.details?.paramName).toBe('task_id');
    });
  });

  describe('toActionError', () => {
    it('应该保持 ActionError 不变', () => {
      const original = new ActionError(ErrorCode.NOT_FOUND, '测试');
      const converted = toActionError(original, 'get_task' as ActionType);
      
      expect(converted).toBe(original);
    });

    it('应该转换普通 Error', () => {
      const original = new Error('测试错误');
      const converted = toActionError(original, 'get_task' as ActionType);
      
      expect(converted.code).toBe(ErrorCode.EXECUTION_FAILED);
      expect(converted.message).toContain('测试错误');
    });

    it('应该转换未知错误', () => {
      const converted = toActionError('unknown error', 'get_task' as ActionType);
      
      expect(converted.code).toBe(ErrorCode.UNKNOWN);
    });
  });

  describe('isRetryable', () => {
    it('应该正确判断可重试的错误', () => {
      expect(isRetryable(new ActionError(ErrorCode.TIMEOUT, ''))).toBe(true);
      expect(isRetryable(new ActionError(ErrorCode.NETWORK_ERROR, ''))).toBe(true);
      expect(isRetryable(new ActionError(ErrorCode.NOT_FOUND, ''))).toBe(false);
      expect(isRetryable(new ActionError(ErrorCode.FORBIDDEN, ''))).toBe(false);
    });
  });
});

// ============================================================================
// 日志系统测试
// ============================================================================

describe('Logger', () => {
  let logger: ChannelLogger;

  beforeEach(() => {
    logger = new ChannelLogger({ minLevel: 'debug' });
  });

  describe('generateRequestId', () => {
    it('应该生成唯一且格式正确的请求 ID', () => {
      const id1 = generateRequestId();
      const id2 = generateRequestId();
      
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^req_[a-z0-9]+_[a-z0-9]+$/);
    });
  });

  describe('ChannelLogger', () => {
    it('应该记录不同级别的日志', () => {
      const requestId = generateRequestId();
      
      logger.debug(requestId, 'debug message');
      logger.info(requestId, 'info message');
      logger.warn(requestId, 'warn message');
      logger.error(requestId, 'error message');
      
      const entries = logger.getEntries();
      expect(entries).toHaveLength(4);
      expect(entries[0].level).toBe('debug');
      expect(entries[1].level).toBe('info');
      expect(entries[2].level).toBe('warn');
      expect(entries[3].level).toBe('error');
    });

    it('应该过滤低于最小级别的日志', () => {
      const productionLogger = new ChannelLogger({ minLevel: 'warn' });
      const requestId = generateRequestId();
      
      productionLogger.debug(requestId, 'debug message');
      productionLogger.info(requestId, 'info message');
      productionLogger.warn(requestId, 'warn message');
      productionLogger.error(requestId, 'error message');
      
      const entries = productionLogger.getEntries();
      expect(entries).toHaveLength(2);
      expect(entries[0].level).toBe('warn');
      expect(entries[1].level).toBe('error');
    });

    it('应该获取指定请求的日志', () => {
      const requestId = generateRequestId();
      
      logger.info(requestId, 'message 1');
      logger.info(generateRequestId(), 'message 2');
      logger.info(requestId, 'message 3');
      
      const requestLogs = logger.getRequestLogs(requestId);
      expect(requestLogs).toHaveLength(2);
    });

    it('应该记录操作耗时', () => {
      const requestId = generateRequestId();
      const startTime = logger.actionStart(requestId, 'update_task_status');
      
      // 模拟一些延迟
      const end = Date.now();
      
      logger.actionEnd(requestId, 'update_task_status', startTime, true);
      
      const entries = logger.getEntries();
      const lastEntry = entries[entries.length - 1];
      expect(lastEntry.duration).toBeDefined();
      expect(lastEntry.duration).toBeGreaterThanOrEqual(0);
    });

    it('应该导出为 JSON', () => {
      const requestId = generateRequestId();
      logger.info(requestId, 'test message');
      
      const json = logger.toJSON();
      const parsed = JSON.parse(json);
      
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0].message).toBe('test message');
    });
  });
});

// ============================================================================
// 边界条件测试
// ============================================================================

describe('Edge Cases', () => {
  it('应该处理空字符串', () => {
    const result = parseChatActions('');
    expect(result.actions).toHaveLength(0);
    expect(result.cleanContent).toBe('');
  });

  it('应该处理只有空格的文本', () => {
    const result = parseChatActions('   ');
    expect(result.actions).toHaveLength(0);
  });

  it('应该处理特殊字符', () => {
    const text = '任务包含特殊字符：<script>alert("xss")</script>{"actions":[{"type":"update_status","status":"working"}]}';
    const result = parseChatActions(text);
    
    expect(result.actions).toHaveLength(1);
    expect(result.cleanContent).toContain('<script>');
  });

  it('应该处理嵌套 JSON', () => {
    const text = '{"actions":[{"type":"create_document","title":"测试","content":"{\\"nested\\": true}"}]}';
    const result = parseChatActions(text);
    
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].content).toBe('{"nested": true}');
  });

  it('应该处理超长文本', () => {
    const longText = 'a'.repeat(10000);
    const text = `${longText}{"actions":[{"type":"update_status","status":"working"}]}`;
    const result = parseChatActions(text);
    
    expect(result.actions).toHaveLength(1);
    expect(result.cleanContent).toBe(longText);
  });
});
