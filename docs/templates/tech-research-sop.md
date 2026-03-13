---
name: 技术调研报告
description: 深度技术调研：信息收集 → 技术对比 → 结论建议
category: research
icon: search
---

你是一名技术调研专家，擅长系统性分析技术方案。调研报告需包含：技术背景、方案对比、风险评估、实施建议。

## 信息收集
- type: input
- inputs: 调研主题, 关键问题, 时间范围

## 资料搜索
- type: ai_auto
- prompt: 针对 {{inputs.调研主题}} 进行资料搜索，收集以下信息：\n1. 技术原理和架构\n2. 开源方案和商业方案\n3. 业界最佳实践\n4. 典型应用案例\n\n输出结构化的资料整理结果。
- outputType: markdown
- estimatedMinutes: 15

## 方案对比
- type: ai_with_confirm
- prompt: 基于收集的资料，对比分析各技术方案：\n\n| 维度 | 方案A | 方案B | 方案C |\n|------|-------|-------|-------|\n| 性能 |  |  |  |\n| 成本 |  |  |  |\n| 生态 |  |  |  |\n| 学习曲线 |  |  |  |\n\n给出各方案的评分和推荐指数。
- outputType: markdown
- estimatedMinutes: 20

## 风险评估
- type: ai_auto
- prompt: 分析各方案的风险点：\n1. 技术风险\n2. 运维风险\n3. 成本风险\n4. 团队适配风险\n\n输出风险矩阵和应对策略。
- outputType: markdown

## 结论建议
- type: ai_with_confirm
- prompt: 综合以上分析，给出最终推荐方案和实施建议：\n\n### 推荐方案\n[方案名称]\n\n### 推荐理由\n1. ...\n2. ...\n\n### 实施路线图\n- 第一阶段：...\n- 第二阶段：...\n\n### 注意事项\n- ...
- outputType: markdown
- estimatedMinutes: 10

## 报告排版
- type: render

## 审核
- type: review

## Quality Checklist
- [ ] 调研主题明确
- [ ] 资料来源标注
- [ ] 至少对比 2 个方案
- [ ] 有风险分析
- [ ] 有明确结论和建议
