# 多用户数据权限设计文档

> 版本：v3.0  
> 更新时间：2026-03-05

本文档描述 TeamClaw v3.0 的多用户数据隔离与权限控制方案。

## 目录

- [设计目标](#设计目标)
- [业务模型](#业务模型)
- [数据隔离分类](#数据隔离分类)
- [项目权限系统](#项目权限系统)
- [API 权限矩阵](#api-权限矩阵)
- [数据库 Schema 变更](#数据库-schema-变更)
- [核心实现](#核心实现)
- [使用示例](#使用示例)

---

## 设计目标

1. **团队协作** - 支持多用户共享项目和资源
2. **个人隐私** - 聊天记录等敏感数据严格隔离
3. **灵活权限** - 项目可设置私有、团队、公开三种可见性
4. **向后兼容** - 现有数据平滑迁移，不影响已有功能

---

## 业务模型

TeamClaw v3.0 采用**混合模式**：团队共享 + 个人私有空间并存。

### 核心原则

| 资源类型 | 隔离级别 | 说明 |
|---------|---------|------|
| AI 成员 | 系统级共享 | 所有用户共用同一批 AI 成员 |
| 聊天记录 | 严格用户隔离 | 每个用户只能看到自己与 AI 的对话 |
| 项目 | 项目级权限 | Owner 可邀请协作者，也可设为公开 |
| 任务/文档 | 继承项目权限 | 无项目关联的资源为系统公开 |
| Gateway/Workspace | 仅管理员 | 系统级配置，普通用户不可操作 |

### 用户角色

| 角色 | 说明 | 权限范围 |
|-----|------|---------|
| `admin` | 系统管理员 | 所有数据的完全访问权限 |
| `member` | 普通用户 | 仅自己的数据 + 有权限的项目数据 |
| `viewer` | 只读用户（预留） | 仅公开数据，不可编辑 |

> **注**: 角色名与 `db/schema.ts` 中 `users.role` 的 enum 值一致：`admin`/`member`/`viewer`

---

## 数据隔离分类

### 分类矩阵

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          数据隔离分类矩阵                                │
├─────────────────┬───────────────────────────────────────────────────────┤
│ Admin Only      │ Gateway 配置、OpenClaw Workspaces、定时任务管理       │
│ (仅管理员)      │ AI 成员增删改                                        │
├─────────────────┼───────────────────────────────────────────────────────┤
│ 系统级共享      │ AI 成员（只读）、定时任务（只读）                     │
│ (所有用户可见)  │                                                       │
├─────────────────┼───────────────────────────────────────────────────────┤
│ 严格用户隔离    │ 聊天会话、聊天消息                                   │
│ (仅自己可见)    │                                                       │
├─────────────────┼───────────────────────────────────────────────────────┤
│ 项目级共享      │ 项目、任务、文档、里程碑                             │
│ (按项目权限)    │ 交付物、评论、任务日志                               │
└─────────────────┴───────────────────────────────────────────────────────┘
```

### 详细说明

#### Admin Only（仅管理员）

- **Gateway 配置** (`/api/gateway/config`) - WebSocket 连接配置
- **OpenClaw Workspaces** (`/api/openclaw-workspaces`) - 工作区管理
- **定时任务管理** (`/api/scheduled-tasks`) - 创建/修改/删除
- **AI 成员管理** (`/api/members`) - 创建/修改/删除
- **Skill 安装/卸载** (`/api/skills/[id]/install`, `/api/skills/[id]/uninstall`) - 安装到 Agent
- **Skill 信任管理** (`/api/skills/[id]/trust`, `/api/skills/[id]/untrust`) - 标记信任/拒绝
- **Skill 快照管理** (`/api/skills/snapshot`) - 创建 Agent Skill 快照
- **风险报告查看** (`/api/skills/risk-report`) - 查看 Skill 安全风险

#### 系统级共享（所有登录用户可见）

- **AI 成员查看** - 所有用户可查看 AI 成员列表
- **定时任务查看** - 所有用户可查看定时任务状态
- **已激活 Skill 查看** - 所有用户可查看 status=active 的 Skill 列表和详情
- **已激活 Skill 使用** - 所有用户可通过 MCP 工具调用 active 状态的 Skill

#### 严格用户隔离（仅自己可见）

- **聊天会话** (`chat_sessions`) - 每个用户只能看到自己的会话
- **聊天消息** (`chat_messages`) - 通过会话隔离，消息归属于会话
- **草稿 Skill** - 仅创建者可见自己 status=draft 的 Skill
- **待审批 Skill** - 仅创建者可见自己 status=pending_approval 的 Skill
- **已拒绝 Skill** - 仅创建者可见自己 status=rejected 的 Skill

#### 项目级共享（按项目权限）

- **项目** - 根据 `visibility` 和 `project_members` 判断
- **任务/文档/里程碑** - 继承所属项目的权限
- **无项目关联的资源** - 视为系统公开资源

---

## 项目权限系统

### 项目可见性（visibility）

| 值 | 说明 | 访问规则 |
|---|------|---------|
| `private` | 私有项目 | 仅 Owner 和被邀请的成员可访问 |
| `team` | 团队项目 | 所有登录用户可访问 |
| `public` | 公开项目 | 所有人可访问（含未登录用户，预留） |

### 项目角色（project_members.role）

| 角色 | 说明 | 权限 |
|-----|------|------|
| `owner` | 项目所有者 | 完全控制：编辑、删除项目、管理成员、管理所有内容 |
| `admin` | 项目管理员 | 管理成员（除 owner）、编辑所有内容 |
| `member` | 项目成员 | 编辑内容（任务、文档等） |
| `viewer` | 项目观察者 | 仅查看，不能编辑 |

### 权限继承规则

```
项目权限 → 任务权限
        → 文档权限  
        → 里程碑权限
        → 交付物权限
        → 评论权限
```

**特殊情况**：
- `projectId = NULL` 的资源视为**系统公开**，所有登录用户可访问
- 用户可创建 `private` + 仅自己为成员的项目，实现**私人笔记**功能

---

## API 权限矩阵

### 认证包装器

| 包装器 | 用途 | 认证失败响应 |
|-------|------|-------------|
| `withAuth` | 需要登录 | 401 Unauthorized |
| `withAdminAuth` | 需要管理员 | 403 Forbidden |
| `withOptionalAuth` | 可选登录 | 继续执行，auth 可能为空 |

### API 权限一览

#### 用户相关

| API | 方法 | 权限 |
|-----|------|------|
| `/api/auth/login` | POST | 公开 |
| `/api/auth/logout` | POST | 需要登录 |
| `/api/auth/me` | GET | 需要登录 |
| `/api/users` | GET | Admin Only |
| `/api/users` | POST | Admin Only |
| `/api/users/[id]` | GET/PUT/DELETE | Admin Only |

#### AI 成员

| API | 方法 | 权限 | 说明 |
|-----|------|------|------|
| `/api/members` | GET | 需要登录 | 所有用户可查看 AI 成员列表 |
| `/api/members` | POST | Admin Only | 仅管理员可创建 AI 成员 |
| `/api/members/[id]` | GET | 需要登录 | 所有用户可查看单个 AI 成员 |
| `/api/members/[id]` | PUT/DELETE | Admin Only | 仅管理员可修改/删除 |

#### 聊天（严格用户隔离）

| API | 方法 | 权限 | 说明 |
|-----|------|------|------|
| `/api/chat-sessions` | GET | 需要登录 | 仅返回当前用户的会话 |
| `/api/chat-sessions` | POST | 需要登录 | 自动绑定当前用户 |
| `/api/chat-sessions/[id]` | GET/PUT/DELETE | 需要登录 | 只能操作自己的会话 |
| `/api/chat-messages` | GET | 需要登录 | 仅返回自己会话的消息 |
| `/api/chat-messages` | POST | 需要登录 | 验证会话属于当前用户 |
| `/api/chat-messages/[id]` | PUT | 需要登录 | 验证消息所属会话归属 |

#### 项目（项目级权限）

| API | 方法 | 权限 | 说明 |
|-----|------|------|------|
| `/api/projects` | GET | 需要登录 | 过滤返回有权限的项目 |
| `/api/projects` | POST | 需要登录 | 自动设置 ownerId |
| `/api/projects/[id]` | GET | 需要登录 | 检查项目访问权限 |
| `/api/projects/[id]` | PUT | 需要登录 | 需要编辑权限 |
| `/api/projects/[id]` | DELETE | 需要登录 | 仅 Owner |
| `/api/projects/[id]/members` | GET | 需要登录 | 仅项目成员可查看 |
| `/api/projects/[id]/members` | POST | 需要登录 | Owner/Admin 可添加 |
| `/api/projects/[id]/members/[userId]` | PUT | 需要登录 | Owner/Admin 可修改 |
| `/api/projects/[id]/members/[userId]` | DELETE | 需要登录 | Owner/Admin 或自己退出 |

#### 任务（继承项目权限）

| API | 方法 | 权限 | 说明 |
|-----|------|------|------|
| `/api/tasks` | GET | 需要登录 | 过滤返回有权限项目的任务 |
| `/api/tasks` | POST | 需要登录 | 如指定项目需要编辑权限 |
| `/api/tasks/[id]` | GET | 需要登录 | 检查任务所属项目权限 |
| `/api/tasks/[id]` | PUT | 需要登录 | 需要项目编辑权限 |
| `/api/tasks/[id]` | DELETE | 需要登录 | 需要项目编辑权限 |

#### 文档（继承项目权限）

| API | 方法 | 权限 | 说明 |
|-----|------|------|------|
| `/api/documents` | GET | 需要登录 | 系统公开 + 有权限项目的文档 |
| `/api/documents` | POST | 需要登录 | 如指定项目需要编辑权限 |
| `/api/documents/[id]` | GET | 需要登录 | 检查文档所属项目权限 |
| `/api/documents/[id]` | PUT/DELETE | 需要登录 | 需要项目编辑权限 |

#### 系统配置（Admin Only）

| API | 方法 | 权限 |
|-----|------|------|
| `/api/gateway/config` | POST/DELETE | Admin Only |
| `/api/openclaw-workspaces` | POST | Admin Only |
| `/api/openclaw-workspaces/[id]` | PUT/DELETE | Admin Only |
| `/api/scheduled-tasks` | POST | Admin Only |
| `/api/scheduled-tasks/[id]` | PUT/DELETE | Admin Only |

#### Skill（混合权限模式）

| API | 方法 | 权限 | 说明 |
|-----|------|------|------|
| `/api/skills` | GET | 需要登录 | 返回 active Skill + 自己创建的非 active Skill |
| `/api/skills` | POST | 需要登录 | 自动绑定 createdBy 为当前用户 |
| `/api/skills/[id]` | GET | 需要登录 | active 全可见；非 active 仅创建者和管理员可见 |
| `/api/skills/[id]` | PUT | 需要登录 | 创建者或管理员可编辑 |
| `/api/skills/[id]` | DELETE | 需要登录 | 创建者或管理员可删除 |
| `/api/skills/[id]/install` | POST | Admin Only | 安装 Skill 到 Agent |
| `/api/skills/[id]/uninstall` | POST | Admin Only | 从 Agent 卸载 Skill |
| `/api/skills/[id]/trust` | POST | Admin Only | 标记 Skill 为信任 |
| `/api/skills/[id]/untrust` | POST | Admin Only | 标记 Skill 为不信任 |
| `/api/skills/snapshot` | POST | Admin Only | 创建 Agent Skill 快照 |
| `/api/skills/risk-report` | GET | Admin Only | 获取风险报告 |

---

## 数据库 Schema 变更

### 新增字段

#### chat_sessions 表

```sql
-- 用户隔离字段
ALTER TABLE chat_sessions ADD COLUMN user_id TEXT;

-- 索引
CREATE INDEX idx_chat_sessions_user_id ON chat_sessions(user_id);
```

#### projects 表

```sql
-- 所有者
ALTER TABLE projects ADD COLUMN owner_id TEXT;

-- 可见性
ALTER TABLE projects ADD COLUMN visibility TEXT DEFAULT 'private';

-- 索引
CREATE INDEX idx_projects_owner_id ON projects(owner_id);
CREATE INDEX idx_projects_visibility ON projects(visibility);
```

### 新增表

#### project_members 表

```sql
CREATE TABLE project_members (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',  -- owner, admin, member, viewer
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),
  UNIQUE(project_id, user_id)
);

CREATE INDEX idx_project_members_project_id ON project_members(project_id);
CREATE INDEX idx_project_members_user_id ON project_members(user_id);
```

### 数据迁移

```typescript
// db/index.ts 中的自动迁移逻辑

// 1. 检测并添加 chat_sessions.user_id
// 2. 检测并添加 projects.owner_id 和 visibility
// 3. 检测并创建 project_members 表
// 4. 将现有会话迁移到 admin 用户
// 5. 将现有项目 owner 设为 admin 用户
// 6. 检测并添加 skills.created_by（v3.0 新增）
```

#### skills 表（v3.0 新增）

```sql
-- 创建者字段（用户隔离）
ALTER TABLE skills ADD COLUMN created_by TEXT REFERENCES users(id) ON DELETE SET NULL;

-- 索引
CREATE INDEX idx_skills_created_by ON skills(created_by);
CREATE INDEX idx_skills_status ON skills(status);  -- 已存在，用于按状态过滤
```

**权限逻辑**：
- `status = 'active'` 的 Skill：所有用户可见（系统级共享）
- `status != 'active'` 的 Skill：仅 `created_by = userId` 或管理员可见（用户隔离）

---

## 核心实现

### 权限检查函数

位置：`lib/project-access.ts`

#### checkProjectAccess

检查用户对指定项目的访问权限。

```typescript
interface ProjectAccessResult {
  hasAccess: boolean;      // 是否有访问权限
  canEdit: boolean;        // 是否有编辑权限
  isOwner: boolean;        // 是否是所有者
  role: ProjectRole | null; // 在项目中的角色
}

async function checkProjectAccess(
  projectId: string,
  userId: string,
  userRole: string
): Promise<ProjectAccessResult>
```

**判断逻辑**：
1. Admin 用户 → 完全权限
2. 公开项目 (`public`) → 所有人可访问，不可编辑
3. 团队项目 (`team`) → 登录用户可访问，不可编辑
4. 私有项目 (`private`) → 检查 project_members
5. 根据 role 判断编辑权限（owner/admin/member 可编辑）

#### getAccessibleProjectIds

获取用户可访问的所有项目 ID 列表。

```typescript
async function getAccessibleProjectIds(
  userId: string,
  userRole: string
): Promise<string[]>
```

**返回范围**：
- Admin → 所有项目
- 普通用户 → public + team + 自己是成员的 private 项目

#### buildProjectAccessFilter

构建 Drizzle ORM 查询过滤条件。

```typescript
async function buildProjectAccessFilter(
  userId: string,
  userRole: string
): Promise<SQL | undefined>
```

### 认证包装器

位置：`lib/with-auth.ts`

```typescript
// 需要登录
export const withAuth = (handler: AuthenticatedHandler) => {
  return async (request: NextRequest, context?: RouteContext) => {
    const auth = await authenticateRequest(request);
    if (!auth.authenticated) {
      return createUnauthorizedResponse();
    }
    return handler(request, auth, context);
  };
};

// 需要管理员
export const withAdminAuth = (handler: AuthenticatedHandler) => {
  return async (request: NextRequest, context?: RouteContext) => {
    const auth = await authenticateRequest(request);
    if (!auth.authenticated) {
      return createUnauthorizedResponse();
    }
    if (auth.userRole !== 'admin') {
      return createForbiddenResponse();
    }
    return handler(request, auth, context);
  };
};
```

### Skill 权限检查

位置：`lib/skill-access.ts`

#### checkSkillAccess

检查用户对指定 Skill 的访问权限。

```typescript
interface SkillAccessResult {
  hasAccess: boolean;      // 是否有访问权限
  canEdit: boolean;        // 是否有编辑权限
  isCreator: boolean;      // 是否是创建者
}

async function checkSkillAccess(
  skillId: string,
  userId: string,
  userRole: string
): Promise<SkillAccessResult>
```

**判断逻辑**：
1. Admin 用户 → 完全权限
2. `status = 'active'` → 所有人可访问，不可编辑
3. `status != 'active'` → 仅创建者可访问和编辑
4. Admin 可编辑所有 Skill

#### buildSkillListFilter

构建 Skill 列表查询的过滤条件。

```typescript
async function buildSkillListFilter(
  userId: string,
  userRole: string
): Promise<SQL | undefined>
```

**返回范围**：
- Admin → 所有 Skill
- 普通用户 → `status = 'active'` + 自己创建的 Skill（任意状态）

---

## 使用示例

### 示例 1：创建私人笔记项目

```typescript
// 1. 创建私有项目
POST /api/projects
{
  "name": "我的私人笔记",
  "visibility": "private"  // 默认值
}
// → 自动设置 ownerId 为当前用户
// → 自动创建 owner 角色的 project_member 记录

// 2. 在项目下创建文档
POST /api/documents
{
  "title": "私人笔记",
  "content": "...",
  "projectId": "<项目ID>"
}
// → 仅自己可见
```

### 示例 2：邀请协作者

```typescript
// 1. 查看项目成员
GET /api/projects/<projectId>/members

// 2. 添加协作者
POST /api/projects/<projectId>/members
{
  "userId": "<用户ID>",
  "role": "member"  // 可编辑
}

// 3. 修改角色
PUT /api/projects/<projectId>/members/<userId>
{
  "role": "viewer"  // 改为只读
}

// 4. 移除成员
DELETE /api/projects/<projectId>/members/<userId>
```

### 示例 3：设置公开项目

```typescript
// 修改项目可见性
PUT /api/projects/<projectId>
{
  "visibility": "public"
}
// → 所有人可查看项目及其任务、文档
// → 但只有成员可编辑
```

---

## 相关文档

- [API 文档](./API.md) - REST API 完整接口说明
- [开发文档](./DEVELOPMENT.md) - 架构设计与 Store 说明
- [编码规范](../../CODING_STANDARDS.md) - API Route 开发规范

---

## 变更历史

| 版本 | 日期 | 变更内容 |
|-----|------|---------|
| v3.0 | 2026-03-11 | 新增 Skill 权限设计：混合权限模式（系统级共享 + 用户隔离） |
| v3.0 | 2026-03-05 | 初始版本：多用户数据隔离方案设计与实现 |
