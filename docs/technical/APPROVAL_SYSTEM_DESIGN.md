# TeamClaw 通用审批系统设计

## 概述

TeamClaw 审批系统是一个通用的权限管控机制，支持多种业务场景的审批流程。当前支持：

- **Skill 发布审批**：用户创建的 Skill 需管理员审批后才能激活
- **Skill 安装审批**：普通用户申请将 Skill 安装到 Agent
- **未来扩展**：项目加入申请、敏感操作审批等

---

## 一、核心设计

### 1.1 设计原则

| 原则 | 说明 |
|------|------|
| **通用性** | 支持任意资源类型的审批 |
| **可扩展** | 新增审批类型无需修改核心表结构 |
| **可追溯** | 完整的审批历史记录 |
| **灵活配置** | 支持不同审批策略 |

### 1.2 审批类型

```typescript
// 审批类型枚举
export type ApprovalType = 
  | 'skill_publish'      // Skill 发布审批（draft → active）
  | 'skill_install'      // Skill 安装审批（申请安装到 Agent）
  | 'project_join'       // 项目加入申请
  | 'sensitive_action';  // 敏感操作审批（预留）
```

### 1.3 审批策略

```typescript
// 审批策略配置
export type ApprovalStrategy = {
  type: ApprovalType;
  
  // 审批人规则
  approverRule: 'any_admin' | 'specific_role' | 'project_admin' | 'custom';
  
  // 是否需要多人审批
  requireMultiple: boolean;
  requiredApprovals: number;  // 需要多少人同意
  
  // 超时设置
  timeoutHours: number;       // 超时自动处理
  timeoutAction: 'auto_approve' | 'auto_reject' | 'none';
  
  // 通知配置
  notifyRequester: boolean;   // 通知申请人
  notifyApprover: boolean;    // 通知审批人
};
```

---

## 二、数据库设计

### 2.1 核心表

```typescript
// db/schema.ts

/**
 * 审批请求表（通用）
 */
export const approvalRequests = sqliteTable('approval_requests', {
  id: text('id').primaryKey(),
  
  // 审批类型
  type: text('type', { 
    enum: ['skill_publish', 'skill_install', 'project_join', 'sensitive_action'] 
  }).notNull(),
  
  // 资源信息
  resourceType: text('resource_type').notNull(),  // 'skill' | 'project' | 'task'
  resourceId: text('resource_id').notNull(),      // 资源 ID
  
  // 申请人
  requesterId: text('requester_id').notNull().references(() => members.id),
  
  // 申请内容（JSON 格式，根据类型不同）
  payload: text('payload', { mode: 'json' }).$type<Record<string, unknown>>(),
  
  // 申请说明
  requestNote: text('request_note'),
  
  // 状态
  status: text('status', { 
    enum: ['pending', 'approved', 'rejected', 'cancelled', 'expired'] 
  }).notNull().default('pending'),
  
  // 审批结果
  approvedBy: text('approved_by').references(() => members.id),
  rejectedBy: text('rejected_by').references(() => members.id),
  approvalNote: text('approval_note'),  // 审批备注
  rejectionNote: text('rejection_note'), // 拒绝原因
  
  // 时间戳
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  processedAt: integer('processed_at', { mode: 'timestamp' }),  // 处理时间
  
  // 过期时间
  expiresAt: integer('expires_at', { mode: 'timestamp' }),
  
}, (table) => ({
  // 按类型查询待审批
  typeStatusIdx: index('idx_approval_type_status').on(table.type, table.status),
  // 按资源查询
  resourceIdx: index('idx_approval_resource').on(table.resourceType, table.resourceId),
  // 按申请人查询
  requesterIdx: index('idx_approval_requester').on(table.requesterId),
}));

/**
 * 审批历史表（审计日志）
 */
export const approvalHistories = sqliteTable('approval_histories', {
  id: text('id').primaryKey(),
  requestId: text('request_id').notNull().references(() => approvalRequests.id),
  
  // 操作信息
  action: text('action', { 
    enum: ['created', 'approved', 'rejected', 'cancelled', 'expired', 'reassigned'] 
  }).notNull(),
  
  operatorId: text('operator_id').notNull().references(() => members.id),
  
  // 变更详情
  previousStatus: text('previous_status'),
  newStatus: text('new_status'),
  note: text('note'),
  
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

/**
 * 审批策略配置表
 */
export const approvalStrategies = sqliteTable('approval_strategies', {
  id: text('id').primaryKey(),
  type: text('type').notNull().unique(),  // 审批类型
  
  // 策略配置
  strategy: text('strategy', { mode: 'json' }).$type<ApprovalStrategy>().notNull(),
  
  // 是否启用
  enabled: integer('enabled', { mode: 'boolean' }).default(true),
  
  // 配置信息
  createdBy: text('created_by').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// 导出类型
export type ApprovalRequest = typeof approvalRequests.$inferSelect;
export type NewApprovalRequest = typeof approvalRequests.$inferInsert;
export type ApprovalHistory = typeof approvalHistories.$inferSelect;
export type ApprovalStrategyConfig = typeof approvalStrategies.$inferSelect;
```

### 2.2 默认审批策略

```typescript
// db/seed/approval-strategies.ts

export const DEFAULT_APPROVAL_STRATEGIES: ApprovalStrategyConfig[] = [
  {
    id: 'strategy_skill_publish',
    type: 'skill_publish',
    strategy: {
      type: 'skill_publish',
      approverRule: 'any_admin',
      requireMultiple: false,
      requiredApprovals: 1,
      timeoutHours: 72,
      timeoutAction: 'none',
      notifyRequester: true,
      notifyApprover: true,
    },
    enabled: true,
    createdBy: 'system',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'strategy_skill_install',
    type: 'skill_install',
    strategy: {
      type: 'skill_install',
      approverRule: 'any_admin',
      requireMultiple: false,
      requiredApprovals: 1,
      timeoutHours: 24,
      timeoutAction: 'auto_reject',
      notifyRequester: true,
      notifyApprover: true,
    },
    enabled: true,
    createdBy: 'system',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'strategy_project_join',
    type: 'project_join',
    strategy: {
      type: 'project_join',
      approverRule: 'project_admin',
      requireMultiple: false,
      requiredApprovals: 1,
      timeoutHours: 48,
      timeoutAction: 'auto_reject',
      notifyRequester: true,
      notifyApprover: true,
    },
    enabled: true,
    createdBy: 'system',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];
```

---

## 三、API 设计

### 3.1 通用审批 API

```typescript
// app/api/approval-requests/route.ts

/**
 * GET: 获取审批请求列表
 * Query: type, status, requesterId, resourceId
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  const { searchParams } = new URL(request.url);
  
  const type = searchParams.get('type') as ApprovalType | null;
  const status = searchParams.get('status');
  const requesterId = searchParams.get('requesterId');
  const resourceId = searchParams.get('resourceId');
  
  let query = db.select().from(approvalRequests);
  
  // 权限过滤：普通用户只能看自己的申请，管理员可以看全部
  if (auth.userRole !== 'admin') {
    query = query.where(eq(approvalRequests.requesterId, auth.userId));
  }
  
  // 条件过滤
  if (type) query = query.where(eq(approvalRequests.type, type));
  if (status) query = query.where(eq(approvalRequests.status, status));
  if (requesterId) query = query.where(eq(approvalRequests.requesterId, requesterId));
  if (resourceId) query = query.where(eq(approvalRequests.resourceId, resourceId));
  
  const requests = await query.orderBy(desc(approvalRequests.createdAt));
  
  return NextResponse.json({ requests });
}

/**
 * POST: 创建审批请求
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  const body = await request.json();
  
  const { type, resourceType, resourceId, payload, requestNote, expiresAt } = body;
  
  // 获取审批策略
  const [strategyConfig] = await db.select()
    .from(approvalStrategies)
    .where(eq(approvalStrategies.type, type));
  
  if (!strategyConfig || !strategyConfig.enabled) {
    return NextResponse.json({ error: 'Approval type not supported' }, { status: 400 });
  }
  
  // 检查是否已有待审批的请求
  const [existing] = await db.select()
    .from(approvalRequests)
    .where(and(
      eq(approvalRequests.type, type),
      eq(approvalRequests.resourceId, resourceId),
      eq(approvalRequests.status, 'pending')
    ));
  
  if (existing) {
    return NextResponse.json({ error: 'Pending request already exists' }, { status: 400 });
  }
  
  // 创建审批请求
  const [approvalRequest] = await db.insert(approvalRequests).values({
    id: generateId(),
    type,
    resourceType,
    resourceId,
    requesterId: auth.userId,
    payload,
    requestNote,
    status: 'pending',
    expiresAt: expiresAt ? new Date(expiresAt) : null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }).returning();
  
  // 记录历史
  await db.insert(approvalHistories).values({
    id: generateId(),
    requestId: approvalRequest.id,
    action: 'created',
    operatorId: auth.userId,
    previousStatus: null,
    newStatus: 'pending',
    createdAt: new Date(),
  });
  
  // 发送通知（异步）
  sendApprovalNotification(approvalRequest, 'created');
  
  return NextResponse.json({ request: approvalRequest });
}

// app/api/approval-requests/[id]/approve/route.ts

/**
 * POST: 批准审批请求
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAuth(request);
  
  // 权限检查：仅管理员可批准
  if (auth.userRole !== 'admin') {
    return NextResponse.json({ error: 'Only admin can approve' }, { status: 403 });
  }
  
  const body = await request.json();
  const { note } = body;
  
  // 获取审批请求
  const [approvalRequest] = await db.select()
    .from(approvalRequests)
    .where(eq(approvalRequests.id, id));
  
  if (!approvalRequest) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 });
  }
  
  if (approvalRequest.status !== 'pending') {
    return NextResponse.json({ error: 'Request already processed' }, { status: 400 });
  }
  
  // 执行批准逻辑
  await db.transaction(async (tx) => {
    // 更新审批请求状态
    await tx.update(approvalRequests)
      .set({
        status: 'approved',
        approvedBy: auth.userId,
        approvalNote: note,
        processedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(approvalRequests.id, id));
    
    // 记录历史
    await tx.insert(approvalHistories).values({
      id: generateId(),
      requestId: id,
      action: 'approved',
      operatorId: auth.userId,
      previousStatus: 'pending',
      newStatus: 'approved',
      note,
      createdAt: new Date(),
    });
    
    // 执行审批通过后的业务逻辑
    await executeApprovalAction(tx, approvalRequest);
  });
  
  // 发送通知
  sendApprovalNotification(approvalRequest, 'approved');
  
  return NextResponse.json({ success: true });
}

// app/api/approval-requests/[id]/reject/route.ts

/**
 * POST: 拒绝审批请求
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAuth(request);
  
  if (auth.userRole !== 'admin') {
    return NextResponse.json({ error: 'Only admin can reject' }, { status: 403 });
  }
  
  const body = await request.json();
  const { note } = body;
  
  const [approvalRequest] = await db.select()
    .from(approvalRequests)
    .where(eq(approvalRequests.id, id));
  
  if (!approvalRequest || approvalRequest.status !== 'pending') {
    return NextResponse.json({ error: 'Request not found or already processed' }, { status: 400 });
  }
  
  await db.transaction(async (tx) => {
    await tx.update(approvalRequests)
      .set({
        status: 'rejected',
        rejectedBy: auth.userId,
        rejectionNote: note,
        processedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(approvalRequests.id, id));
    
    await tx.insert(approvalHistories).values({
      id: generateId(),
      requestId: id,
      action: 'rejected',
      operatorId: auth.userId,
      previousStatus: 'pending',
      newStatus: 'rejected',
      note,
      createdAt: new Date(),
    });
  });
  
  sendApprovalNotification(approvalRequest, 'rejected');
  
  return NextResponse.json({ success: true });
}

// app/api/approval-requests/[id]/cancel/route.ts

/**
 * POST: 取消审批请求（申请人自己取消）
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAuth(request);
  
  const [approvalRequest] = await db.select()
    .from(approvalRequests)
    .where(eq(approvalRequests.id, id));
  
  if (!approvalRequest) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 });
  }
  
  // 只能取消自己的申请
  if (approvalRequest.requesterId !== auth.userId && auth.userRole !== 'admin') {
    return NextResponse.json({ error: 'Cannot cancel others request' }, { status: 403 });
  }
  
  if (approvalRequest.status !== 'pending') {
    return NextResponse.json({ error: 'Request already processed' }, { status: 400 });
  }
  
  await db.transaction(async (tx) => {
    await tx.update(approvalRequests)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(approvalRequests.id, id));
    
    await tx.insert(approvalHistories).values({
      id: generateId(),
      requestId: id,
      action: 'cancelled',
      operatorId: auth.userId,
      previousStatus: 'pending',
      newStatus: 'cancelled',
      createdAt: new Date(),
    });
  });
  
  return NextResponse.json({ success: true });
}
```

### 3.2 审批动作执行器

```typescript
// lib/approval-executor.ts

/**
 * 执行审批通过后的业务逻辑
 */
async function executeApprovalAction(tx: any, request: ApprovalRequest): Promise<void> {
  switch (request.type) {
    case 'skill_publish': {
      // 更新 Skill 状态为 active
      await tx.update(skills)
        .set({ status: 'active', approvedBy: request.approvedBy, approvedAt: new Date() })
        .where(eq(skills.id, request.resourceId));
      
      // 检查是否需要自动发布到外部
      const settings = await getSkillHubSettings();
      if (settings.publishMode === 'auto') {
        await autoPublishIfNeeded(request.resourceId);
      }
      break;
    }
    
    case 'skill_install': {
      const { agentId } = request.payload as { agentId: string };
      
      // 安装 Skill 到 Agent
      const [skill] = await tx.select().from(skills).where(eq(skills.id, request.resourceId));
      const gatewayClient = getGatewayClient();
      await gatewayClient.installSkill(skill.skillKey, `install-${Date.now()}`);
      
      // 更新 Skill 记录
      await tx.update(skills)
        .set({
          installedAgents: [...skill.installedAgents, agentId],
          updatedAt: new Date(),
        })
        .where(eq(skills.id, request.resourceId));
      break;
    }
    
    case 'project_join': {
      const { role } = request.payload as { role: string };
      
      // 添加用户到项目成员
      await tx.insert(projectMembers).values({
        id: generateId(),
        projectId: request.resourceId,
        memberId: request.requesterId,
        role,
        createdAt: new Date(),
      });
      break;
    }
    
    default:
      console.warn(`Unknown approval type: ${request.type}`);
  }
}
```

---

## 四、使用示例

### 4.1 Skill 发布审批

```typescript
// 用户提交 Skill 发布审批
const response = await fetch('/api/approval-requests', {
  method: 'POST',
  body: JSON.stringify({
    type: 'skill_publish',
    resourceType: 'skill',
    resourceId: 'skill_xxx',
    requestNote: '请审批我的周报生成 Skill',
  }),
});

// 管理员批准
await fetch('/api/approval-requests/req_xxx/approve', {
  method: 'POST',
  body: JSON.stringify({ note: '通过，符合规范' }),
});
```

### 4.2 Skill 安装审批

```typescript
// 普通用户申请安装 Skill 到 Agent
const response = await fetch('/api/approval-requests', {
  method: 'POST',
  body: JSON.stringify({
    type: 'skill_install',
    resourceType: 'skill',
    resourceId: 'skill_xxx',
    payload: { agentId: 'agent_xxx' },
    requestNote: '需要安装到我的 Agent 以执行周报任务',
  }),
});
```

### 4.3 项目加入审批

```typescript
// 用户申请加入项目
const response = await fetch('/api/approval-requests', {
  method: 'POST',
  body: JSON.stringify({
    type: 'project_join',
    resourceType: 'project',
    resourceId: 'project_xxx',
    payload: { role: 'member' },
    requestNote: '我是新成员，需要访问项目资源',
  }),
});
```

---

## 五、前端组件

### 5.1 审批列表组件

```tsx
// components/approval/ApprovalList.tsx

interface ApprovalListProps {
  type?: ApprovalType;
  status?: 'pending' | 'approved' | 'rejected';
  showActions?: boolean;  // 是否显示审批操作按钮
}

export function ApprovalList({ type, status, showActions = false }: ApprovalListProps) {
  const { t } = useTranslation();
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  
  useEffect(() => {
    fetchApprovals();
  }, [type, status]);
  
  const handleApprove = async (id: string) => {
    await fetch(`/api/approval-requests/${id}/approve`, { method: 'POST' });
    fetchApprovals();
  };
  
  const handleReject = async (id: string) => {
    await fetch(`/api/approval-requests/${id}/reject`, { method: 'POST' });
    fetchApprovals();
  };
  
  return (
    <div className="space-y-3">
      {requests.map(req => (
        <div key={req.id} className="card p-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{t(`approval.type.${req.type}`)}</span>
                <StatusBadge status={req.status} />
              </div>
              <div className="text-xs text-[var(--text-tertiary)] mt-1">
                {req.requestNote}
              </div>
              <div className="text-xs text-[var(--text-tertiary)] mt-1">
                {formatTime(req.createdAt)}
              </div>
            </div>
            
            {showActions && req.status === 'pending' && (
              <div className="flex gap-2">
                <Button size="sm" onClick={() => handleApprove(req.id)}>
                  {t('approval.approve')}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => handleReject(req.id)}>
                  {t('approval.reject')}
                </Button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
```

### 5.2 审批设置组件

```tsx
// components/settings/ApprovalSettings.tsx

export function ApprovalSettings() {
  const { t } = useTranslation();
  const [strategies, setStrategies] = useState<ApprovalStrategyConfig[]>([]);
  
  return (
    <div className="space-y-4">
      <h3 className="section-title">{t('settings.approvalStrategies')}</h3>
      
      {strategies.map(strategy => (
        <div key={strategy.id} className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">{t(`approval.type.${strategy.type}`)}</div>
              <div className="text-xs text-[var(--text-tertiary)]">
                {t('approval.timeout')}: {strategy.strategy.timeoutHours}h
              </div>
            </div>
            <Switch
              checked={strategy.enabled}
              onCheckedChange={(enabled) => updateStrategy(strategy.id, { enabled })}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
```

---

## 六、权限矩阵

| 操作 | 申请人 | 管理员 | 其他用户 |
|------|--------|--------|----------|
| 创建审批请求 | ✅ | ✅ | ✅ |
| 查看自己的请求 | ✅ | ✅ | ✅ |
| 查看所有请求 | ❌ | ✅ | ❌ |
| 批准请求 | ❌ | ✅ | ❌ |
| 拒绝请求 | ❌ | ✅ | ❌ |
| 取消自己的请求 | ✅ | ✅ | ❌ |

---

## 七、通知机制

```typescript
// lib/approval-notification.ts

/**
 * 发送审批通知
 */
export async function sendApprovalNotification(
  request: ApprovalRequest,
  action: 'created' | 'approved' | 'rejected' | 'cancelled'
): Promise<void> {
  const strategy = await getApprovalStrategy(request.type);
  
  if (!strategy.notifyRequester && !strategy.notifyApprover) {
    return;
  }
  
  const notifications: Notification[] = [];
  
  // 通知申请人
  if (strategy.notifyRequester && action !== 'created') {
    notifications.push({
      memberId: request.requesterId,
      type: 'approval_update',
      title: `审批${action === 'approved' ? '通过' : '已拒绝'}`,
      content: `您的${request.type}申请已${action}`,
      resourceId: request.id,
    });
  }
  
  // 通知审批人
  if (strategy.notifyApprover && action === 'created') {
    const admins = await getAdmins();
    notifications.push(...admins.map(admin => ({
      memberId: admin.id,
      type: 'approval_pending',
      title: '新的审批请求',
      content: `有一条${request.type}申请待处理`,
      resourceId: request.id,
    })));
  }
  
  // 批量发送通知
  await Promise.all(notifications.map(sendNotification));
}
```

---

## 八、总结

### 通用审批系统的优势

| 维度 | 说明 |
|------|------|
| **复用性** | 一次开发，多处使用 |
| **一致性** | 统一的审批流程和 UI |
| **可追溯** | 完整的审批历史记录 |
| **可扩展** | 新增审批类型无需修改核心代码 |
| **可配置** | 支持不同审批策略 |

### 当前支持的审批类型

1. ✅ `skill_publish` - Skill 发布审批
2. ✅ `skill_install` - Skill 安装审批
3. ✅ `project_join` - 项目加入申请
4. 🔜 `sensitive_action` - 敏感操作审批（预留）

### 集成到 Skill 系统

Skill 相关审批只需调用通用 API：

```typescript
// 提交 Skill 发布审批
await createApprovalRequest({
  type: 'skill_publish',
  resourceType: 'skill',
  resourceId: skillId,
  requestNote: '请审批',
});

// 管理员批准后，自动执行：
// 1. 更新 Skill 状态为 active
// 2. 检查是否需要自动发布到 SkillHub
```
