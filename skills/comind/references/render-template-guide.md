# 渲染模板制作规范

> 本文档定义 TeamClaw Content Studio 渲染模板的设计原则、制作流程和技术规范。
> 面向 AI Agent 和人类开发者。

---

## 1. 核心理念：MD 优先设计

### 1.1 为什么 MD 优先

TeamClaw 的渲染模板采用 **MD ↔ HTML 双向同步** 架构。用户编辑 MD，系统自动同步到 HTML 可视化模板。因此：

- **MD 端是内容编辑的主要入口**，必须保证 MD 的可读性和易编辑性
- **HTML 端是最终呈现**，负责排版和视觉效果
- **两端必须一致**：同一内容在 MD 预览和 HTML 模板中应有相似的结构和语义

### 1.2 设计原则

| 原则 | 说明 |
|------|------|
| 能用 MD 表达就不用纯 HTML | 标题、列表、表格、引用、分隔线等一律用 MD 语法 |
| HTML 只负责布局和装饰 | 容器结构、Grid 网格、颜色渐变、阴影等视觉效果用 HTML+CSS |
| slot 内容 = MD 内容 | `data-slot-type="content"` 的 slot 内容全部通过 `simpleMdToHtml()` 渲染 |
| CSS 继承 MD 样式 | 模板自定义 CSS 应与 `MD_RICHTEXT_STYLES` 保持风格一致 |

---

## 2. 系统架构速览

```
用户编辑 MD（含 <!-- @slot:xxx --> 标记）
        │
        ▼
  extractSlotsFromMd()  ── 提取 slot 值 ──►  Map<name, value>
                                                    │
                                                    ▼
                                       injectSlotsToHtml()
                              (simpleMdToHtml + DOMPurify + MD_RICHTEXT_STYLES)
                                                    │
                                                    ▼
                                   HTML 模板预览（iframe srcdoc）
```

**关键文件**：

| 文件 | 职责 |
|------|------|
| `lib/slot-sync.ts` | MD↔HTML 双向同步引擎、simpleMdToHtml 渲染器 |
| `db/builtin-templates.ts` | 4 个内置渲染模板 seed 数据 |
| `db/schema.ts` | `render_templates` 表 + `SlotDef` / `SectionDef` 类型 |
| `store/render-template.store.ts` | 模板 CRUD Store |
| `components/studio/HtmlPreview.tsx` | iframe 可视化预览编辑组件 |

---

## 3. 模板三要素

一个渲染模板由三部分组成：

### 3.1 HTML 模板（`htmlTemplate`）

定义布局骨架和 slot 占位。**不包含内容文本**，内容由 MD 注入。

```html
<div class="my-template">
  <header>
    <div data-slot="title" data-slot-type="content"></div>
  </header>
  <section>
    <div data-slot="body" data-slot-type="content"></div>
  </section>
</div>
```

### 3.2 CSS 模板（`cssTemplate`）

定义视觉样式。作用于 HTML 结构和 slot 内部的 MD 渲染产物。

```css
.my-template {
  max-width: 800px; margin: 0 auto; padding: 48px;
  font-family: 'PingFang SC', sans-serif;
}
/* slot 内 MD 渲染产物的样式覆盖 */
[data-slot="title"] h1 {
  font-size: 28px; color: #1a1a2e;
}
```

### 3.3 MD 模板（`mdTemplate`）

定义默认内容骨架。**这是用户直接编辑的内容**。

```markdown
<!-- @slot:title -->
# 报告标题

<!-- @slot:body -->
## 正文

正文内容...
```

---

## 4. Slot（槽位）规范

### 4.1 Slot 类型

| 类型 | 用途 | 注入方式 | MD 写法 |
|------|------|----------|---------|
| `content` | 富文本内容（标题/列表/表格等） | `simpleMdToHtml()` → `innerHTML` | 完整 MD 语法 |
| `text` | 文本（统一走 MD 渲染） | 同 `content` | 同 `content` |
| `richtext` | 向后兼容，等同 `content` | 同 `content` | 同 `content` |
| `data` | 纯数值或短文本 | `textContent` 直接赋值 | 单行纯文本 |
| `image` | 图片 URL | `<img src="...">` | 图片 URL |

### 4.2 MD 端 Slot 标记

```markdown
<!-- @slot:slotName -->
Markdown 内容...
<!-- @/slot -->
```

- `<!-- @slot:name -->` 开启一个 slot
- `<!-- @/slot -->` 关闭（可选，到下一个 `@slot` 或文档末尾自动关闭）
- slot 名称必须与 `htmlTemplate` 中 `data-slot="name"` 一致

#### 循环区域渲染（推荐用于重复结构）

对于需要重复多次的结构（如列表项、卡片组、章节等），使用 `data-slot-loop` 标记循环区域，HTML 只需定义一份模板，系统自动根据 MD 数据重复渲染。

**HTML 模板：**
```html
<div class="card-list" data-slot-loop="card" data-slot-loop-items="title,content,image">
  <div class="card">
    <h3 data-slot="title" data-slot-type="content"></h3>
    <p data-slot="content" data-slot-type="content"></p>
    <img data-slot="image" data-slot-type="image" />
  </div>
</div>
```

- `data-slot-loop="card"`：标记这是一个名为 "card" 的循环区域
- `data-slot-loop-items="title,content,image"`：声明循环项包含的 slot 名称列表

**MD 模板：**
```markdown
<!-- @slot:title -->
卡片标题 1

<!-- @slot:content -->
卡片内容 1

<!-- @slot:image -->
https://example.com/img1.jpg

<!-- @slot:title -->
卡片标题 2

<!-- @slot:content -->
卡片内容 2

<!-- @slot:image -->
https://example.com/img2.jpg

<!-- @slot:title -->
卡片标题 3

<!-- @slot:content -->
卡片内容 3

<!-- @slot:image -->
https://example.com/img3.jpg
```

**渲染过程：**
1. 系统检测到 `data-slot-loop` 标记
2. 根据 `data-slot-loop-items` 找到第一个 slot（这里是 `title`）
3. 统计 MD 中 `title` 出现的次数（3次），确定需要循环 3 次
4. 复制 HTML 模板 2 次（共 3 个卡片结构）
5. 按顺序将 MD 中的 slot 值填充到对应的 HTML 结构中

**渲染结果：** 3 个卡片，每个卡片包含对应的标题、内容和图片。

> **优点**：HTML 结构只需写一次，MD 端按顺序提供数据，系统自动处理重复渲染。

#### 简单的一对多填充（无循环标记时）

如果 HTML 中没有 `data-slot-loop` 标记，但 MD 中某个 slot 出现了多次，系统会按 DOM 顺序依次填充到所有同名的 slot 元素中。

**示例：**

HTML 模板：
```html
<div class="template">
  <section data-slot="section" data-slot-type="content"></section>
  <section data-slot="section" data-slot-type="content"></section>
</div>
```

MD 模板：
```markdown
<!-- @slot:section -->
## 第一章内容

<!-- @slot:section -->
## 第二章内容
```

渲染结果：两个 `section` slot 分别填入第一章和第二章内容。

### 4.3 HTML 端 Slot 标记

```html
<div data-slot="slotName" data-slot-type="content"></div>
```

- `data-slot`：slot 名称
- `data-slot-type`：slot 类型（决定注入方式）

### 4.4 Slot 命名规范

| 规则 | 示例 |
|------|------|
| camelCase | `title`, `body`, `nextPlan` |
| 语义化 | `achievements`（非 `slot1`） |
| 不超过 20 字符 | `metric1Value` |

---

## 5. simpleMdToHtml 支持的语法

以下是 `simpleMdToHtml()` 能渲染的全部 MD 语法，**模板 MD 内容应优先使用这些语法**：

### 5.1 块级语法

| 语法 | 说明 | 示例 |
|------|------|------|
| `# ~ ######` | 标题 h1-h6 | `## 二级标题` |
| `- item` / `* item` | 无序列表 | `- 条目一` |
| `1. item` | 有序列表 | `1. 第一步` |
| `- [x]` / `- [ ]` | 任务列表 | `- [x] 已完成` |
| `> text` | 引用块 | `> 重要提示` |
| `---` / `***` / `___` | 水平分隔线 | `---` |
| ` ``` ` | 代码块 | 围栏代码块 |
| ` ```flow ` | 流程图 | 节点 + ▼ 箭头，渲染为可视化流程 |
| ` ```compare ` | 对比框 | ┌┘ 盒子结构，渲染为左右对比卡片 |
| ` ```steps ` | 步骤图 | ① ② ③ 编号步骤，渲染为横向步骤条 |
| `\| col \| col \|` | 表格 | GFM 表格语法 |

### 5.2 内联语法

| 语法 | 渲染结果 | 示例 |
|------|----------|------|
| `**text**` / `__text__` | **加粗** | `**重点**` |
| `*text*` / `_text_` | *斜体* | `*注释*` |
| `~~text~~` | ~~删除线~~ | `~~已废弃~~` |
| `==text==` | 高亮 | `==关键词==` |
| `` `code` `` | 内联代码 | `` `variable` `` |
| `[text](url)` | 链接 | `[官网](https://...)` |
| `![alt](url)` | 图片 | `![logo](https://...)` |
| 裸 URL | 自动链接 | `https://example.com` |
| `:lucide:name:` | Lucide 图标 | `:lucide:check-square:` |

#### 图标语法

TeamClaw 内置 Lucide 图标库支持，使用 `:lucide:名称:` 语法在 Markdown 中插入图标：

```markdown
- ## :lucide:check-square: 任务看板
  四列看板支持拖拽排序...
  
- ## :lucide:file-text: 知识库
  Markdown 文档协作...
```

**可用图标列表**（部分）：

| 分类 | 图标名称 |
|------|----------|
| 通用 | `check-square`, `file-text`, `wrench`, `clipboard-list`, `users`, `bot` |
| 通讯 | `send`, `message-square`, `message-circle`, `mail`, `phone` |
| 时间 | `clock`, `calendar`, `timer`, `history` |
| 状态 | `check-circle`, `x-circle`, `alert-circle`, `info`, `help-circle` |
| 操作 | `edit`, `trash-2`, `save`, `download`, `upload`, `copy`, `share-2` |
| 导航 | `arrow-right`, `arrow-left`, `chevron-right`, `chevron-down` |
| 设备 | `monitor`, `smartphone`, `tablet`, `server`, `database` |
| AI | `brain`, `sparkles`, `wand-2`, `bot`, `cpu` |
| 财务 | `dollar-sign`, `trending-up`, `trending-down`, `bar-chart`, `pie-chart` |

> 完整图标列表请参考 [Lucide 官网](https://lucide.dev/icons/)，在模板中只使用已内置的图标（见 `lib/icon-render.ts` 中的 `iconMap`）。

### 5.3 不支持的语法（请勿在模板中使用）

- 嵌套列表（多级缩进）
- 脚注 `[^1]`
- 定义列表
- LaTeX 数学公式
- HTML 标签（会被 DOMPurify 清洗）

### 5.4 语义代码块（流程图 / 对比框 / 步骤图）

通过特殊语言标识符，代码块可以渲染为可视化图表而非 `<pre><code>`：

#### ` ```flow ` — 流程图

节点按垂直方向排列，`▼` / `→` / `│` 等字符行渲染为箭头，`┌└` 盒子结构渲染为卡片：

```markdown
` ```flow `
用户请求到达
  ▼
API 网关转发
  ▼
┌──────────────────────┐
│  缓存命中？           │
│  ✅ 命中 → 直接返回   │
│  ❌ 未命中 → 查数据库  │
└──────────────────────┘
  ▼
返回结果
` ``` `
```

- 普通行 = 流程节点（圆角卡片）
- `▼` / `→` / `│` / `->` 开头的行 = 连接箭头
- `┌...└` 包裹的行 = 盒子节点（合并为一张卡片）
- `✅` / `❌` / `⚠️` 开头的行 = 带状态色的节点

#### ` ```compare ` — 对比框

两组 `┌└` 盒子自动渲染为左右对比卡片：

```markdown
` ```compare `
┌──────────────────────┐
│  方案 A               │
│  ✅ 优势一            │
│  ✅ 优势二            │
│  ❌ 劣势一            │
└──────────────────────┘
┌──────────────────────┐
│  方案 B               │
│  ✅ 优势一            │
│  ❌ 劣势一            │
│  ❌ 劣势二            │
└──────────────────────┘
` ``` `
```

- 每个 `┌└` 盒子 = 一栏对比列
- 盒子第一行 = 栏标题
- `✅` / `❌` 行自动加绿/红背景色

#### ` ```steps ` — 步骤图

横向排列的编号步骤，用箭头连接：

```markdown
` ```steps `
① 需求分析
  ▼
② 方案设计
  ▼
③ 开发实现
  ▼
④ 测试验证
` ``` `
```

- `① ② ③...` 或 `1. 2. 3.` 开头 = 步骤节点
- `▼` / `→` 行 = 步骤间连接（自动渲染为 → 箭头）
- 编号后的非步骤行 = 步骤描述文字

#### CSS 类名参考

| 类名 | 元素 |
|------|------|
| `.sd-flow` | 流程图容器 |
| `.sd-flow-node` | 流程节点 |
| `.sd-flow-box` | 盒子节点 |
| `.sd-flow-arrow` | 连接箭头 |
| `.sd-compare` | 对比框容器（grid） |
| `.sd-compare-col` | 对比列 |
| `.sd-compare-title` | 列标题 |
| `.sd-compare-item` | 列条目 |
| `.sd-steps` | 步骤图容器（flex） |
| `.sd-step` | 步骤节点 |
| `.sd-step-num` | 步骤编号圆圈 |
| `.sd-step-label` | 步骤标签 |
| `.sd-step-arrow` | 步骤连接箭头 |
| `.sd-status-success` | 绿色状态 |
| `.sd-status-error` | 红色状态 |
| `.sd-status-warn` | 黄色状态 |

---

## 6. CSS 编写规范

### 6.1 基本原则

1. **模板自定义 CSS 只关注布局和装饰**，MD 内容的基础排版由 `MD_RICHTEXT_STYLES` 自动注入
2. **通过 slot 选择器精确覆盖**，不要用全局选择器
3. **避免 `!important`**，利用选择器优先级

### 6.2 选择器优先级

```css
/* ✅ 正确：通过 data-slot 精确定位 */
[data-slot="title"] h1 {
  font-size: 28px; color: #4f46e5;
}

/* ✅ 正确：容器 class 限定范围 */
.my-template .report-header {
  border-bottom: 3px solid #4f46e5;
}

/* ❌ 错误：全局选择器会影响其他模板 */
h1 { font-size: 28px; }
```

### 6.3 MD_RICHTEXT_STYLES 已覆盖的标签

以下标签已有基础样式，模板 CSS 只需覆盖差异化部分：

`h1-h6`、`ul/ol/li`、`blockquote`、`hr`、`code`、`pre`、`table/th/td`、`p`、`a`、`del`、`strong`、`em`、`mark`、`img`、`input[type=checkbox]`

### 6.4 常用布局模式

```css
/* 统计卡片 Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

/* 指标卡片 */
.metric-card {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 12px;
  padding: 24px;
  text-align: center;
}
```

### 6.5 字体规范

统一使用以下字体栈：

```css
font-family: 'PingFang SC', 'Helvetica Neue', 'Microsoft YaHei', sans-serif;
```

---

## 7. 模板定义结构

### 7.1 SlotDef

```typescript
type SlotDef = {
  label: string;          // 显示名称（中文）
  type: 'content' | 'image' | 'data' | 'text' | 'richtext';
  description?: string;   // 用途说明
  placeholder?: string;   // 默认占位内容
};
```

### 7.2 SectionDef

```typescript
type SectionDef = {
  id: string;             // 区块 ID
  label: string;          // 显示名称
  slots: string[];        // 包含的 slot 名称列表
};
```

### 7.3 ExportPreset

```typescript
type ExportPreset = {
  formats: ('jpg' | 'png' | 'html' | 'pdf')[];
  defaultWidth?: number;  // 渲染宽度 px
  defaultScale?: number;  // 导出缩放倍数
  mode?: '16:9' | 'long' | 'a4' | 'custom';
};
```

---

## 8. 模板分类

| 分类 | 适用场景 | 典型宽度 | 导出格式 |
|------|----------|----------|----------|
| `report` | 调研报告、周报月报 | 800px | jpg, html |
| `card` | 社交媒体分享卡片 | 640px | jpg, png |
| `poster` | 数据海报、信息图 | 720px | jpg, png, html |
| `presentation` | 演示幻灯片 | 1280px (16:9) | jpg, html |
| `custom` | 自定义 | 自定义 | 自定义 |

---

## 9. 完整示例：从零创建模板

以 **「简约报告卡片」** 为例，演示 MD 优先的设计流程。

### Step 1：规划 Slot 结构

```
header:  title（标题）、subtitle（副标题）
content: summary（核心发现）、body（详细分析）、conclusion（建议）
footer:  footer（页脚）
```

### Step 2：先写 MD 模板

**关键：先用 MD 写出理想的内容结构，确认 MD 预览排版满意后，再设计 HTML 布局。**

```markdown
<!-- @slot:title -->
# 报告标题

<!-- @slot:subtitle -->
报告日期

<!-- @slot:summary -->
## 核心发现

- **核心发现一**：关键数据或趋势描述
- **核心发现二**：重要变化或异常分析
- **核心发现三**：业务影响和量化结论

<!-- @slot:body -->
## 详细分析

### 背景与方法

简要说明分析的背景、数据来源和方法论。

### 数据分析

| 指标 | 本期 | 上期 | 变化 |
| --- | --- | --- | --- |
| 指标A | 100 | 80 | +25% |
| 指标B | 50 | 60 | -17% |

> 注：以上数据来源于系统统计，时间范围为本报告周期。

### 深度解读

1. **趋势一**：对数据变化的深层解读
2. **趋势二**：关联因素分析
3. **趋势三**：与行业基准的对比

<!-- @slot:conclusion -->
## 建议与行动

### 建议

- **短期行动**：立即可执行的改进措施
- **中期规划**：需要资源投入的优化方案
- **长期策略**：战略层面的方向建议

---

*下一步*：明确责任人和时间节点，跟踪执行进展。

<!-- @slot:footer -->
由 TeamClaw 生成
```

注意 MD 模板中如何利用 MD 语法构建设计：

- `#` 标题 → 报告大标题
- `##` 子标题 → 章节标题
- `###` 三级标题 → 子章节
- `- **加粗**：描述` → 结构化要点
- `| 表格 |` → 数据展示
- `> 引用` → 注释说明
- `---` → 章节分隔
- `*斜体*` → 备注强调
- `1. 有序列表` → 排序要点

### Step 3：设计 HTML 骨架

HTML 只负责外层容器布局，内容区域全部用 `data-slot` 占位：

```html
<div class="report-card">
  <header class="report-header">
    <div data-slot="title" data-slot-type="content"></div>
    <div data-slot="subtitle" data-slot-type="content"></div>
  </header>
  <section class="report-section">
    <div data-slot="summary" data-slot-type="content"></div>
  </section>
  <section class="report-section">
    <div data-slot="body" data-slot-type="content"></div>
  </section>
  <section class="report-section">
    <div data-slot="conclusion" data-slot-type="content"></div>
  </section>
  <footer class="report-footer">
    <div data-slot="footer" data-slot-type="content"></div>
  </footer>
</div>
```

### Step 4：编写 CSS

```css
.report-card {
  max-width: 800px; margin: 0 auto; padding: 48px;
  font-family: 'PingFang SC', 'Helvetica Neue', sans-serif;
  color: #1a1a2e; background: #fff;
}
.report-header {
  margin-bottom: 40px;
  border-bottom: 3px solid #4f46e5;
  padding-bottom: 24px;
}
/* slot 内 MD 渲染的 h1 样式覆盖 */
[data-slot="title"] h1 {
  font-size: 28px; font-weight: 700; margin: 0 0 8px;
}
[data-slot="subtitle"] p {
  font-size: 16px; color: #64748b; margin: 0;
}
.report-section { margin-bottom: 32px; }
/* 所有 content slot 的 h2 统一样式 */
[data-slot="summary"] h2,
[data-slot="body"] h2,
[data-slot="conclusion"] h2 {
  font-size: 20px; font-weight: 600; color: #4f46e5;
  margin: 0 0 16px; padding-bottom: 8px;
  border-bottom: 1px solid #e2e8f0;
}
.report-footer {
  margin-top: 40px; padding-top: 16px;
  border-top: 1px solid #e2e8f0;
  font-size: 12px; color: #94a3b8; text-align: center;
}
```

### Step 5：声明 Slot 和 Section 定义

```typescript
const slots: Record<string, SlotDef> = {
  title:      { label: '报告标题', type: 'content', placeholder: '# 输入报告标题' },
  subtitle:   { label: '副标题/日期', type: 'content', placeholder: '输入副标题或报告日期' },
  summary:    { label: '核心发现', type: 'content', placeholder: '## 核心发现\n\n输入核心发现内容' },
  body:       { label: '详细分析', type: 'content', placeholder: '## 详细分析\n\n输入详细分析内容' },
  conclusion: { label: '建议与行动', type: 'content', placeholder: '## 建议与行动\n\n输入结论和建议' },
  footer:     { label: '页脚', type: 'content', placeholder: '页脚文字' },
};

const sections: SectionDef[] = [
  { id: 'header', label: '标题区', slots: ['title', 'subtitle'] },
  { id: 'content', label: '内容区', slots: ['summary', 'body', 'conclusion'] },
  { id: 'footer', label: '页脚', slots: ['footer'] },
];
```

---

## 10. 数据 Slot 的使用

`data` 类型的 slot 用于展示数值指标，不经过 MD 渲染：

### MD 端

```markdown
<!-- @slot:completed -->
5
```

### HTML 端

```html
<div class="stat-card">
  <div data-slot="completed" data-slot-type="data" class="stat-value"></div>
  <div class="stat-label">已完成</div>
</div>
```

- `data` slot 的值直接设置为 `textContent`
- 标签文字（如 "已完成"）写在 HTML 中，不通过 slot
- 适用于数字、百分比、短文本（如日期）

---

## 11. MD 内容设计最佳实践

### 11.1 用 MD 标题构建视觉层级

```markdown
<!-- @slot:body -->
## 章节大标题

### 子标题一

内容段落...

### 子标题二

内容段落...
```

CSS 端对应覆盖：
```css
[data-slot="body"] h2 { font-size: 20px; color: #4f46e5; border-bottom: 1px solid #e2e8f0; }
[data-slot="body"] h3 { font-size: 16px; color: #1e293b; }
```

### 11.2 用列表构建结构化要点

```markdown
- **关键指标一**：具体数据和说明
- **关键指标二**：具体数据和说明
- **关键指标三**：具体数据和说明
```

### 11.3 用表格展示对比数据

```markdown
| 维度 | 方案A | 方案B | 结论 |
| --- | --- | --- | --- |
| 性能 | 快 | 慢 | A 胜 |
| 成本 | 高 | 低 | B 胜 |
```

### 11.4 用引用块突出提示

```markdown
> 重要提示：以上数据仅供参考，实际情况以最终审计报告为准。
```

### 11.5 用分隔线分隔章节

```markdown
---

*下一步*：明确责任人和时间节点。
```

### 11.6 用任务列表展示进度

```markdown
- [x] 数据收集完成
- [x] 初步分析完成
- [ ] 深度分析进行中
- [ ] 报告撰写待开始
```

### 11.7 用高亮强调关键词

```markdown
本季度 ==用户增长率 42%==，创历史新高。
```

---

## 12. AI 创建模板的约束

当 AI Agent 通过 MCP 工具创建渲染模板时，需遵循以下约束：

| 约束 | 说明 |
|------|------|
| HTML 结构简洁 | 避免深层嵌套（不超过 5 层） |
| 所有内容区用 slot | 不在 HTML 中硬编码文本内容 |
| 重复结构用循环 | 使用 `data-slot-loop` 标记重复区域，不写重复 HTML |
| CSS 不超过 3KB | 保持精简，复用 MD_RICHTEXT_STYLES |
| MD 模板必须有默认内容 | 每个 slot 都有有意义的占位文本 |
| slot 数量 3-12 个 | 太少无法覆盖内容，太多增加编辑复杂度 |
| Section 数量 2-6 个 | 逻辑分区清晰 |
| DOMPurify 兼容 | 不使用 `<script>`、`<style>`、事件属性 |

---

## 13. 检查清单

新建或修改模板时，逐项确认：

- [ ] MD 模板可独立阅读，结构清晰
- [ ] 所有 `content` 类型 slot 的 MD 内容使用了 `simpleMdToHtml` 支持的语法
- [ ] 未使用不支持的 MD 语法（嵌套列表、脚注、LaTeX 等）
- [ ] HTML 中所有需要动态内容的区域都标记了 `data-slot` + `data-slot-type`
- [ ] 重复结构使用 `data-slot-loop` + `data-slot-loop-items` 标记，不写重复 HTML
- [ ] MD 中的 `<!-- @slot:name -->` 与 HTML 中的 `data-slot="name"` 一一对应
- [ ] CSS 通过 `data-slot` 或容器 class 限定作用域
- [ ] `data` 类型 slot 在 MD 端只有单行纯文本
- [ ] `placeholder` 字段包含有意义的默认内容
- [ ] `sections` 按视觉区域正确分组了 `slots`
- [ ] `exportConfig` 的宽度和模式与模板设计一致

---

## 14. 常见问题

### Q: MD 预览和 HTML 模板的排版不一致怎么办？

A: MD 预览使用 ReactMarkdown + remarkGfm，HTML 模板使用 `simpleMdToHtml()`。两者对基础语法的渲染一致。如果发现差异：
1. 确认使用的语法在 `simpleMdToHtml` 支持列表中
2. 检查 CSS 是否覆盖了 `MD_RICHTEXT_STYLES` 的基础样式
3. 避免依赖 ReactMarkdown 的扩展语法（如脚注）

### Q: 如何在 `data` slot 中显示带格式的内容？

A: 不能。`data` slot 只支持纯文本。如果需要格式化，请改用 `content` 类型。

### Q: 一个 slot 可以跨多个 HTML 容器吗？

A: 不可以。一个 `data-slot` 名称只能出现在一个 HTML 元素上。如果需要在多处显示相同内容，需要用不同的 slot 名称。
