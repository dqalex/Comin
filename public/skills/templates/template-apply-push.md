# 套模板任务推送

## 任务信息
- **任务ID**: {{task_id}}
- **任务标题**: {{task_title}}
- **创建时间**: {{timestamp}}

## 任务类型
**套模板生成文档**

## 源文档信息
- **文档ID**: {{source_doc_id}}
- **文档标题**: {{source_doc_title}}
- **项目**: {{project_name}}

## 模板信息
- **模板ID**: {{template_id}}
- **模板名称**: {{template_name}}

## 执行要求

请根据源文档内容，使用指定模板创建新的 Wiki 文档。

### 步骤：

1. **读取源文档**
   - 使用 MCP 工具 `get_document(document_id="{{source_doc_id}}")` 获取源文档内容
   - 分析文档的主题、结构和关键信息

2. **获取模板信息**
   - 模板 ID: `{{template_id}}`
   - 模板已关联到项目，请在项目 `{{project_name}}` 下创建新文档

3. **创建新文档**
   - 使用 `create_document` 工具创建文档
   - 设置参数：
     - `title`: 基于源文档内容生成合适的标题
     - `content`: 根据 Markdown 模板格式，将源文档内容适配到模板中
     - `project_id`: `{{project_id}}`
     - `render_mode`: `visual`
     - `render_template_id`: `{{template_id}}`

4. **内容适配指南**
   - 将源文档的关键内容提取出来
   - 按照模板的 slot 结构组织内容
   - 确保内容风格与模板设计意图匹配
   - 如果模板有特定的 slot（如 title、headline、featureCards 等），请将内容分配到对应的 slot

5. **完成确认**
   - 创建完成后，告知用户新文档的标题和 ID
   - 简要说明文档内容的组织方式

## 注意事项
- 保持源文档的核心信息和语义不变
- 内容组织要符合模板的设计意图
- 新文档应自动关联到当前项目
- 如有不确定的内容适配方式，可以询问用户

---
*此任务由用户从 Wiki 文档发起，请帮助用户完成套模板生成新文档的工作。*
