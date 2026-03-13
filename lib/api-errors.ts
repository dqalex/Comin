/**
 * API 错误消息常量
 * 支持国际化，避免硬编码
 */

export const API_ERRORS = {
  // 通用错误
  NOT_FOUND: 'errors.notFound',
  INVALID_INPUT: 'errors.invalidInput',
  UNAUTHORIZED: 'errors.unauthorized',
  FORBIDDEN: 'errors.forbidden',
  INTERNAL_ERROR: 'errors.internalError',
  
  // 资源特定错误
  TASK_NOT_FOUND: 'errors.taskNotFound',
  MEMBER_NOT_FOUND: 'errors.memberNotFound',
  PROJECT_NOT_FOUND: 'errors.projectNotFound',
  DOCUMENT_NOT_FOUND: 'errors.documentNotFound',
  DELIVERY_NOT_FOUND: 'errors.deliveryNotFound',
  
  // 验证错误
  TITLE_REQUIRED: 'errors.titleRequired',
  MEMBER_ID_REQUIRED: 'errors.memberIdRequired',
  PLATFORM_REQUIRED: 'errors.platformRequired',
  INVALID_STATUS: 'errors.invalidStatus',
  INVALID_PRIORITY: 'errors.invalidPriority',
  INVALID_PLATFORM: 'errors.invalidPlatform',
  
  // 操作错误
  CREATE_FAILED: 'errors.createFailed',
  UPDATE_FAILED: 'errors.updateFailed',
  DELETE_FAILED: 'errors.deleteFailed',
  FETCH_FAILED: 'errors.fetchFailed',
  
  // 特定业务错误
  LOCAL_DOC_REQUIRES_DOC_ID: 'errors.localDocRequiresDocId',
  EXTERNAL_DOC_REQUIRES_URL: 'errors.externalDocRequiresUrl',
  WORKSPACE_NOT_FOUND: 'errors.workspaceNotFound',
  WORKSPACE_PATH_NOT_EXIST: 'errors.workspacePathNotExist',
  SYNC_FAILED: 'errors.syncFailed',
} as const;

export type ApiErrorKey = typeof API_ERRORS[keyof typeof API_ERRORS];

/**
 * 创建错误响应
 */
export function createErrorResponse(errorKey: ApiErrorKey, status: number = 400): { error: ApiErrorKey } {
  return { error: errorKey };
}
