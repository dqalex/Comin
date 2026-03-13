/**
 * ARCH-OPT-001: 文件上传验证测试
 *
 * 测试目的：验证文件上传验证工具函数是否正确工作
 */
import { describe, it, expect } from 'vitest';
import {
  validateFile,
  isValidMimeType,
  isValidExtension,
  isValidFileSize,
  getFileExtension,
  sanitizeFilename,
  generateSafeFilename,
  formatFileSize,
  ALLOWED_FILE_TYPES,
  DEFAULT_MAX_FILE_SIZE,
} from '@/lib/file-validator';

describe('ARCH-OPT-001: File Validator', () => {
  describe('getFileExtension', () => {
    it('应该正确提取文件扩展名', () => {
      expect(getFileExtension('test.jpg')).toBe('.jpg');
      expect(getFileExtension('test.JPG')).toBe('.jpg');
      expect(getFileExtension('test.tar.gz')).toBe('.gz');
      expect(getFileExtension('noextension')).toBe('');
    });
  });

  describe('isValidMimeType', () => {
    it('应该接受白名单中的 MIME 类型', () => {
      expect(isValidMimeType('image/jpeg')).toBe(true);
      expect(isValidMimeType('image/png')).toBe(true);
      expect(isValidMimeType('application/pdf')).toBe(true);
    });

    it('应该拒绝不在白名单中的 MIME 类型', () => {
      expect(isValidMimeType('application/x-malicious')).toBe(false);
      expect(isValidMimeType('text/x-script')).toBe(false);
    });
  });

  describe('isValidExtension', () => {
    it('应该接受白名单中的扩展名', () => {
      expect(isValidExtension('.jpg')).toBe(true);
      expect(isValidExtension('pdf')).toBe(true);
      expect(isValidExtension('.PNG')).toBe(true);
    });

    it('应该拒绝不在白名单中的扩展名', () => {
      expect(isValidExtension('.exe')).toBe(false);
      expect(isValidExtension('.bat')).toBe(false);
    });
  });

  describe('isValidFileSize', () => {
    it('应该接受在限制范围内的文件大小', () => {
      expect(isValidFileSize(1024, 'image/jpeg')).toBe(true);
      expect(isValidFileSize(5 * 1024 * 1024, 'image/jpeg')).toBe(true);
    });

    it('应该拒绝超过限制的文件大小', () => {
      expect(isValidFileSize(100 * 1024 * 1024, 'image/jpeg')).toBe(false);
    });
  });

  describe('sanitizeFilename', () => {
    it('应该移除危险字符', () => {
      expect(sanitizeFilename('test/../etc/passwd')).toBe('test___etc_passwd');
      expect(sanitizeFilename('test<script>alert(1)</script>')).toBe('test_script_alert(1)__script_');
    });

    it('应该保留正常文件名', () => {
      expect(sanitizeFilename('normal-file_name.jpg')).toBe('normal-file_name.jpg');
    });
  });

  describe('generateSafeFilename', () => {
    it('应该生成安全的文件名', () => {
      const filename = generateSafeFilename('test.jpg');
      expect(filename).toMatch(/^\d+_[a-z0-9]+\.jpg$/);
    });

    it('应该支持前缀', () => {
      const filename = generateSafeFilename('test.jpg', 'upload');
      expect(filename).toMatch(/^upload_\d+_[a-z0-9]+\.jpg$/);
    });
  });

  describe('formatFileSize', () => {
    it('应该正确格式化文件大小', () => {
      expect(formatFileSize(0)).toBe('0 B');
      expect(formatFileSize(1024)).toBe('1 KB');
      expect(formatFileSize(1024 * 1024)).toBe('1 MB');
      expect(formatFileSize(10 * 1024 * 1024)).toBe('10 MB');
    });
  });

  describe('validateFile', () => {
    it('应该验证通过有效的文件', () => {
      const mockFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
      Object.defineProperty(mockFile, 'size', { value: 1024 });

      const result = validateFile(mockFile);
      expect(result.valid).toBe(true);
      expect(result.mimeType).toBe('image/jpeg');
    });

    it('应该拒绝不允许的文件类型', () => {
      const mockFile = new File(['content'], 'test.exe', { type: 'application/x-msdownload' });

      const result = validateFile(mockFile);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('File type');
    });
  });

  describe('ALLOWED_FILE_TYPES', () => {
    it('应该包含图片类型', () => {
      expect(ALLOWED_FILE_TYPES).toContain('image/jpeg');
      expect(ALLOWED_FILE_TYPES).toContain('image/png');
    });

    it('应该包含文档类型', () => {
      expect(ALLOWED_FILE_TYPES).toContain('application/pdf');
      expect(ALLOWED_FILE_TYPES).toContain('text/markdown');
    });
  });
});
