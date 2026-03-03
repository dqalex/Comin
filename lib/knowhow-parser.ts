/**
 * Know-how 知识库分层解析器
 * 
 * 解析格式规范（§6.3）：
 * - L1 核心规则（~200 tokens，每次必读）
 * - L2 详细标准（~500 tokens，分析阶段按需读取）
 * - L3 案例库（~300 tokens/案例，建议阶段读取）
 * - L4 经验记录（动态增长，复核阶段读+写）
 * - L5 维护日志
 * 
 * 通过 Markdown 的 ## L1/L2/... 标题分层
 */

// 知识库层级定义
export type KnowHowLayer = 'L1' | 'L2' | 'L3' | 'L4' | 'L5';

// 解析后的分层结构
export interface KnowHowParsed {
  title: string;                                // 文档标题
  layers: Record<KnowHowLayer, string>;         // 各层级内容
  metadata: {
    totalTokenEstimate: number;                  // 总 token 估算
    layerTokenEstimates: Record<KnowHowLayer, number>;
    l4EntryCount: number;                        // L4 经验条目数
    l3CaseCount: number;                         // L3 案例数
    lastUpdated?: string;                        // L5 最后更新日期
  };
}

// 层级标题匹配模式
const LAYER_PATTERNS: Record<KnowHowLayer, RegExp> = {
  L1: /^##\s+L1\b/,
  L2: /^##\s+L2\b/,
  L3: /^##\s+L3\b/,
  L4: /^##\s+L4\b/,
  L5: /^##\s+L5\b/,
};

const ALL_LAYERS: KnowHowLayer[] = ['L1', 'L2', 'L3', 'L4', 'L5'];

/**
 * 粗略估算 token 数（中文约 0.6 token/字，英文约 0.25 token/word）
 */
function estimateTokens(text: string): number {
  if (!text.trim()) return 0;
  // 简单估算：中文字符数 * 0.6 + 英文单词数 * 1.3
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const englishWords = text.replace(/[\u4e00-\u9fff]/g, '').split(/\s+/).filter(w => w.length > 0).length;
  return Math.round(chineseChars * 0.6 + englishWords * 1.3);
}

/**
 * 统计 L4 经验条目数（以 `- [` 开头的行）
 */
function countL4Entries(content: string): number {
  return (content.match(/^- \[/gm) || []).length;
}

/**
 * 统计 L3 案例数（以 `### 案例` 开头的标题）
 */
function countL3Cases(content: string): number {
  return (content.match(/^###\s+案例/gm) || []).length;
}

/**
 * 从 L5 提取最后更新日期
 */
function extractLastUpdated(content: string): string | undefined {
  const match = content.match(/上次清理[：:]\s*(\d{4}-\d{2}-\d{2})/);
  return match?.[1];
}

/**
 * 解析 Know-how 文档为分层结构
 */
export function parseKnowHow(markdown: string): KnowHowParsed {
  const lines = markdown.split('\n');

  // 提取标题（第一个 # 标题）
  let title = 'Know-how';
  for (const line of lines) {
    if (line.startsWith('# ') && !line.startsWith('## ')) {
      title = line.replace(/^#\s+/, '').trim();
      break;
    }
  }

  // 分层切割
  const layerContent: Record<KnowHowLayer, string[]> = {
    L1: [], L2: [], L3: [], L4: [], L5: [],
  };

  let currentLayer: KnowHowLayer | null = null;

  for (const line of lines) {
    // 检查是否是新层级标题
    let matched = false;
    for (const layer of ALL_LAYERS) {
      if (LAYER_PATTERNS[layer].test(line)) {
        currentLayer = layer;
        matched = true;
        break;
      }
    }

    // 如果匹配到新层级标题行本身不纳入内容
    if (matched) continue;

    // 如果遇到非层级的 ## 标题且已在某层级内，说明该层级结束
    // （实际上不会出现，因为层级是连续的 L1-L5）

    if (currentLayer) {
      layerContent[currentLayer].push(line);
    }
  }

  // 构建结果
  const layers: Record<KnowHowLayer, string> = {
    L1: layerContent.L1.join('\n').trim(),
    L2: layerContent.L2.join('\n').trim(),
    L3: layerContent.L3.join('\n').trim(),
    L4: layerContent.L4.join('\n').trim(),
    L5: layerContent.L5.join('\n').trim(),
  };

  const layerTokenEstimates: Record<KnowHowLayer, number> = {
    L1: estimateTokens(layers.L1),
    L2: estimateTokens(layers.L2),
    L3: estimateTokens(layers.L3),
    L4: estimateTokens(layers.L4),
    L5: estimateTokens(layers.L5),
  };

  return {
    title,
    layers,
    metadata: {
      totalTokenEstimate: Object.values(layerTokenEstimates).reduce((a, b) => a + b, 0),
      layerTokenEstimates,
      l4EntryCount: countL4Entries(layers.L4),
      l3CaseCount: countL3Cases(layers.L3),
      lastUpdated: extractLastUpdated(layers.L5),
    },
  };
}

/**
 * 按指定层级提取内容（用于 SOP 阶段注入）
 * 
 * @param parsed - 解析后的 Know-how 结构
 * @param requestedLayers - 需要读取的层级列表，如 ['L1', 'L2']
 * @returns 拼接后的知识库内容文本
 */
export function extractLayers(parsed: KnowHowParsed, requestedLayers: KnowHowLayer[]): string {
  const sections: string[] = [];
  let totalTokens = 0;

  for (const layer of requestedLayers) {
    const content = parsed.layers[layer];
    if (content) {
      sections.push(`## ${layer} ${getLayerLabel(layer)}\n\n${content}`);
      totalTokens += parsed.metadata.layerTokenEstimates[layer];
    }
  }

  if (sections.length === 0) return '';

  return `# ${parsed.title}（知识库摘要，~${totalTokens} tokens）\n\n${sections.join('\n\n')}`;
}

/**
 * 获取层级标签
 */
function getLayerLabel(layer: KnowHowLayer): string {
  const labels: Record<KnowHowLayer, string> = {
    L1: '核心规则',
    L2: '详细标准',
    L3: '案例库',
    L4: '经验记录',
    L5: '维护日志',
  };
  return labels[layer];
}

/**
 * 向 L4 追加经验条目
 * 
 * @param markdown - 原始 Know-how 文档内容
 * @param entry - 新增的经验文本
 * @returns 更新后的完整文档内容
 */
export function appendToL4(markdown: string, entry: string): string {
  const date = new Date().toISOString().split('T')[0];
  const newEntry = `- [${date}] ${entry}`;

  const lines = markdown.split('\n');
  let l4Start = -1;
  let l5Start = -1;

  for (let i = 0; i < lines.length; i++) {
    if (LAYER_PATTERNS.L4.test(lines[i]) && l4Start === -1) {
      l4Start = i;
    }
    if (LAYER_PATTERNS.L5.test(lines[i]) && l5Start === -1) {
      l5Start = i;
    }
  }

  // 没有 L4 区域，在 L5 之前或文档末尾创建
  if (l4Start === -1) {
    const insertPos = l5Start >= 0 ? l5Start : lines.length;
    lines.splice(insertPos, 0, '', '## L4 经验记录', newEntry, '');
    return lines.join('\n');
  }

  // 有 L4，在 L4 和 L5 之间追加（或 L4 末尾）
  const insertPos = l5Start >= 0 ? l5Start : lines.length;
  // 在 L5 开始之前（或文档末尾）的空行之前插入
  let actualInsertPos = insertPos;
  while (actualInsertPos > l4Start && lines[actualInsertPos - 1].trim() === '') {
    actualInsertPos--;
  }

  lines.splice(actualInsertPos, 0, newEntry);
  return lines.join('\n');
}

/**
 * 更新 L5 维护日志（案例数和经验条数自动统计）
 */
export function updateL5Stats(markdown: string): string {
  const parsed = parseKnowHow(markdown);
  const date = new Date().toISOString().split('T')[0];

  const newL5 = [
    `- 上次清理：${date}`,
    `- 案例数：${parsed.metadata.l3CaseCount}`,
    `- 经验条数：${parsed.metadata.l4EntryCount}`,
  ].join('\n');

  const lines = markdown.split('\n');
  let l5Start = -1;
  let l5End = lines.length;

  for (let i = 0; i < lines.length; i++) {
    if (LAYER_PATTERNS.L5.test(lines[i])) {
      l5Start = i;
      // 找 L5 结束位置（下一个 ## 或文档末尾）
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].startsWith('## ')) {
          l5End = j;
          break;
        }
      }
      break;
    }
  }

  if (l5Start === -1) {
    // 没有 L5，追加到末尾
    lines.push('', '## L5 维护日志', newL5);
  } else {
    // 替换 L5 内容
    const beforeL5 = lines.slice(0, l5Start + 1);
    const afterL5 = lines.slice(l5End);
    return [...beforeL5, newL5, ...afterL5].join('\n');
  }

  return lines.join('\n');
}
