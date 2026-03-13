# TeamClaw SkillHub 设计规范

## 概述

TeamClaw SkillHub 是内置的 Skill 注册中心，提供统一的 Skill 管理、审批、发布能力。它与 OpenClaw Gateway 紧密集成，为 Agent 提供标准化的 Skill 加载机制。

### 核心定位

```
┌─────────────────────────────────────────────────────────────────────┐
│                          TeamClaw SkillHub                             │
│                    (内置 Skill 注册中心 + 审批系统)                    │
└─────────────────────────────────────────────────────────────────────┘
                                 │
        ┌────────────────────────┼────────────────────────────┐
        │                        │                            │
        ▼                        ▼                            ▼
┌───────────────┐      ┌──────────────────┐      ┌────────────────────┐
│   SOP Template │      │   手动创建 Skill   │      │   外部 SkillHub    │
│   (用户创建)    │      │   (开发者创建)     │      │ (skillhub.tencent) │
└───────┬───────┘      └────────┬─────────┘      └─────────┬──────────┘
        │                       │                          │
        ▼                       ▼                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Skill 验证 + 注册                             │
│  1. 检查 SKILL.md 结构 (skill-creator 规范)                          │
│  2. 生成唯一 skillKey                                                │
│  3. 存入 skills 表 (status: draft)                                   │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        审批系统                                      │
│  - draft → active: 需管理员审批                                      │
│  - active → installed: 安装到 Agent (仅管理员)                       │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Gateway skills.status                             │
│  - Gateway 扫描 skills/ 目录                                         │
│  - Agent 可加载 active 状态的 Skill                                  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 一、Skill 来源

### 1.1 SOP Template 生成

用户在 TeamClaw 创建 SOP Template 后，系统自动生成对应的 Skill。

**流程**：
```
用户创建 SOP Template
        ↓
验证 SOP 结构（阶段完整性、输入输出定义）
        ↓
生成 SKILL.md：
  - 注入前置阶段（项目上下文加载）
  - 添加用户定义阶段
  - 注入后置阶段（质量验证与交付）
        ↓
创建 Skill 记录（status: draft）
        ↓
用户提交审批
```

**skillKey 命名规则**：
```
teamclaw.sop.{project_id}.{template_name}
示例：teamclaw.sop.proj_abc.weekly-report
```

### 1.2 手动创建 Skill

开发者按照 `skill-creator` 规范手动创建 Skill 文件。

**目录结构**：
```
skills/
├── teamclaw/                    # 内置 TeamClaw 核心能力
│   └── SKILL.md               
├── sop-weekly-report/         # 用户创建的 Skill
│   ├── SKILL.md               
│   ├── references/            
│   └── scripts/               
└── custom-analysis/
    └── SKILL.md
```

**SKILL.md 结构**：
```markdown
---
name: teamclaw.sop.weekly-report
version: 1.0.0
description: 生成周报的标准化工作流程
category: content
source: sop
sopTemplateId: sop_xxx
---

# 周报生成工作流

> 📌 本 Skill 由 TeamClaw 自动生成，包含项目上下文加载能力

## 阶段 0: 项目上下文加载（固定）
...
```

### 1.3 外部 SkillHub 同步

从腾讯 SkillHub 或其他外部源同步 Skill。

**同步策略**：
- 定期拉取外部 Skill 元数据
- 管理员手动导入特定 Skill
- 自动检测 Skill 更新

---

## 二、Skill 注册与验证

### 2.1 注册流程

```typescript
// lib/skill-registry.ts

/**
 * Skill 注册接口
 */
export interface SkillRegistration {
  name: string;
  version: string;
  description: string;
  category: SkillCategory;
  source: SkillSource;
  skillPath: string;
  sopTemplateId?: string;
}

/**
 * 注册新 Skill
 */
export async function registerSkill(registration: SkillRegistration): Promise<Skill> {
  // 1. 验证 SKILL.md 结构
  const validationResult = await validateSkillStructure(registration.skillPath);
  if (!validationResult.valid) {
    throw new Error(`Invalid skill structure: ${validationResult.errors.join(', ')}`);
  }
  
  // 2. 生成 skillKey
  const skillKey = generateSkillKey(registration);
  
  // 3. 检查是否已存在
  const [existing] = await db.select().from(skills).where(eq(skills.skillKey, skillKey));
  if (existing) {
    throw new Error(`Skill already exists: ${skillKey}`);
  }
  
  // 4. 解析 SKILL.md 元数据
  const metadata = await parseSkillMetadata(registration.skillPath);
  
  // 5. 创建数据库记录
  const skillId = generateId();
  await db.insert(skills).values({
    id: skillId,
    skillKey,
    name: registration.name,
    description: registration.description,
    version: registration.version,
    category: registration.category,
    source: registration.source,
    sopTemplateId: registration.sopTemplateId,
    skillPath: registration.skillPath,
    trustStatus: registration.source === 'teamclaw' ? 'trusted' : 'pending',
    installedAgents: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  
  // 6. 返回创建的 Skill
  const [skill] = await db.select().from(skills).where(eq(skills.id, skillId));
  return skill;
}

/**
 * 验证 Skill 结构
 * 参考 skill-creator 规范
 */
async function validateSkillStructure(skillPath: string): Promise<ValidationResult> {
  const skillMdPath = join(skillPath, 'SKILL.md');
  
  // 检查文件存在性
  if (!existsSync(skillMdPath)) {
    return { valid: false, errors: ['SKILL.md not found'] };
  }
  
  // 解析 frontmatter
  const content = await fs.readFile(skillMdPath, 'utf-8');
  const frontmatter = parseFrontmatter(content);
  
  // 验证必需字段
  const errors: string[] = [];
  const requiredFields = ['name', 'version', 'description', 'category'];
  
  for (const field of requiredFields) {
    if (!frontmatter[field]) {
      errors.push(`Missing required field: ${field}`);
    }
  }
  
  // 验证 name 格式
  if (frontmatter.name && !isValidSkillKey(frontmatter.name)) {
    errors.push('Invalid skill name format (must be teamclaw.xxx.xxx)');
  }
  
  // 验证阶段定义
  const stages = extractStages(content);
  if (stages.length === 0) {
    errors.push('No stages defined in SKILL.md');
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * 生成 skillKey
 */
function generateSkillKey(registration: SkillRegistration): string {
  if (registration.source === 'sop' && registration.sopTemplateId) {
    // SOP 生成的 Skill
    return `teamclaw.sop.${registration.sopTemplateId}`;
  } else if (registration.source === 'external') {
    // 外部 Skill
    return `external.${registration.name}`;
  } else {
    // 手动创建
    return `teamclaw.custom.${registration.name}`;
  }
}
```

### 2.2 验证规范

根据 `skill-creator` 标准，Skill 必须包含：

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `name` | string | ✅ | Skill 唯一标识，格式：`teamclaw.{type}.{name}` |
| `version` | string | ✅ | 版本号，格式：`major.minor.patch` |
| `description` | string | ✅ | 功能描述 |
| `category` | enum | ✅ | 分类：`content/analysis/research/development/operations/media/custom` |
| `source` | enum | ✅ | 来源：`sop/manual/external` |

---

## 三、Skill 状态管理

### 3.1 状态流转

```
┌─────────┐
│  draft  │  创建/编辑中
└────┬────┘
     │ 用户提交审批
     ▼
┌────────────────┐
│ pending_approval│  等待管理员审批
└────┬─────┬─────┘
     │     │
     │     └─────► ┌──────────┐
     │              │ rejected │  已拒绝
     │              └──────────┘
     │ 管理员批准
     ▼
┌─────────┐
│  active │  已激活，可安装到 Agent
└────┬────┘
     │ 安装到 Agent
     ▼
┌────────────┐
│  installed │  已安装到 Agent
└────────────┘
```

### 3.2 状态定义

```typescript
// types/skill.ts

export type SkillStatus = 'draft' | 'pending_approval' | 'active' | 'rejected';

export type SkillSource = 'teamclaw' | 'manual' | 'external' | 'unknown';

export type SkillTrustStatus = 'trusted' | 'untrusted' | 'pending';

export type SkillCategory = 
  | 'content'      // 内容生成
  | 'analysis'     // 数据分析
  | 'research'     // 调研研究
  | 'development'  // 开发辅助
  | 'operations'   // 运维操作
  | 'media'        // 媒体处理
  | 'custom';      // 自定义
```

### 3.3 状态变更 API

```typescript
// app/api/skills/[id]/status/route.ts

/**
 * PUT: 更新 Skill 状态
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireAuth(request);
  const { status, note } = await request.json();
  
  // 1. 获取当前 Skill
  const [skill] = await db.select().from(skills).where(eq(skills.id, id));
  if (!skill) {
    return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
  }
  
  // 2. 验证状态流转合法性
  const allowedTransitions: Record<SkillStatus, SkillStatus[]> = {
    draft: ['pending_approval'],
    pending_approval: ['active', 'rejected'],
    active: ['draft'],  // 允许回退到草稿重新编辑
    rejected: ['draft'], // 允许重新提交
  };
  
  if (!allowedTransitions[skill.status]?.includes(status)) {
    return NextResponse.json(
      { error: `Invalid status transition: ${skill.status} → ${status}` },
      { status: 400 }
    );
  }
  
  // 3. 权限检查
  if (status === 'active' || status === 'rejected') {
    // 审批操作需要管理员权限
    if (auth.userRole !== 'admin') {
      return NextResponse.json({ error: 'Only admin can approve skills' }, { status: 403 });
    }
  } else if (status === 'pending_approval') {
    // 提交审批需要是创建者或管理员
    if (auth.userId !== skill.createdBy && auth.userRole !== 'admin') {
      return NextResponse.json({ error: 'Only creator or admin can submit for approval' }, { status: 403 });
    }
  }
  
  // 4. 更新状态
  await db.update(skills)
    .set({
      status,
      updatedAt: new Date(),
    })
    .where(eq(skills.id, id));
  
  // 5. 记录状态变更日志
  await db.insert(activityLogs).values({
    id: generateId(),
    action: 'skill_status_change',
    resourceId: id,
    userId: auth.userId,
    details: `${skill.status} → ${status}${note ? `: ${note}` : ''}`,
    createdAt: new Date(),
  });
  
  // 6. 触发 SSE 事件
  eventBus.emit({
    type: 'skill_status_changed',
    resourceId: id,
    data: { status, previousStatus: skill.status }
  });
  
  return NextResponse.json({ success: true, status });
}
```

---

## 四、Skill 快照与信任管理

### 4.1 核心机制

**问题**：Agent 可能通过其他渠道安装 Skill（非 TeamClaw 安装），存在安全风险。

**解决方案**：
1. **定期快照**：记录 Agent 已安装的 Skill 列表
2. **差异比对**：发现新增/删除的 Skill
3. **来源验证**：标记 Skill 来源（TeamClaw 安装 / 未知来源）
4. **信任管理**：管理员可信任或卸载未知 Skill

### 4.2 数据库设计

```typescript
// db/schema.ts（已在 v3 添加）

/**
 * Skill 信息表
 */
export const skills = sqliteTable('skills', {
  id: text('id').primaryKey(),
  skillKey: text('skill_key').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  version: text('version').default('1.0.0'),
  category: text('category', { 
    enum: ['content', 'analysis', 'research', 'development', 'operations', 'media', 'custom'] 
  }),
  
  // 来源标识
  source: text('source', { 
    enum: ['teamclaw', 'manual', 'external', 'unknown'] 
  }).notNull().default('unknown'),
  
  // SOP 关联
  sopTemplateId: text('sop_template_id'),
  
  // 信任状态
  trustStatus: text('trust_status', { 
    enum: ['trusted', 'untrusted', 'pending'] 
  }).notNull().default('pending'),
  
  // 敏感标记
  isSensitive: integer('is_sensitive', { mode: 'boolean' }).default(false),
  sensitivityNote: text('sensitivity_note'),
  
  // 文件路径
  skillPath: text('skill_path'),
  
  // 安装到的 Agent 列表
  installedAgents: text('installed_agents', { mode: 'json' }).$type<string[]>().default([]),
  
  // 时间戳
  discoveredAt: integer('discovered_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

/**
 * Skill 快照表
 */
export const skillSnapshots = sqliteTable('skill_snapshots', {
  id: text('id').primaryKey(),
  agentId: text('agent_id').notNull().references(() => members.id, { onDelete: 'cascade' }),
  snapshotAt: integer('snapshot_at', { mode: 'timestamp' }).notNull(),
  skills: text('skills', { mode: 'json' }).$type<Array<{
    skillKey: string;
    name: string;
    version?: string;
    enabled: boolean;
  }>>().notNull(),
  diff: text('diff', { mode: 'json' }).$type<{
    added: string[];
    removed: string[];
    unchanged: string[];
  }>(),
  riskAlerts: text('risk_alerts', { mode: 'json' }).$type<Array<{
    type: 'unknown_skill' | 'untrusted_skill' | 'sensitive_skill';
    skillKey: string;
    message: string;
  }>>(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

/**
 * Skill 信任记录表
 */
export const skillTrustRecords = sqliteTable('skill_trust_records', {
  id: text('id').primaryKey(),
  skillId: text('skill_id').notNull().references(() => skills.id, { onDelete: 'cascade' }),
  agentId: text('agent_id').notNull().references(() => members.id, { onDelete: 'cascade' }),
  action: text('action', { 
    enum: ['trust', 'untrust', 'install', 'uninstall'] 
  }).notNull(),
  note: text('note'),
  operatedBy: text('operated_by').notNull(),
  operatedAt: integer('operated_at', { mode: 'timestamp' }).notNull(),
});
```

### 4.3 快照 API

```typescript
// app/api/skills/snapshot/route.ts

/**
 * POST: 为指定 Agent 创建 Skill 快照
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  
  if (auth.userRole !== 'admin') {
    return NextResponse.json({ error: 'Only admin can create snapshots' }, { status: 403 });
  }
  
  const { agentId } = await request.json();
  
  // 1. 获取 Agent 信息
  const [agent] = await db.select().from(members).where(eq(members.id, agentId));
  if (!agent || agent.type !== 'ai') {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }
  
  // 2. 通过 Gateway 获取 Agent 已安装的 Skill 列表
  const gatewayClient = getGatewayClient();
  const installedSkills = await gatewayClient.getAgentSkills(agent.openclawAgentId);
  
  // 3. 获取上一个快照
  const [lastSnapshot] = await db.select()
    .from(skillSnapshots)
    .where(eq(skillSnapshots.agentId, agentId))
    .orderBy(desc(skillSnapshots.snapshotAt))
    .limit(1);
  
  // 4. 差异分析
  const diff = analyzeDiff(
    lastSnapshot?.skills || [],
    installedSkills
  );
  
  // 5. 风险检测
  const riskAlerts = await detectRisks(installedSkills, diff.added);
  
  // 6. 创建新 Skill 记录（首次发现的）
  for (const skill of installedSkills) {
    await createSkillIfNotExists(skill, agentId);
  }
  
  // 7. 保存快照
  const snapshotId = generateId();
  await db.insert(skillSnapshots).values({
    id: snapshotId,
    agentId,
    snapshotAt: new Date(),
    skills: installedSkills,
    diff,
    riskAlerts,
    createdAt: new Date(),
  });
  
  // 8. 触发 SSE 事件（如有风险提示）
  if (riskAlerts.length > 0) {
    eventBus.emit({ 
      type: 'skill_risk_alert', 
      resourceId: snapshotId,
      data: { agentId, alerts: riskAlerts }
    });
  }
  
  return NextResponse.json({
    success: true,
    snapshot: {
      id: snapshotId,
      agentId,
      skillCount: installedSkills.length,
      diff,
      riskAlerts,
    }
  });
}

/**
 * 差异分析
 */
function analyzeDiff(
  oldSkills: Array<{ skillKey: string }>,
  newSkills: Array<{ skillKey: string }>
): { added: string[]; removed: string[]; unchanged: string[] } {
  const oldKeys = new Set(oldSkills.map(s => s.skillKey));
  const newKeys = new Set(newSkills.map(s => s.skillKey));
  
  return {
    added: [...newKeys].filter(k => !oldKeys.has(k)),
    removed: [...oldKeys].filter(k => !newKeys.has(k)),
    unchanged: [...oldKeys].filter(k => newKeys.has(k)),
  };
}

/**
 * 风险检测
 */
async function detectRisks(
  skills: Array<{ skillKey: string; name: string }>,
  addedKeys: string[]
): Promise<Array<{ type: string; skillKey: string; message: string }>> {
  const alerts: Array<{ type: string; skillKey: string; message: string }> = [];
  
  for (const skillKey of addedKeys) {
    const [skill] = await db.select().from(skills).where(eq(skills.skillKey, skillKey));
    
    if (!skill) {
      alerts.push({
        type: 'unknown_skill',
        skillKey,
        message: `发现未知来源的 Skill: ${skillKey}，来源不明可能存在安全风险`,
      });
    } else if (skill.trustStatus === 'untrusted') {
      alerts.push({
        type: 'untrusted_skill',
        skillKey,
        message: `发现未信任的 Skill: ${skill.name}，已被标记为不安全`,
      });
    } else if (skill.isSensitive) {
      alerts.push({
        type: 'sensitive_skill',
        skillKey,
        message: `发现敏感 Skill: ${skill.name}，包含敏感信息`,
      });
    }
  }
  
  return alerts;
}
```

### 4.4 信任管理 API

```typescript
// app/api/skills/[id]/trust/route.ts

/**
 * POST: 信任 Skill
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireAuth(request);
  
  if (auth.userRole !== 'admin') {
    return NextResponse.json({ error: 'Only admin can trust skills' }, { status: 403 });
  }
  
  const { note, agentId } = await request.json();
  
  const [skill] = await db.select().from(skills).where(eq(skills.id, id));
  if (!skill) {
    return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
  }
  
  // 更新信任状态
  await db.update(skills)
    .set({
      trustStatus: 'trusted',
      source: skill.source === 'unknown' ? 'external' : skill.source,
      updatedAt: new Date(),
    })
    .where(eq(skills.id, id));
  
  // 记录信任操作
  await db.insert(skillTrustRecords).values({
    id: generateId(),
    skillId: id,
    agentId,
    action: 'trust',
    note,
    operatedBy: auth.userId,
    operatedAt: new Date(),
  });
  
  eventBus.emit({ type: 'skill_trusted', resourceId: id });
  
  return NextResponse.json({ success: true });
}

// app/api/skills/[id]/untrust/route.ts

/**
 * POST: 拒绝并卸载 Skill
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireAuth(request);
  
  if (auth.userRole !== 'admin') {
    return NextResponse.json({ error: 'Only admin can untrust skills' }, { status: 403 });
  }
  
  const { note, agentId, uninstall } = await request.json();
  
  const [skill] = await db.select().from(skills).where(eq(skills.id, id));
  if (!skill) {
    return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
  }
  
  // 更新信任状态
  await db.update(skills)
    .set({
      trustStatus: 'untrusted',
      updatedAt: new Date(),
    })
    .where(eq(skills.id, id));
  
  // 如果需要卸载
  if (uninstall && agentId) {
    const [agent] = await db.select().from(members).where(eq(members.id, agentId));
    if (agent && agent.openclawAgentId) {
      const gatewayClient = getGatewayClient();
      await gatewayClient.toggleSkill(skill.skillKey, true); // true = disable
    }
    
    // 从安装列表中移除
    await db.update(skills)
      .set({
        installedAgents: skill.installedAgents.filter(id => id !== agentId),
        updatedAt: new Date(),
      })
      .where(eq(skills.id, id));
  }
  
  // 记录操作
  await db.insert(skillTrustRecords).values({
    id: generateId(),
    skillId: id,
    agentId,
    action: uninstall ? 'uninstall' : 'untrust',
    note,
    operatedBy: auth.userId,
    operatedAt: new Date(),
  });
  
  eventBus.emit({ type: 'skill_untrusted', resourceId: id });
  
  return NextResponse.json({ success: true });
}
```

### 4.5 定时快照任务

```typescript
// lib/cron/skill-snapshot.ts

/**
 * 定时创建 Skill 快照
 * 建议频率：每 6 小时一次
 */
export async function createSkillSnapshotsForAllAgents() {
  const aiMembers = await db.select()
    .from(members)
    .where(eq(members.type, 'ai'));
  
  const results = [];
  
  for (const agent of aiMembers) {
    try {
      const response = await fetch(`${process.env.TEAMCLAW_BASE_URL}/api/skills/snapshot`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.INTERNAL_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ agentId: agent.id }),
      });
      
      const result = await response.json();
      results.push({ agentId: agent.id, success: result.success });
    } catch (error) {
      console.error(`[Skill Snapshot] Failed for agent ${agent.id}:`, error);
      results.push({ agentId: agent.id, success: false, error: String(error) });
    }
  }
  
  return results;
}
```

### 4.6 工作流程图

```
定时任务（每 6 小时）
    │
    ▼
获取所有 AI Agent
    │
    ▼
通过 Gateway 获取已安装 Skill 列表
    │
    ▼
与上次快照比对
    │
    ├─ 无差异 → 记录快照，结束
    │
    └─ 有差异 → 检测风险
            │
            ├─ 新增 Skill
            │   ├─ 数据库中不存在 → unknown_skill 风险
            │   ├─ 信任状态为 untrusted → untrusted_skill 风险
            │   └─ 标记为敏感 → sensitive_skill 风险
            │
            └─ 保存快照 + 风险提示
                    │
                    ▼
            触发 SSE 事件
                    │
                    ▼
            管理员收到通知
                    │
                    ├─ 信任 → 更新 trustStatus = trusted
                    │
                    └─ 拒绝 → 更新 trustStatus = untrusted
                              │
                              └─ 选择卸载 → 从 Agent 移除
```

---

## 五、外部 SkillHub 集成

### 5.1 发布模式

| 模式 | 说明 | 适用场景 |
|------|------|---------|
| `disabled` | 禁止发布到外部 | 高保密团队 |
| `admin_only` | 仅管理员可发布 | 一般团队 |
| `auto` | 审批通过后自动发布 | 开源协作团队 |

### 5.2 发布流程

```
Skill 审批通过（status: active）
        │
        ▼
检查 publishMode 配置
        │
        ├─ disabled → 不发布，结束
        │
        ├─ admin_only → 等待管理员手动发布
        │
        └─ auto → 自动发布到 SkillHub
                │
                ▼
         检查 Skill 敏感标记
                │
                ├─ isSensitive: true → 不发布
                │
                └─ isSensitive: false → 发布
                        │
                        ▼
                 附加开源声明
                        │
                        ▼
                 上传到 SkillHub
```

### 5.3 配置 API

```typescript
// app/api/skillhub-settings/route.ts

/**
 * GET: 获取 SkillHub 设置
 * PUT: 更新 SkillHub 设置（仅管理员）
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  const settings = await getSkillHubSettings();
  return NextResponse.json({ settings });
}

export async function PUT(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.userRole !== 'admin') {
    return NextResponse.json({ error: 'Only admin can update settings' }, { status: 403 });
  }
  
  const body = await request.json();
  const { publishMode, skillhubApiUrl, skillhubToken, opensourceAttribution } = body;
  
  await db.insert(skillHubSettings)
    .values({
      id: 'default',
      publishMode,
      skillhubApiUrl,
      skillhubToken: skillhubToken ? encrypt(skillhubToken) : undefined,
      opensourceAttribution,
      updatedBy: auth.userId,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: skillHubSettings.id,
      set: {
        publishMode,
        skillhubApiUrl,
        skillhubToken: skillhubToken ? encrypt(skillhubToken) : undefined,
        opensourceAttribution,
        updatedBy: auth.userId,
        updatedAt: new Date(),
      },
    });
  
  return NextResponse.json({ success: true });
}
```

---

## 六、API 端点汇总

### Skill 管理

| 端点 | 方法 | 说明 | 权限 |
|------|------|------|------|
| `/api/skills` | GET | 获取 Skill 列表 | 所有人 |
| `/api/skills` | POST | 创建新 Skill | 所有人 |
| `/api/skills/[id]` | GET | 获取 Skill 详情 | 所有人 |
| `/api/skills/[id]` | PUT | 更新 Skill 信息 | 创建者/管理员 |
| `/api/skills/[id]` | DELETE | 删除 Skill | 创建者/管理员 |
| `/api/skills/[id]/status` | PUT | 更新 Skill 状态 | 创建者/管理员 |

### 安装管理

| 端点 | 方法 | 说明 | 权限 |
|------|------|------|------|
| `/api/skills/[id]/install` | POST | 安装到 Agent | 管理员 |
| `/api/skills/[id]/uninstall` | POST | 从 Agent 卸载 | 管理员 |

### 信任管理

| 端点 | 方法 | 说明 | 权限 |
|------|------|------|------|
| `/api/skills/snapshot` | POST | 创建 Skill 快照 | 管理员 |
| `/api/skills/[id]/trust` | POST | 信任 Skill | 管理员 |
| `/api/skills/[id]/untrust` | POST | 拒绝 Skill | 管理员 |
| `/api/skills/risk-report` | GET | 获取风险报告 | 管理员 |

### 外部发布

| 端点 | 方法 | 说明 | 权限 |
|------|------|------|------|
| `/api/skillhub-settings` | GET | 获取 SkillHub 配置 | 所有人 |
| `/api/skillhub-settings` | PUT | 更新 SkillHub 配置 | 管理员 |
| `/api/skills/[id]/publish-external` | POST | 发布到外部 SkillHub | 管理员 |

---

## 七、前端页面

### 7.1 页面结构

```
/skills
├── /page.tsx                  # Skill 列表页
├── /[id]/page.tsx             # Skill 详情页
├── /create/page.tsx           # 创建 Skill
├── /risk-alerts/page.tsx      # 风险报告页（管理员）
└── /settings/page.tsx         # SkillHub 设置（管理员）
```

### 7.2 Skill 列表页

```tsx
// app/skills/page.tsx

export default function SkillsPage() {
  const { t } = useTranslation();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [filter, setFilter] = useState<'all' | 'mine' | 'active'>('all');
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('skills.title')}</h1>
        <Button onClick={() => router.push('/skills/create')}>
          {t('skills.create')}
        </Button>
      </div>
      
      {/* 筛选器 */}
      <div className="flex gap-2">
        <Button
          variant={filter === 'all' ? 'default' : 'outline'}
          onClick={() => setFilter('all')}
        >
          {t('skills.all')}
        </Button>
        <Button
          variant={filter === 'mine' ? 'default' : 'outline'}
          onClick={() => setFilter('mine')}
        >
          {t('skills.mine')}
        </Button>
        <Button
          variant={filter === 'active' ? 'default' : 'outline'}
          onClick={() => setFilter('active')}
        >
          {t('skills.active')}
        </Button>
      </div>
      
      {/* Skill 卡片列表 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {skills.map(skill => (
          <SkillCard key={skill.id} skill={skill} />
        ))}
      </div>
    </div>
  );
}
```

### 7.3 风险报告页

```tsx
// app/skills/risk-alerts/page.tsx

export default function SkillRiskAlertsPage() {
  const { t } = useTranslation();
  const [riskReport, setRiskReport] = useState<RiskReport | null>(null);
  
  useEffect(() => {
    fetch('/api/skills/risk-report')
      .then(res => res.json())
      .then(setRiskReport);
  }, []);
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('skills.riskAlerts')}</h1>
        <Button onClick={() => createSnapshot()}>
          {t('skills.createSnapshot')}
        </Button>
      </div>
      
      {/* 风险统计 */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{riskReport?.summary.totalRisky || 0}</div>
            <div className="text-sm text-muted-foreground">{t('skills.riskySkills')}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-yellow-600">{riskReport?.summary.pending || 0}</div>
            <div className="text-sm text-muted-foreground">{t('skills.pendingReview')}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-600">{riskReport?.summary.untrusted || 0}</div>
            <div className="text-sm text-muted-foreground">{t('skills.untrusted')}</div>
          </CardContent>
        </Card>
      </div>
      
      {/* 风险 Skill 列表 */}
      <Card>
        <CardHeader>
          <CardTitle>{t('skills.riskySkillsList')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('skills.name')}</TableHead>
                <TableHead>{t('skills.source')}</TableHead>
                <TableHead>{t('skills.trustStatus')}</TableHead>
                <TableHead>{t('skills.discoveredAt')}</TableHead>
                <TableHead>{t('skills.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {riskReport?.riskySkills.map(skill => (
                <TableRow key={skill.id}>
                  <TableCell className="font-medium">{skill.name}</TableCell>
                  <TableCell>
                    <Badge variant={skill.source === 'unknown' ? 'destructive' : 'secondary'}>
                      {skill.source}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={skill.trustStatus === 'untrusted' ? 'destructive' : 'warning'}>
                      {skill.trustStatus}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(skill.discoveredAt)}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => trustSkill(skill.id)}>
                        {t('skills.trust')}
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => untrustSkill(skill.id)}>
                        {t('skills.untrust')}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## 八、安全策略

### 8.1 场景应对

| 场景 | 策略 |
|------|------|
| 未知来源 Skill | 标记 `source: unknown`，触发风险提示 |
| 已拒绝的 Skill 再次出现 | 触发 `untrusted_skill` 风险 |
| 敏感 Skill | 触发 `sensitive_skill` 风险，需二次确认 |
| 管理员信任后的 Skill | 更新 `source: external`，不再提示风险 |
| 团队机密 SOP | 标记 `isSensitive: true`，永不外发 |
| 严格保密团队 | `publishMode: disabled` |
| 一般团队 | `publishMode: admin_only` |
| 开源协作团队 | `publishMode: auto` |

### 8.2 权限矩阵

| 操作 | 创建者 | 管理员 | 其他用户 |
|------|--------|--------|----------|
| 创建 Skill | ✅ | ✅ | ✅ |
| 编辑自己创建的 Skill | ✅ | ✅ | ❌ |
| 提交审批 | ✅ | ✅ | ❌ |
| 审批通过/拒绝 | ❌ | ✅ | ❌ |
| 安装到 Agent | ❌ | ✅ | ❌ |
| 从 Agent 卸载 | ❌ | ✅ | ❌ |
| 信任/拒绝 Skill | ❌ | ✅ | ❌ |
| 使用 active 状态的 Skill | ✅ | ✅ | ✅ |
| 查看 Skill 详情 | ✅ | ✅ | ✅ |

---

## 九、总结

### 核心价值

1. **统一管理**：所有 Skill 通过 SkillHub 注册、审批、分发
2. **安全保障**：快照监控、信任管理、敏感标记
3. **灵活发布**：三种发布模式适应不同团队需求
4. **审计跟踪**：完整的操作日志和状态变更记录

### 技术实现

- **数据库**：`skills` + `skillSnapshots` + `skillTrustRecords` + `skillHubSettings`
- **API**：完整的 CRUD + 审批 + 安装/卸载 + 外部发布
- **Gateway 集成**：`skills.install` + `toggleSkill` + `getAgentSkills`
- **文件系统**：`skills/` 目录结构
- **定时任务**：每 6 小时自动快照

### 下一步

1. 实现数据库迁移（已完成 schema 定义）
2. 实现 Skill 注册 API
3. 实现审批流程
4. 实现安装/卸载 API
5. 实现定时快照任务
6. 实现前端页面
7. 编写测试用例
