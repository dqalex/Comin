/**
 * 审批系统端到端测试
 * 
 * 测试覆盖：
 * 1. 创建审批请求
 * 2. 批准审批请求
 * 3. 拒绝审批请求
 * 4. 取消审批请求
 * 5. 权限验证
 * 
 * 运行方式：
 * npx tsx tests/e2e/approval.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const ADMIN_TOKEN = process.env.TEST_ADMIN_TOKEN || 'test-admin-token';
const USER_TOKEN = process.env.TEST_USER_TOKEN || 'test-user-token';

interface ApprovalRequest {
  id: string;
  type: string;
  resourceType: string;
  resourceId: string;
  requesterId: string;
  status: string;
  createdAt: string;
}

describe('Approval System E2E Tests', () => {
  let createdRequestId: string;

  beforeAll(async () => {
    console.log('🚀 Starting Approval System E2E tests...');
  });

  afterAll(async () => {
    console.log('🧹 Cleaning up test data...');
  });

  describe('1. 创建审批请求', () => {
    it('should create a new approval request', async () => {
      const response = await fetch(`${BASE_URL}/api/approval-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${USER_TOKEN}`,
        },
        body: JSON.stringify({
          type: 'skill_publish',
          resourceType: 'skill',
          resourceId: 'test-skill-id',
          requestNote: 'Please approve my skill',
        }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.request).toBeDefined();
      expect(data.request.type).toBe('skill_publish');
      expect(data.request.status).toBe('pending');
      
      createdRequestId = data.request.id;
    });

    it('should prevent duplicate pending requests', async () => {
      const response = await fetch(`${BASE_URL}/api/approval-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${USER_TOKEN}`,
        },
        body: JSON.stringify({
          type: 'skill_publish',
          resourceType: 'skill',
          resourceId: 'test-skill-id',
          requestNote: 'Another request',
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('already exists');
    });

    it('should validate required fields', async () => {
      const response = await fetch(`${BASE_URL}/api/approval-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${USER_TOKEN}`,
        },
        body: JSON.stringify({
          type: 'skill_publish',
          // missing resourceType and resourceId
        }),
      });

      expect(response.status).toBe(400);
    });
  });

  describe('2. 获取审批请求', () => {
    it('should get approval request list', async () => {
      const response = await fetch(`${BASE_URL}/api/approval-requests`, {
        headers: { Authorization: `Bearer ${USER_TOKEN}` },
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(Array.isArray(data.requests)).toBe(true);
    });

    it('should filter by status', async () => {
      const response = await fetch(`${BASE_URL}/api/approval-requests?status=pending`, {
        headers: { Authorization: `Bearer ${USER_TOKEN}` },
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.requests.every((r: ApprovalRequest) => r.status === 'pending')).toBe(true);
    });

    it('should get approval request detail', async () => {
      const response = await fetch(`${BASE_URL}/api/approval-requests/${createdRequestId}`, {
        headers: { Authorization: `Bearer ${USER_TOKEN}` },
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.request.id).toBe(createdRequestId);
      expect(data.histories).toBeDefined();
    });

    it('should prevent non-owner from viewing request', async () => {
      // 使用不同的用户 token（假设是另一个用户）
      const response = await fetch(`${BASE_URL}/api/approval-requests/${createdRequestId}`, {
        headers: { Authorization: `Bearer ${USER_TOKEN}-other` },
      });

      expect(response.status).toBe(403);
    });
  });

  describe('3. 批准审批请求', () => {
    it('should allow admin to approve request', async () => {
      const response = await fetch(`${BASE_URL}/api/approval-requests/${createdRequestId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ADMIN_TOKEN}`,
        },
        body: JSON.stringify({ note: 'Approved for production use' }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it('should prevent non-admin from approving', async () => {
      // 创建新的请求（因为上一个已被批准）
      const createResponse = await fetch(`${BASE_URL}/api/approval-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${USER_TOKEN}`,
        },
        body: JSON.stringify({
          type: 'skill_publish',
          resourceType: 'skill',
          resourceId: 'test-skill-id-2',
          requestNote: 'Another request',
        }),
      });

      const createData = await createResponse.json();
      const newRequestId = createData.request.id;

      // 普通用户尝试批准
      const response = await fetch(`${BASE_URL}/api/approval-requests/${newRequestId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${USER_TOKEN}`,
        },
        body: JSON.stringify({ note: 'Trying to approve' }),
      });

      expect(response.status).toBe(403);

      // 清理
      await fetch(`${BASE_URL}/api/approval-requests/${newRequestId}/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${USER_TOKEN}` },
      });
    });

    it('should prevent approving already processed request', async () => {
      const response = await fetch(`${BASE_URL}/api/approval-requests/${createdRequestId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ADMIN_TOKEN}`,
        },
        body: JSON.stringify({ note: 'Trying again' }),
      });

      expect(response.status).toBe(400);
    });
  });

  describe('4. 拒绝审批请求', () => {
    it('should allow admin to reject request', async () => {
      // 创建新请求
      const createResponse = await fetch(`${BASE_URL}/api/approval-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${USER_TOKEN}`,
        },
        body: JSON.stringify({
          type: 'skill_publish',
          resourceType: 'skill',
          resourceId: 'test-skill-id-3',
          requestNote: 'Please approve',
        }),
      });

      const createData = await createResponse.json();
      const requestId = createData.request.id;

      // 拒绝
      const response = await fetch(`${BASE_URL}/api/approval-requests/${requestId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ADMIN_TOKEN}`,
        },
        body: JSON.stringify({ note: 'Does not meet requirements' }),
      });

      expect(response.ok).toBe(true);
    });

    it('should prevent non-admin from rejecting', async () => {
      // 创建新请求
      const createResponse = await fetch(`${BASE_URL}/api/approval-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${USER_TOKEN}`,
        },
        body: JSON.stringify({
          type: 'skill_publish',
          resourceType: 'skill',
          resourceId: 'test-skill-id-4',
          requestNote: 'Please approve',
        }),
      });

      const createData = await createResponse.json();
      const requestId = createData.request.id;

      // 普通用户尝试拒绝
      const response = await fetch(`${BASE_URL}/api/approval-requests/${requestId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${USER_TOKEN}`,
        },
        body: JSON.stringify({ note: 'Rejecting' }),
      });

      expect(response.status).toBe(403);

      // 清理
      await fetch(`${BASE_URL}/api/approval-requests/${requestId}/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
      });
    });
  });

  describe('5. 取消审批请求', () => {
    it('should allow requester to cancel own request', async () => {
      // 创建新请求
      const createResponse = await fetch(`${BASE_URL}/api/approval-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${USER_TOKEN}`,
        },
        body: JSON.stringify({
          type: 'skill_publish',
          resourceType: 'skill',
          resourceId: 'test-skill-id-5',
          requestNote: 'Please approve',
        }),
      });

      const createData = await createResponse.json();
      const requestId = createData.request.id;

      // 取消
      const response = await fetch(`${BASE_URL}/api/approval-requests/${requestId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${USER_TOKEN}`,
        },
        body: JSON.stringify({ note: 'Changed my mind' }),
      });

      expect(response.ok).toBe(true);
    });

    it('should allow admin to cancel any request', async () => {
      // 创建新请求
      const createResponse = await fetch(`${BASE_URL}/api/approval-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${USER_TOKEN}`,
        },
        body: JSON.stringify({
          type: 'skill_publish',
          resourceType: 'skill',
          resourceId: 'test-skill-id-6',
          requestNote: 'Please approve',
        }),
      });

      const createData = await createResponse.json();
      const requestId = createData.request.id;

      // 管理员取消
      const response = await fetch(`${BASE_URL}/api/approval-requests/${requestId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ADMIN_TOKEN}`,
        },
        body: JSON.stringify({ note: 'Admin cancelling' }),
      });

      expect(response.ok).toBe(true);
    });

    it('should prevent canceling processed request', async () => {
      // 使用之前已批准的请求
      const response = await fetch(`${BASE_URL}/api/approval-requests/${createdRequestId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${USER_TOKEN}`,
        },
        body: JSON.stringify({ note: 'Trying to cancel' }),
      });

      expect(response.status).toBe(400);
    });
  });
});

console.log('✅ Approval System E2E test suite defined');
console.log('📝 Run with: npx tsx tests/e2e/approval.test.ts');
