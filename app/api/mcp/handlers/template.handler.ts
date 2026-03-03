/**
 * 模板库 MCP Handler
 */

import { renderTemplateWithContext, listTemplates } from '@/lib/template-engine';

export async function handleGetTemplate(params: Record<string, unknown>): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const { template_name, ...extraParams } = params as { template_name: string; [key: string]: unknown };
  
  if (!template_name) {
    return { success: false, error: '缺少 template_name 参数' };
  }

  const rendered = await renderTemplateWithContext(template_name, extraParams);
  if (!rendered) {
    return { success: false, error: `模板 "${template_name}" 不存在` };
  }

  return { 
    success: true, 
    data: { 
      template_name, 
      content: rendered,
      message: `模板 "${template_name}" 已渲染` 
    } 
  };
}

export async function handleListTemplates(): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const templates = listTemplates();
  return { 
    success: true, 
    data: { 
      templates, 
      message: `共 ${templates.length} 个可用模板` 
    } 
  };
}
