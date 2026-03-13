/**
 * ARCH-OPT-001: SQL 白名单验证测试
 *
 * 测试目的：验证 SQL 验证工具函数是否正确工作
 */
import { describe, it, expect } from 'vitest';
import {
  validateTableName,
  validateColumnName,
  isValidTableName,
  isValidColumnName,
  ALLOWED_TABLES,
  ALLOWED_COLUMNS,
} from '@/lib/sql-validator';

describe('ARCH-OPT-001: SQL Validator', () => {
  describe('validateTableName', () => {
    it('应该接受白名单中的表名', () => {
      expect(validateTableName('projects')).toBe('projects');
      expect(validateTableName('members')).toBe('members');
      expect(validateTableName('tasks')).toBe('tasks');
    });

    it('应该拒绝不在白名单中的表名', () => {
      expect(() => validateTableName('users_backup')).toThrow('Table not in whitelist');
      expect(() => validateTableName('malicious_table')).toThrow('Table not in whitelist');
    });

    it('应该拒绝非法格式的表名', () => {
      expect(() => validateTableName('projects; DROP TABLE users;')).toThrow('Invalid table name format');
      expect(() => validateTableName('123projects')).toThrow('Invalid table name format');
    });
  });

  describe('validateColumnName', () => {
    it('应该接受白名单中的列名', () => {
      expect(validateColumnName('projects', 'id')).toBe('id');
      expect(validateColumnName('projects', 'name')).toBe('name');
      expect(validateColumnName('members', 'email')).toBe('email');
    });

    it('应该拒绝不在白名单中的列名', () => {
      expect(() => validateColumnName('projects', 'malicious_column')).toThrow('Column not in whitelist');
    });

    it('应该拒绝非法格式的列名', () => {
      expect(() => validateColumnName('projects', 'id; DROP TABLE users;')).toThrow('Invalid column name format');
    });
  });

  describe('isValidTableName', () => {
    it('应该正确判断表名是否有效', () => {
      expect(isValidTableName('projects')).toBe(true);
      expect(isValidTableName('invalid_table')).toBe(false);
    });
  });

  describe('isValidColumnName', () => {
    it('应该正确判断列名是否有效', () => {
      expect(isValidColumnName('projects', 'id')).toBe(true);
      expect(isValidColumnName('projects', 'invalid_column')).toBe(false);
    });
  });

  describe('ALLOWED_TABLES', () => {
    it('应该包含所有必要的表', () => {
      const requiredTables = ['projects', 'members', 'tasks', 'documents', 'users'];
      for (const table of requiredTables) {
        expect(ALLOWED_TABLES).toContain(table);
      }
    });
  });
});
