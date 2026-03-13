/**
 * 内置模板的类型定义
 */
import type { SOPStage, SlotDef, SectionDef } from '@/db/schema';

export interface BuiltinSopTemplate {
  id: string;
  name: string;
  description: string;
  category: 'content' | 'analysis' | 'research' | 'development' | 'operations' | 'media' | 'custom';
  icon: string;
  stages: SOPStage[];
  systemPrompt: string;
  qualityChecklist: string[];
}

export interface BuiltinRenderTemplate {
  id: string;
  name: string;
  description: string;
  category: 'report' | 'card' | 'poster' | 'presentation' | 'custom';
  htmlTemplate: string;
  cssTemplate: string;
  mdTemplate: string;
  slots: Record<string, SlotDef>;
  sections: SectionDef[];
  exportConfig: { formats: ('jpg' | 'png' | 'html' | 'pdf')[]; defaultWidth?: number; defaultScale?: number; mode?: '16:9' | 'long' | 'a4' | 'custom' };
}
