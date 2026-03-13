/**
 * 版本号统一管理
 * 
 * 所有版本号都从 package.json 读取，避免硬编码
 * 
 * 使用方式：
 * - 前端组件：import { APP_VERSION } from '@/lib/version'
 * - 后端 API：import { APP_VERSION } from '@/lib/version'
 * - Gateway 客户端：import { APP_VERSION, APP_NAME } from '@/lib/version'
 */

import { readFileSync } from 'fs';
import { join } from 'path';

// 从 package.json 读取版本号（构建时确定）
// 注意：前端组件也可以用 process.env.NEXT_PUBLIC_APP_VERSION（通过 next.config.js 注入）
const packageJsonPath = join(process.cwd(), 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

/** 应用版本号 */
export const APP_VERSION: string = packageJson.version;

/** 应用名称 */
export const APP_NAME = 'teamclaw';

/** 完整应用标识（用于 User-Agent 等） */
export const APP_IDENTIFIER = `${APP_NAME}-v${APP_VERSION.split('.')[0]}`;

/** 用于显示的版本标题 */
export const APP_VERSION_DISPLAY = `TeamClaw v${APP_VERSION}`;
