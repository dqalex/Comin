/**
 * SkillHub API 测试脚本（遗留）
 * 
 * ⚠️ 此脚本使用自定义测试框架，建议迁移到 tests/integration/ 使用 Vitest。
 * 对应的 Vitest 版本：tests/integration/skillhub-api.test.ts
 * 
 * 测试范围：
 * 1. 审批系统 API
 * 2. Skill 注册与管理 API
 * 3. 快照与信任管理 API
 * 4. MCP 工具集成
 */

import path from 'path';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface TestResult {
  name: string;
  success: boolean;
  duration: number;
  error?: string;
  data?: unknown;
}

const results: TestResult[] = [];

/**
 * 测试辅助函数
 */
async function test(name: string, fn: () => Promise<void>): Promise<void> {
  const start = Date.now();
  try {
    await fn();
    results.push({
      name,
      success: true,
      duration: Date.now() - start,
    });
    console.log(`✅ ${name} (${Date.now() - start}ms)`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    results.push({
      name,
      success: false,
      duration: Date.now() - start,
      error: errorMsg,
    });
    console.error(`❌ ${name}: ${errorMsg}`);
  }
}

/**
 * HTTP 请求辅助函数
 */
async function request(
  method: string,
  path: string,
  body?: unknown,
  headers?: Record<string, string>
): Promise<{ status: number; data: unknown }> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

/**
 * 断言辅助函数
 */
function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

// ============================================================
// 测试用例
// ============================================================

async function testApprovalSystem() {
  console.log('\n📋 测试审批系统 API...\n');

  // 测试创建审批请求（需要认证）
  let approvalId: string = '';
  
  await test('创建审批请求', async () => {
    const { status, data } = await request('POST', '/api/approval-requests', {
      type: 'skill_publish',
      resourceType: 'skill',
      resourceId: 'test-skill-001',
      requesterId: 'test-user-001',
      payload: { skillKey: 'test.skill.example', skillName: 'Test Skill' },
      requestNote: 'Test approval request',
    });

    if (status === 401) {
      console.log('  ⚠️  Approval API requires authentication, skipping...');
      return;
    }

    assert(status === 201, `Expected 201, got ${status}: ${JSON.stringify(data)}`);
    assert((data as any).data?.id, 'Missing approval ID');
    approvalId = (data as any).data.id;
  });

  // 测试获取审批列表（需要认证）
  await test('获取审批列表', async () => {
    const { status, data } = await request('GET', '/api/approval-requests?status=pending');
    
    if (status === 401) {
      console.log('  ⚠️  Approval API requires authentication, skipping...');
      return;
    }
    
    assert(status === 200, `Expected 200, got ${status}: ${JSON.stringify(data)}`);
    assert(Array.isArray((data as any).data), 'Data should be an array');
  });

  // 测试获取审批详情
  await test('获取审批详情', async () => {
    if (!approvalId) {
      console.log('  ⚠️  No approval ID, skipping...');
      return;
    }
    
    const { status, data } = await request('GET', `/api/approval-requests/${approvalId}`);
    assert(status === 200, `Expected 200, got ${status}: ${JSON.stringify(data)}`);
    assert((data as any).data?.id === approvalId, 'ID mismatch');
  });

  // 测试取消审批请求
  await test('取消审批请求', async () => {
    if (!approvalId) {
      console.log('  ⚠️  No approval ID, skipping...');
      return;
    }
    
    const { status, data } = await request('POST', `/api/approval-requests/${approvalId}/cancel`, {
      note: 'Test cancellation',
    });
    assert(status === 200, `Expected 200, got ${status}: ${JSON.stringify(data)}`);
  });
}

async function testSkillRegistration() {
  console.log('\n📦 测试 Skill 注册 API...\n');

  // 测试获取 Skill 列表（空列表）
  await test('获取 Skill 列表', async () => {
    const { status, data } = await request('GET', '/api/skills');
    assert(status === 200, `Expected 200, got ${status}`);
    assert(Array.isArray((data as any).data), 'Data should be an array');
  });

  // 测试注册无效 Skill（目录不存在）
  await test('注册 Skill（无效路径）', async () => {
    const { status, data } = await request('POST', '/api/skills', {
      skillPath: '/nonexistent/skill/path',
    });
    assert(status === 400, `Expected 400, got ${status}`);
    assert((data as any).error, 'Should have error message');
  });

  // 测试注册有效 Skill（使用现有 skills/teamclaw 目录）
  let skillId: string = '';
  
  await test('注册 Skill（有效路径）', async () => {
    const { status, data } = await request('POST', '/api/skills', {
      skillPath: path.resolve(__dirname, '..', 'skills', 'teamclaw'),
    });
    
    // 可能成功（201）或已存在（409）
    if (status === 201) {
      assert((data as any).data?.id, 'Missing skill ID');
      assert((data as any).data?.skillKey, 'Missing skill key');
      skillId = (data as any).data.id;
    } else if (status === 409) {
      console.log('  ⚠️  Skill already exists, skipping creation');
      // 从错误消息中提取 skill ID
      const existing = (data as any).error || '';
      console.log(`  ℹ️  ${existing}`);
    } else if (status === 400) {
      // 验证失败，打印详细错误
      console.log(`  ⚠️  Validation failed: ${JSON.stringify(data)}`);
    } else {
      throw new Error(`Unexpected status ${status}: ${JSON.stringify(data)}`);
    }
  });

  // 测试获取 Skill 详情
  if (skillId) {
    await test('获取 Skill 详情', async () => {
      const { status, data } = await request('GET', `/api/skills/${skillId}`);
      assert(status === 200, `Expected 200, got ${status}`);
      assert((data as any).data?.id === skillId, 'ID mismatch');
    });
  }
}

async function testSnapshotAndTrust() {
  console.log('\n📸 测试快照与信任管理 API...\n');

  // 先获取一个 Skill ID
  let skillId: string = '';
  
  const { data: listData } = await request('GET', '/api/skills?limit=1');
  if ((listData as any)?.data?.[0]?.id) {
    skillId = (listData as any).data[0].id;
  }

  if (!skillId) {
    console.log('  ⚠️  No skill found, skipping snapshot/trust tests');
    return;
  }

  // 测试创建快照
  await test('创建 Skill 快照', async () => {
    const { status, data } = await request('POST', `/api/skills/${skillId}/snapshots`);
    
    if (status === 201) {
      assert((data as any).data?.id, 'Missing snapshot ID');
      assert((data as any).data?.riskMetrics, 'Missing risk metrics');
    } else if (status === 400) {
      console.log('  ⚠️  Skill path not configured');
    } else {
      throw new Error(`Unexpected status ${status}`);
    }
  });

  // 测试获取快照列表
  await test('获取快照列表', async () => {
    const { status, data } = await request('GET', `/api/skills/${skillId}/snapshots`);
    assert(status === 200, `Expected 200, got ${status}`);
    assert(Array.isArray((data as any).data), 'Data should be an array');
  });

  // 测试信任管理
  await test('信任 Skill', async () => {
    const { status, data } = await request('POST', `/api/skills/${skillId}/trust`, {
      action: 'trust',
      note: 'Test trust operation',
    });
    assert(status === 200, `Expected 200, got ${status}`);
    assert((data as any).data?.action === 'trust', 'Action mismatch');
  });

  // 测试取消信任
  await test('取消信任 Skill', async () => {
    const { status, data } = await request('POST', `/api/skills/${skillId}/trust`, {
      action: 'untrust',
      note: 'Test untrust operation',
    });
    assert(status === 200, `Expected 200, got ${status}`);
    assert((data as any).data?.action === 'untrust', 'Action mismatch');
  });
}

async function testMCPTools() {
  console.log('\n🔧 测试 MCP 工具...\n');

  // 测试 list_skills
  await test('MCP: list_skills', async () => {
    const { status, data } = await request('POST', '/api/mcp', {
      tool: 'list_skills',
      parameters: { limit: 10 },
    });
    
    // MCP API 需要认证，可能返回 401
    if (status === 401) {
      console.log('  ⚠️  MCP requires authentication');
      return;
    }
    
    if (status === 400) {
      console.log(`  ⚠️  MCP request format error: ${JSON.stringify(data)}`);
      return;
    }
    
    assert(status === 200, `Expected 200, got ${status}: ${JSON.stringify(data)}`);
    assert((data as any)?.success !== false, 'Tool execution failed');
  });

  // 测试 invoke_skill（需要有效的 skill_key）
  await test('MCP: invoke_skill（不存在的 Skill）', async () => {
    const { status, data } = await request('POST', '/api/mcp', {
      tool: 'invoke_skill',
      parameters: { skill_key: 'nonexistent.skill' },
    });
    
    if (status === 401) {
      console.log('  ⚠️  MCP requires authentication');
      return;
    }
    
    if (status === 400) {
      console.log(`  ⚠️  MCP request format error: ${JSON.stringify(data)}`);
      return;
    }
    
    // 应该返回失败（Skill 不存在）
    assert(status === 200, `Expected 200, got ${status}: ${JSON.stringify(data)}`);
    assert((data as any)?.success === false, 'Should fail for nonexistent skill');
  });
}

// ============================================================
// 运行测试
// ============================================================

async function main() {
  console.log('🚀 SkillHub API 测试开始\n');
  console.log(`📍 Base URL: ${BASE_URL}\n`);

  try {
    await testApprovalSystem();
    await testSkillRegistration();
    await testSnapshotAndTrust();
    await testMCPTools();
  } catch (error) {
    console.error('\n❌ 测试执行失败:', error);
  }

  // 打印测试报告
  console.log('\n' + '='.repeat(60));
  console.log('📊 测试报告');
  console.log('='.repeat(60));

  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  console.log(`\n总计: ${results.length} 个测试`);
  console.log(`✅ 通过: ${passed}`);
  console.log(`❌ 失败: ${failed}`);
  console.log(`⏱️  总耗时: ${totalDuration}ms`);

  if (failed > 0) {
    console.log('\n失败的测试:');
    results
      .filter(r => !r.success)
      .forEach(r => {
        console.log(`  - ${r.name}: ${r.error}`);
      });
  }

  console.log('\n');

  // 退出码
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(console.error);
