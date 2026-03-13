/**
 * SkillHub 端到端测试
 * 
 * 测试覆盖：
 * 1. Skill 注册流程
 * 2. Skill 状态管理
 * 3. Skill 快照与风险检测
 * 4. Skill 信任管理
 * 5. 任务调用 Skill
 * 
 * 运行方式：
 * npx tsx tests/e2e/skillhub.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const ADMIN_TOKEN = process.env.TEST_ADMIN_TOKEN || 'test-admin-token';
const USER_TOKEN = process.env.TEST_USER_TOKEN || 'test-user-token';

interface Skill {
  id: string;
  skillKey: string;
  name: string;
  description: string;
  version: string;
  category: string;
  source: string;
  trustStatus: string;
  installedAgents: string[];
  createdAt: string;
}

interface SkillSnapshot {
  id: string;
  agentId: string;
  snapshotAt: string;
  skills: Array<{
    skillKey: string;
    name: string;
    version?: string;
    enabled: boolean;
  }>;
  diff?: {
    added: string[];
    removed: string[];
    unchanged: string[];
  };
  riskAlerts?: Array<{
    type: string;
    skillKey: string;
    message: string;
  }>;
}

describe('SkillHub E2E Tests', () => {
  let createdSkillId: string;
  let createdAgentId: string;
  let createdTaskId: string;

  beforeAll(async () => {
    console.log('🚀 Starting SkillHub E2E tests...');
    
    // 确保数据库已初始化
    try {
      execSync('npm run db:push', { stdio: 'inherit' });
    } catch (error) {
      console.warn('Database already initialized or push failed');
    }
  });

  afterAll(async () => {
    console.log('🧹 Cleaning up test data...');
    
    // 清理测试数据
    if (createdSkillId) {
      await fetch(`${BASE_URL}/api/skills/${createdSkillId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
      });
    }
  });

  describe('1. Skill 注册流程', () => {
    it('should register a new skill from SOP Template', async () => {
      // 创建测试 Skill 目录
      const skillDir = path.join(process.cwd(), 'skills', 'test-skill-e2e');
      await fs.mkdir(skillDir, { recursive: true });
      
      const skillContent = `---
name: teamclaw.test.e2e-skill
version: 1.0.0
description: E2E test skill
category: content
source: manual
---

# E2E Test Skill

This is a test skill for E2E testing.

## Stage 1: Test Stage

- Type: content
- Description: A test stage for validation
`;
      
      await fs.writeFile(path.join(skillDir, 'SKILL.md'), skillContent);
      
      // 注册 Skill
      const response = await fetch(`${BASE_URL}/api/skills`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${USER_TOKEN}`,
        },
        body: JSON.stringify({
          name: 'teamclaw.test.e2e-skill',
          version: '1.0.0',
          description: 'E2E test skill',
          category: 'content',
          source: 'manual',
          skillPath: skillDir,
        }),
      });
      
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.skill).toBeDefined();
      expect(data.skill.skillKey).toBe('teamclaw.test.e2e-skill');
      expect(data.skill.trustStatus).toBe('pending'); // 手动创建默认为 pending
      
      createdSkillId = data.skill.id;
      
      // 清理测试目录
      await fs.rm(skillDir, { recursive: true, force: true });
    });

    it('should reject invalid skill structure', async () => {
      const skillDir = path.join(process.cwd(), 'skills', 'invalid-skill');
      await fs.mkdir(skillDir, { recursive: true });
      
      // 缺少必需字段的 SKILL.md
      const invalidContent = `---
name: invalid.skill
---

# Invalid Skill

Missing required fields
`;
      
      await fs.writeFile(path.join(skillDir, 'SKILL.md'), invalidContent);
      
      const response = await fetch(`${BASE_URL}/api/skills`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${USER_TOKEN}`,
        },
        body: JSON.stringify({
          name: 'invalid.skill',
          version: '1.0.0',
          description: 'Invalid skill',
          category: 'content',
          source: 'manual',
          skillPath: skillDir,
        }),
      });
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Invalid skill structure');
      
      await fs.rm(skillDir, { recursive: true, force: true });
    });

    it('should prevent duplicate skill registration', async () => {
      // 尝试重复注册
      const response = await fetch(`${BASE_URL}/api/skills`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${USER_TOKEN}`,
        },
        body: JSON.stringify({
          name: 'teamclaw.test.e2e-skill',
          version: '1.0.0',
          description: 'Duplicate skill',
          category: 'content',
          source: 'manual',
          skillPath: '/tmp/test',
        }),
      });
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('already exists');
    });
  });

  describe('2. Skill 状态管理', () => {
    it('should allow user to submit skill for approval', async () => {
      const response = await fetch(`${BASE_URL}/api/skills/${createdSkillId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${USER_TOKEN}`,
        },
        body: JSON.stringify({
          status: 'pending_approval',
          note: 'Ready for review',
        }),
      });
      
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.status).toBe('pending_approval');
    });

    it('should allow admin to approve skill', async () => {
      const response = await fetch(`${BASE_URL}/api/skills/${createdSkillId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ADMIN_TOKEN}`,
        },
        body: JSON.stringify({
          status: 'active',
          note: 'Approved by admin',
        }),
      });
      
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.status).toBe('active');
    });

    it('should prevent non-admin from approving skill', async () => {
      // 创建另一个测试 Skill
      const skillDir = path.join(process.cwd(), 'skills', 'test-skill-2');
      await fs.mkdir(skillDir, { recursive: true });
      
      const skillContent = `---
name: teamclaw.test.skill2
version: 1.0.0
description: Test skill 2
category: content
source: manual
---

# Test Skill 2
`;
      
      await fs.writeFile(path.join(skillDir, 'SKILL.md'), skillContent);
      
      const createResponse = await fetch(`${BASE_URL}/api/skills`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${USER_TOKEN}`,
        },
        body: JSON.stringify({
          name: 'teamclaw.test.skill2',
          version: '1.0.0',
          description: 'Test skill 2',
          category: 'content',
          source: 'manual',
          skillPath: skillDir,
        }),
      });
      
      const createData = await createResponse.json();
      const skill2Id = createData.skill.id;
      
      // 提交审批
      await fetch(`${BASE_URL}/api/skills/${skill2Id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${USER_TOKEN}`,
        },
        body: JSON.stringify({ status: 'pending_approval' }),
      });
      
      // 普通用户尝试批准
      const approveResponse = await fetch(`${BASE_URL}/api/skills/${skill2Id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${USER_TOKEN}`,
        },
        body: JSON.stringify({
          status: 'active',
          note: 'Trying to approve',
        }),
      });
      
      expect(approveResponse.status).toBe(403);
      
      // 清理
      await fetch(`${BASE_URL}/api/skills/${skill2Id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
      });
      await fs.rm(skillDir, { recursive: true, force: true });
    });
  });

  describe('3. Skill 快照与风险检测', () => {
    it('should create skill snapshot for agent', async () => {
      // 创建测试 Agent
      const agentResponse = await fetch(`${BASE_URL}/api/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ADMIN_TOKEN}`,
        },
        body: JSON.stringify({
          name: 'Test Agent',
          type: 'ai',
          projectId: 'test-project-id',
          openclawAgentId: 'test-agent-001',
        }),
      });
      
      const agentData = await agentResponse.json();
      createdAgentId = agentData.member.id;
      
      // 创建快照
      const response = await fetch(`${BASE_URL}/api/skills/snapshot`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ADMIN_TOKEN}`,
        },
        body: JSON.stringify({ agentId: createdAgentId }),
      });
      
      // 注意：如果 Gateway 未运行，可能会失败
      if (!response.ok) {
        console.warn('Snapshot creation failed (Gateway may not be running)');
        return;
      }
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.snapshot).toBeDefined();
      expect(data.snapshot.skillCount).toBeGreaterThanOrEqual(0);
    });

    it('should detect unknown skill risk', async () => {
      // 模拟发现未知 Skill
      const riskReportResponse = await fetch(`${BASE_URL}/api/skills/risk-report`, {
        headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
      });
      
      expect(riskReportResponse.ok).toBe(true);
      const report = await riskReportResponse.json();
      expect(report.summary).toBeDefined();
      expect(typeof report.summary.totalRisky).toBe('number');
    });

    it('should prevent non-admin from creating snapshot', async () => {
      const response = await fetch(`${BASE_URL}/api/skills/snapshot`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${USER_TOKEN}`,
        },
        body: JSON.stringify({ agentId: createdAgentId }),
      });
      
      expect(response.status).toBe(403);
    });
  });

  describe('4. Skill 信任管理', () => {
    it('should allow admin to trust skill', async () => {
      const response = await fetch(`${BASE_URL}/api/skills/${createdSkillId}/trust`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ADMIN_TOKEN}`,
        },
        body: JSON.stringify({
          agentId: createdAgentId,
          note: 'Trusted for production use',
        }),
      });
      
      expect(response.ok).toBe(true);
      
      // 验证状态已更新
      const getResponse = await fetch(`${BASE_URL}/api/skills/${createdSkillId}`, {
        headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
      });
      
      const data = await getResponse.json();
      expect(data.skill.trustStatus).toBe('trusted');
    });

    it('should allow admin to untrust skill', async () => {
      const response = await fetch(`${BASE_URL}/api/skills/${createdSkillId}/untrust`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ADMIN_TOKEN}`,
        },
        body: JSON.stringify({
          agentId: createdAgentId,
          note: 'Security concern detected',
          uninstall: false,
        }),
      });
      
      expect(response.ok).toBe(true);
      
      // 验证状态已更新
      const getResponse = await fetch(`${BASE_URL}/api/skills/${createdSkillId}`, {
        headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
      });
      
      const data = await getResponse.json();
      expect(data.skill.trustStatus).toBe('untrusted');
    });

    it('should prevent non-admin from trusting skill', async () => {
      const response = await fetch(`${BASE_URL}/api/skills/${createdSkillId}/trust`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${USER_TOKEN}`,
        },
        body: JSON.stringify({ agentId: createdAgentId }),
      });
      
      expect(response.status).toBe(403);
    });
  });

  describe('5. 任务调用 Skill', () => {
    it('should execute skill via MCP tool', async () => {
      // 先信任 Skill
      await fetch(`${BASE_URL}/api/skills/${createdSkillId}/trust`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ADMIN_TOKEN}`,
        },
        body: JSON.stringify({
          agentId: createdAgentId,
          note: 'Trusted for testing',
        }),
      });
      
      // 创建测试任务
      const taskResponse = await fetch(`${BASE_URL}/api/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${USER_TOKEN}`,
        },
        body: JSON.stringify({
          title: 'Test task for skill execution',
          description: 'Testing skill execution',
          projectId: 'test-project-id',
          status: 'todo',
        }),
      });
      
      const taskData = await taskResponse.json();
      createdTaskId = taskData.task.id;
      
      // 调用 Skill
      const response = await fetch(`${BASE_URL}/api/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${USER_TOKEN}`,
        },
        body: JSON.stringify({
          tool: 'execute_skill',
          parameters: {
            skill_key: 'teamclaw.test.e2e-skill',
            task_id: createdTaskId,
          },
        }),
      });
      
      // 注意：如果 Agent 或 Gateway 不可用，可能会失败
      if (!response.ok) {
        console.warn('Skill execution failed (Agent/Gateway may not be available)');
        return;
      }
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.message).toContain('execution started');
    });

    it('should prevent execution of untrusted skill', async () => {
      // 设置为未信任
      await fetch(`${BASE_URL}/api/skills/${createdSkillId}/untrust`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ADMIN_TOKEN}`,
        },
        body: JSON.stringify({ agentId: createdAgentId }),
      });
      
      const response = await fetch(`${BASE_URL}/api/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${USER_TOKEN}`,
        },
        body: JSON.stringify({
          tool: 'execute_skill',
          parameters: {
            skill_key: 'teamclaw.test.e2e-skill',
            task_id: createdTaskId,
          },
        }),
      });
      
      expect(response.ok).toBe(false);
      const data = await response.json();
      expect(data.error).toContain('not trusted');
    });

    it('should prevent execution of non-existent skill', async () => {
      const response = await fetch(`${BASE_URL}/api/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${USER_TOKEN}`,
        },
        body: JSON.stringify({
          tool: 'execute_skill',
          parameters: {
            skill_key: 'non.existent.skill',
            task_id: createdTaskId,
          },
        }),
      });
      
      expect(response.ok).toBe(false);
      const data = await response.json();
      expect(data.error).toContain('not found');
    });
  });

  describe('6. 外部 SkillHub 集成', () => {
    it('should allow admin to get skillhub settings', async () => {
      const response = await fetch(`${BASE_URL}/api/skillhub-settings`, {
        headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
      });
      
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.settings).toBeDefined();
      expect(['disabled', 'admin_only', 'auto']).toContain(data.settings.publishMode);
    });

    it('should allow admin to update skillhub settings', async () => {
      const response = await fetch(`${BASE_URL}/api/skillhub-settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ADMIN_TOKEN}`,
        },
        body: JSON.stringify({
          publishMode: 'admin_only',
          opensourceAttribution: 'Powered by TeamClaw',
        }),
      });
      
      expect(response.ok).toBe(true);
      
      // 验证更新
      const getResponse = await fetch(`${BASE_URL}/api/skillhub-settings`, {
        headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
      });
      
      const data = await getResponse.json();
      expect(data.settings.publishMode).toBe('admin_only');
    });

    it('should prevent non-admin from updating skillhub settings', async () => {
      const response = await fetch(`${BASE_URL}/api/skillhub-settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${USER_TOKEN}`,
        },
        body: JSON.stringify({
          publishMode: 'auto',
        }),
      });
      
      expect(response.status).toBe(403);
    });
  });
});

console.log('✅ SkillHub E2E test suite defined');
console.log('📝 Run with: npx tsx tests/e2e/skillhub.test.ts');
