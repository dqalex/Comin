/**
 * 架构文档自动生成器 v2
 * 
 * 功能：
 * 1. 扫描项目结构，提取 API 路由、数据库 schema、组件关系
 * 2. 自动生成 Mermaid 图表
 * 3. 输出完整的架构文档 HTML（深色主题）
 * 
 * 使用：npx tsx scripts/generate-architecture-docs-v2.ts
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Types
// ============================================================================

interface ApiRoute {
  method: string;
  path: string;
  file: string;
}

interface DbTable {
  name: string;
  columns: { name: string; type: string; isPrimary?: boolean }[];
}

interface Component {
  name: string;
  path: string;
  imports: string[];
}

interface ProjectStats {
  files: number;
  typescript: number;
  react: number;
  apiRoutes: number;
  dbTables: number;
  components: number;
  stores: number;
}

// ============================================================================
// Project Scanner
// ============================================================================

class ProjectScanner {
  private root: string;

  constructor() {
    this.root = process.cwd();
  }

  scanApiRoutes(): ApiRoute[] {
    const routes: ApiRoute[] = [];
    const apiDir = path.join(this.root, 'app/api');

    const scanDir = (dir: string, basePath: string) => {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          scanDir(fullPath, basePath + '/' + entry.name);
        } else if (entry.name === 'route.ts') {
          const content = fs.readFileSync(fullPath, 'utf-8');
          const methods = this.extractHttpMethods(content);

          for (const method of methods) {
            routes.push({
              method,
              path: basePath || '/',
              file: fullPath.replace(this.root, ''),
            });
          }
        }
      }
    };

    scanDir(apiDir, '/api');
    return routes;
  }

  private extractHttpMethods(content: string): string[] {
    const methods: string[] = [];
    const methodPatterns: [RegExp, string][] = [
      [/export\s+async\s+function\s+GET\s*\(/, 'GET'],
      [/export\s+async\s+function\s+POST\s*\(/, 'POST'],
      [/export\s+async\s+function\s+PUT\s*\(/, 'PUT'],
      [/export\s+async\s+function\s+DELETE\s*\(/, 'DELETE'],
      [/export\s+async\s+function\s+PATCH\s*\(/, 'PATCH'],
    ];

    for (const [pattern, name] of methodPatterns) {
      if (pattern.test(content)) {
        methods.push(name);
      }
    }

    return methods.length > 0 ? methods : ['UNKNOWN'];
  }

  scanDbSchema(): DbTable[] {
    const schemaPath = path.join(this.root, 'db/schema.ts');
    const tables: DbTable[] = [];

    if (!fs.existsSync(schemaPath)) return tables;

    const content = fs.readFileSync(schemaPath, 'utf-8');
    const tableRegex = /(?:sqliteTable|pgTable)\s*\(\s*['"`](\w+)['"`]\s*,\s*\{([^}]+)\}/g;
    let match;

    while ((match = tableRegex.exec(content)) !== null) {
      const tableName = match[1];
      const columnsBlock = match[2];
      const columns = this.extractColumns(columnsBlock);
      tables.push({ name: tableName, columns });
    }

    return tables;
  }

  private extractColumns(block: string): { name: string; type: string; isPrimary?: boolean }[] {
    const columns: { name: string; type: string; isPrimary?: boolean }[] = [];
    const columnRegex = /(\w+)\s*:\s*(\w+)\s*\(\s*['"`](\w+)['"`]\s*\)(\.primaryKey\(\))?/g;
    let match;

    while ((match = columnRegex.exec(block)) !== null) {
      columns.push({
        name: match[3],
        type: match[2],
        isPrimary: !!match[4],
      });
    }

    return columns;
  }

  scanComponents(): Component[] {
    const components: Component[] = [];
    const componentsDir = path.join(this.root, 'components');

    const scanDir = (dir: string) => {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          scanDir(fullPath);
        } else if (entry.name.endsWith('.tsx') && !entry.name.startsWith('_')) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          const imports = this.extractImports(content);
          components.push({
            name: entry.name.replace('.tsx', ''),
            path: fullPath.replace(this.root, ''),
            imports,
          });
        }
      }
    };

    scanDir(componentsDir);
    return components;
  }

  private extractImports(content: string): string[] {
    const imports: string[] = [];
    const importRegex = /import\s+.*?from\s+['"`](@\/[^'"`]+)['"`]/g;
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }

    return imports;
  }

  scanStores(): string[] {
    const stores: string[] = [];
    const storeDir = path.join(this.root, 'store');

    if (!fs.existsSync(storeDir)) return stores;

    const entries = fs.readdirSync(storeDir);
    for (const entry of entries) {
      if (entry.endsWith('.ts') && entry !== 'index.ts') {
        stores.push(entry.replace('.ts', ''));
      }
    }

    return stores;
  }

  getProjectStats(): ProjectStats {
    const stats: ProjectStats = {
      files: 0,
      typescript: 0,
      react: 0,
      apiRoutes: 0,
      dbTables: 0,
      components: 0,
      stores: 0,
    };

    const skipDirs = ['node_modules', '.next', 'data', 'generated', '.git'];

    const countFiles = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (skipDirs.includes(entry.name)) continue;

        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          countFiles(fullPath);
        } else {
          stats.files++;
          if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
            stats.typescript++;
          }
          if (entry.name.endsWith('.tsx')) {
            stats.react++;
          }
        }
      }
    };

    countFiles(this.root);
    stats.apiRoutes = this.scanApiRoutes().length;
    stats.dbTables = this.scanDbSchema().length;
    stats.components = this.scanComponents().length;
    stats.stores = this.scanStores().length;

    return stats;
  }

  scanPages(): string[] {
    const pages: string[] = [];
    const appDir = path.join(this.root, 'app');

    const scanDir = (dir: string, basePath: string) => {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.name.startsWith('_') || entry.name.startsWith('(')) continue;

        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          scanDir(fullPath, basePath + '/' + entry.name);
        } else if (entry.name === 'page.tsx') {
          pages.push(basePath || '/');
        }
      }
    };

    scanDir(appDir, '');
    return pages;
  }
}

// ============================================================================
// Mermaid Diagram Generator
// ============================================================================

class MermaidGenerator {
  generateSystemArchitecture(): string {
    return `graph TB
    subgraph Frontend["前端层"]
        Pages["页面 app/*"]
        Components["组件 components/*"]
        Stores["状态管理 store/*"]
    end

    subgraph API["API 层"]
        Routes["API Routes app/api/*"]
        MCP["MCP 处理器 core/mcp/*"]
    end

    subgraph Data["数据层"]
        SQLite["SQLite data/teamclaw.db"]
        Gateway["OpenClaw Gateway WebSocket"]
    end

    subgraph Realtime["实时通信"]
        SSE["SSE 推送 /api/sse"]
        EventBus["事件总线 lib/event-bus.ts"]
    end

    Pages --> Components
    Components --> Stores
    Stores --> Routes
    Stores --> Gateway

    Routes --> SQLite
    Routes --> Gateway
    MCP --> SQLite

    Routes --> EventBus
    EventBus --> SSE
    SSE --> Stores`;
  }

  generateDataFlow(): string {
    return `sequenceDiagram
    participant U as 用户
    participant C as Component
    participant S as Store
    participant A as API
    participant D as Database

    U->>C: 交互操作
    C->>S: 调用 Store 方法
    S->>A: fetch() 请求
    A->>D: SQL 查询
    D-->>A: 返回数据
    A-->>S: JSON 响应
    S->>S: 更新状态
    S-->>C: 触发重渲染
    C-->>U: 更新 UI`;
  }

  generateDbDiagram(tables: DbTable[]): string {
    if (tables.length === 0) return 'erDiagram\n    NOTE[无数据库表]';

    let diagram = 'erDiagram\n';
    const mainTables = tables.slice(0, 10);

    for (const table of mainTables) {
      const pk = table.columns.find(c => c.isPrimary);
      const pkName = pk ? pk.name : 'id';
      const pkType = pk?.type ?? 'string';

      diagram += '    ' + table.name.toUpperCase() + ' {\n';
      diagram += '        ' + pkType + ' ' + pkName + ' PK\n';

      const otherCols = table.columns.filter(c => !c.isPrimary).slice(0, 4);
      for (const col of otherCols) {
        diagram += '        ' + col.type + ' ' + col.name + '\n';
      }

      if (table.columns.length > 5) {
        diagram += '        string "...' + (table.columns.length - 5) + ' more"\n';
      }

      diagram += '    }\n';
    }

    if (tables.length > 10) {
      diagram += '    NOTE["...还有 ' + (tables.length - 10) + ' 个表"]\n';
    }

    return diagram;
  }

  generateApiDiagram(routes: ApiRoute[]): string {
    if (routes.length === 0) return 'graph LR\n    A[无 API 路由]';

    const grouped = new Map<string, string[]>();

    for (const route of routes) {
      const pathParts = route.path.split('/');
      const group = pathParts[2] || 'root';
      if (!grouped.has(group)) {
        grouped.set(group, []);
      }
      grouped.get(group)!.push(route.method);
    }

    let diagram = 'graph LR\n';

    for (const [group, methods] of grouped.entries()) {
      const uniqueMethods = [...new Set(methods)];
      const label = uniqueMethods.join('/');
      const safeId = group.replace(/[^a-zA-Z0-9]/g, '_');
      diagram += '    API_' + safeId + '["' + group + '<br/>' + label + '"]\n';
    }

    return diagram;
  }

  generateComponentDiagram(components: Component[]): string {
    if (components.length === 0) return 'graph LR\n    A[无组件]';

    let diagram = 'graph TB\n';
    const grouped = new Map<string, Component[]>();

    for (const comp of components) {
      const dir = path.dirname(comp.path).split('/')[2] || 'root';
      if (!grouped.has(dir)) {
        grouped.set(dir, []);
      }
      grouped.get(dir)!.push(comp);
    }

    for (const [dir, comps] of grouped.entries()) {
      diagram += '    subgraph ' + dir + '\n';
      for (const comp of comps.slice(0, 5)) {
        diagram += '        ' + comp.name + '\n';
      }
      if (comps.length > 5) {
        diagram += '        "...' + (comps.length - 5) + ' more"\n';
      }
      diagram += '    end\n';
    }

    return diagram;
  }
}

// ============================================================================
// HTML Document Generator (深色主题版)
// ============================================================================

class HtmlGenerator {
  constructor(
    private stats: ProjectStats,
    private routes: ApiRoute[],
    private tables: DbTable[],
    private components: Component[],
    private stores: string[],
    private pages: string[],
    private mermaid: MermaidGenerator
  ) {}

  generate(): string {
    const css = this.generateCss();
    const body = this.generateBody();
    const script = this.generateScript();

    return '<!DOCTYPE html>\n' +
      '<html lang="zh-CN">\n' +
      '<head>\n' +
      '    <meta charset="UTF-8">\n' +
      '    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
      '    <title>TeamClaw 技术架构</title>\n' +
      '    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">\n' +
      '    <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>\n' +
      '    <style>\n' + css + '\n    </style>\n' +
      '</head>\n' +
      '<body>\n' + body + '\n' + script + '\n' +
      '</body>\n' +
      '</html>';
  }

  private generateCss(): string {
    return `
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        :root {
            --bg-primary: #050810;
            --bg-secondary: #0a0f1d;
            --bg-elevated: #111a2e;
            --text-primary: #f8fafc;
            --text-secondary: #94a3b8;
            --text-muted: #64748b;
            --brand: #818cf8;
            --brand-hover: #a5b4fc;
            --accent-cyan: #22d3ee;
            --accent-violet: #a78bfa;
            --accent-emerald: #34d399;
            --accent-amber: #fbbf24;
            --accent-rose: #fb7185;
            --border: #1e293b;
            --border-subtle: #121b2d;
        }

        body {
            font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
            line-height: 1.7;
            color: var(--text-primary);
            background: var(--bg-primary);
            min-height: 100vh;
            letter-spacing: -0.011em;
            -webkit-font-smoothing: antialiased;
        }

        body::before {
            content: '';
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: 
                radial-gradient(ellipse 80% 50% at 50% -20%, rgba(120, 119, 198, 0.15), transparent),
                radial-gradient(ellipse 60% 40% at 100% 100%, rgba(6, 182, 212, 0.08), transparent);
            pointer-events: none;
            z-index: 0;
        }

        .container {
            max-width: 1280px;
            margin: 0 auto;
            padding: 40px 24px;
            position: relative;
            z-index: 1;
        }

        .header { text-align: center; margin-bottom: 60px; padding: 40px 0; }
        .header h1 {
            font-size: 3rem; font-weight: 800; letter-spacing: -0.03em;
            background: linear-gradient(135deg, var(--brand) 0%, var(--accent-cyan) 50%, var(--accent-violet) 100%);
            -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
            margin-bottom: 16px;
        }
        .header .subtitle { font-size: 1.1rem; color: var(--text-secondary); font-weight: 500; }
        .header .updated { color: var(--text-muted); font-size: 0.875rem; margin-top: 12px; }

        .section { margin-bottom: 48px; animation: fadeIn 0.5s ease forwards; }
        .section:nth-child(2) { animation-delay: 0.1s; }
        .section:nth-child(3) { animation-delay: 0.2s; }
        .section:nth-child(4) { animation-delay: 0.3s; }

        .section-title {
            font-size: 1.5rem; font-weight: 700; color: var(--text-primary);
            margin-bottom: 24px; display: flex; align-items: center; gap: 12px;
        }
        .section-title .icon {
            width: 32px; height: 32px; border-radius: 10px;
            display: flex; align-items: center; justify-content: center; font-size: 1rem;
        }

        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 16px; margin-bottom: 48px; }
        .stat-card {
            background: var(--bg-secondary); border: 1px solid var(--border);
            border-radius: 16px; padding: 24px; text-align: center;
            transition: all 0.3s ease;
        }
        .stat-card:hover {
            border-color: var(--brand); transform: translateY(-2px);
            box-shadow: 0 8px 32px rgba(129, 140, 248, 0.1);
        }
        .stat-value {
            font-size: 2.5rem; font-weight: 800;
            background: linear-gradient(135deg, var(--brand), var(--accent-cyan));
            -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }
        .stat-label { color: var(--text-secondary); font-size: 0.875rem; margin-top: 4px; font-weight: 500; }

        .diagram-card {
            background: var(--bg-secondary); border: 1px solid var(--border);
            border-radius: 20px; padding: 32px; margin-bottom: 24px; overflow: hidden;
        }
        .diagram-card .mermaid { display: flex; justify-content: center; overflow-x: auto; }

        .table-card {
            background: var(--bg-secondary); border: 1px solid var(--border);
            border-radius: 16px; overflow: hidden;
        }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 14px 20px; text-align: left; border-bottom: 1px solid var(--border-subtle); }
        th { background: var(--bg-elevated); color: var(--text-secondary); font-weight: 600; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; }
        tr:last-child td { border-bottom: none; }
        tr:hover td { background: var(--bg-elevated); }

        code {
            font-family: 'JetBrains Mono', monospace; font-size: 0.85rem;
            background: var(--bg-elevated); padding: 4px 8px; border-radius: 6px;
            color: var(--accent-cyan);
        }

        .method { display: inline-block; padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 700; font-family: 'JetBrains Mono', monospace; }
        .method-get { background: rgba(52, 211, 153, 0.15); color: var(--accent-emerald); }
        .method-post { background: rgba(251, 191, 36, 0.15); color: var(--accent-amber); }
        .method-put { background: rgba(129, 140, 248, 0.15); color: var(--brand); }
        .method-delete { background: rgba(251, 113, 133, 0.15); color: var(--accent-rose); }
        .method-patch { background: rgba(167, 139, 250, 0.15); color: var(--accent-violet); }

        .badge {
            display: inline-block; padding: 6px 14px; border-radius: 20px;
            font-size: 0.8rem; font-weight: 600; margin: 4px;
            background: var(--bg-elevated); border: 1px solid var(--border);
            color: var(--text-secondary); transition: all 0.2s ease;
        }
        .badge:hover { border-color: var(--brand); color: var(--brand); }

        .tech-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; }
        .tech-item {
            display: flex; align-items: center; gap: 16px;
            padding: 16px 20px; background: var(--bg-secondary);
            border: 1px solid var(--border); border-radius: 12px;
            transition: all 0.2s ease;
        }
        .tech-item:hover { border-color: var(--brand); }
        .tech-item .label { color: var(--text-muted); font-size: 0.85rem; min-width: 80px; }
        .tech-item .value { color: var(--text-primary); font-weight: 600; }

        @keyframes fadeIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 100px; }
        ::-webkit-scrollbar-thumb:hover { background: var(--text-muted); }

        .footer { text-align: center; padding: 40px 0; color: var(--text-muted); font-size: 0.875rem; border-top: 1px solid var(--border); margin-top: 60px; }`;
  }

  private generateBody(): string {
    const statsHtml = this.generateStatsHtml();
    const apiTableHtml = this.generateApiTableHtml();
    const pagesHtml = this.generatePagesHtml();
    const storesHtml = this.generateStoresHtml();

    return '    <div class="container">\n' +
      '        <header class="header">\n' +
      '            <h1>TeamClaw 技术架构</h1>\n' +
      '            <p class="subtitle">把 AI 当队友，而不是工具</p>\n' +
      '            <p class="updated">自动生成于 ' + new Date().toLocaleString('zh-CN') + '</p>\n' +
      '        </header>\n\n' +
      statsHtml + '\n' +
      this.generateSection('🏛️', 'rgba(129, 140, 248, 0.15)', '系统架构',
        '<div class="diagram-card"><div class="mermaid">' + this.mermaid.generateSystemArchitecture() + '</div></div>') + '\n' +
      this.generateSection('🔄', 'rgba(34, 211, 238, 0.15)', '数据流',
        '<div class="diagram-card"><div class="mermaid">' + this.mermaid.generateDataFlow() + '</div></div>') + '\n' +
      this.generateSection('🗃️', 'rgba(52, 211, 153, 0.15)', '数据库结构 (' + this.tables.length + ' 表)',
        '<div class="diagram-card"><div class="mermaid">' + this.mermaid.generateDbDiagram(this.tables) + '</div></div>') + '\n' +
      this.generateSection('🔌', 'rgba(251, 191, 36, 0.15)', 'API 端点 (' + this.routes.length + ' 个)',
        '<div class="diagram-card"><div class="mermaid">' + this.mermaid.generateApiDiagram(this.routes) + '</div></div>' + apiTableHtml) + '\n' +
      this.generateSection('🧩', 'rgba(167, 139, 250, 0.15)', '组件结构 (' + this.components.length + ' 个)',
        '<div class="diagram-card"><div class="mermaid">' + this.mermaid.generateComponentDiagram(this.components) + '</div></div>') + '\n' +
      this.generateSection('📄', 'rgba(251, 113, 133, 0.15)', '页面路由 (' + this.pages.length + ' 个)', pagesHtml) + '\n' +
      this.generateSection('📦', 'rgba(129, 140, 248, 0.15)', 'Zustand Store (' + this.stores.length + ' 个)', storesHtml) + '\n' +
      this.generateTechStack() + '\n' +
      '        <footer class="footer">\n' +
      '            TeamClaw Architecture Documentation · Auto-generated\n' +
      '        </footer>\n' +
      '    </div>';
  }

  private generateStatsHtml(): string {
    return '        <section class="section">\n' +
      '            <div class="stats-grid">\n' +
      '                <div class="stat-card"><div class="stat-value">' + this.stats.files + '</div><div class="stat-label">总文件数</div></div>\n' +
      '                <div class="stat-card"><div class="stat-value">' + this.stats.typescript + '</div><div class="stat-label">TypeScript</div></div>\n' +
      '                <div class="stat-card"><div class="stat-value">' + this.stats.react + '</div><div class="stat-label">React 组件</div></div>\n' +
      '                <div class="stat-card"><div class="stat-value">' + this.stats.apiRoutes + '</div><div class="stat-label">API 端点</div></div>\n' +
      '                <div class="stat-card"><div class="stat-value">' + this.stats.dbTables + '</div><div class="stat-label">数据库表</div></div>\n' +
      '                <div class="stat-card"><div class="stat-value">' + this.stats.stores + '</div><div class="stat-label">Zustand Store</div></div>\n' +
      '            </div>\n' +
      '        </section>';
  }

  private generateSection(icon: string, iconBg: string, title: string, content: string): string {
    return '        <section class="section">\n' +
      '            <h2 class="section-title">\n' +
      '                <span class="icon" style="background: ' + iconBg + ';">' + icon + '</span>\n' +
      '                ' + title + '\n' +
      '            </h2>\n' +
      '            ' + content + '\n' +
      '        </section>';
  }

  private generateApiTableHtml(): string {
    let rows = '';
    for (const route of this.routes) {
      const methodClass = 'method-' + route.method.toLowerCase();
      rows += '                        <tr><td><span class="method ' + methodClass + '">' + route.method + '</span></td><td><code>' + route.path + '</code></td><td><code>' + route.file + '</code></td></tr>\n';
    }
    return '\n            <div class="table-card" style="max-height: 400px; overflow-y: auto;">\n' +
      '                <table>\n' +
      '                    <thead><tr><th>方法</th><th>路径</th><th>文件</th></tr></thead>\n' +
      '                    <tbody>\n' + rows + '                    </tbody>\n' +
      '                </table>\n' +
      '            </div>';
  }

  private generatePagesHtml(): string {
    let rows = '';
    for (const p of this.pages) {
      rows += '                        <tr><td><code>' + (p || '/') + '</code></td></tr>\n';
    }
    return '<div class="table-card"><table><tbody>\n' + rows + '                    </tbody></table></div>';
  }

  private generateStoresHtml(): string {
    let badges = '';
    for (const s of this.stores) {
      badges += '<span class="badge">' + s + '</span>\n';
    }
    return '<div style="display: flex; flex-wrap: wrap; gap: 8px;">\n                ' + badges + '            </div>';
  }

  private generateTechStack(): string {
    const items = [
      ['框架', 'Next.js 14 (App Router)'],
      ['语言', 'TypeScript (strict)'],
      ['数据库', 'SQLite + Drizzle ORM'],
      ['状态', 'Zustand'],
      ['UI', 'shadcn/ui + Tailwind'],
      ['实时', 'SSE + WebSocket'],
      ['图表', 'Mermaid'],
      ['网关', 'OpenClaw Gateway'],
    ];

    let html = '';
    for (const [label, value] of items) {
      html += '                <div class="tech-item"><span class="label">' + label + '</span><span class="value">' + value + '</span></div>\n';
    }

    return this.generateSection('⚡', 'rgba(34, 211, 238, 0.15)', '技术栈',
      '<div class="tech-grid">\n' + html + '            </div>');
  }

  private generateScript(): string {
    return '    <script>\n' +
      '        mermaid.initialize({\n' +
      '            startOnLoad: true,\n' +
      "            theme: 'dark',\n" +
      '            themeVariables: {\n' +
      "                primaryColor: '#818cf8',\n" +
      "                primaryTextColor: '#f8fafc',\n" +
      "                primaryBorderColor: '#1e293b',\n" +
      "                lineColor: '#64748b',\n" +
      "                secondaryColor: '#111a2e',\n" +
      "                tertiaryColor: '#0a0f1d',\n" +
      "                background: '#0a0f1d',\n" +
      "                mainBkg: '#111a2e',\n" +
      "                nodeBorder: '#1e293b',\n" +
      "                clusterBkg: '#0a0f1d',\n" +
      "                clusterBorder: '#1e293b',\n" +
      "                titleColor: '#f8fafc',\n" +
      "                edgeLabelBackground: '#111a2e',\n" +
      "                fontFamily: 'Plus Jakarta Sans, sans-serif'\n" +
      '            },\n' +
      '            flowchart: { useMaxWidth: true, curve: "basis", padding: 20 },\n' +
      '            sequence: { useMaxWidth: true, actorMargin: 50, boxMargin: 10 },\n' +
      '            er: { useMaxWidth: true }\n' +
      '        });\n' +
      '    </script>';
  }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('🔍 正在扫描项目结构...\n');

  const scanner = new ProjectScanner();
  const mermaid = new MermaidGenerator();

  const stats = scanner.getProjectStats();
  const routes = scanner.scanApiRoutes();
  const tables = scanner.scanDbSchema();
  const components = scanner.scanComponents();
  const stores = scanner.scanStores();
  const pages = scanner.scanPages();

  console.log('📊 项目统计:');
  console.log('   总文件数: ' + stats.files);
  console.log('   TypeScript: ' + stats.typescript);
  console.log('   React 组件: ' + stats.react);
  console.log('   API 端点: ' + stats.apiRoutes);
  console.log('   数据库表: ' + stats.dbTables);
  console.log('   Store: ' + stats.stores);
  console.log('   页面: ' + pages.length + '\n');

  const htmlGenerator = new HtmlGenerator(stats, routes, tables, components, stores, pages, mermaid);
  const html = htmlGenerator.generate();

  const outputDir = path.join(process.cwd(), 'generated');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }

  const outputPath = path.join(outputDir, 'architecture.html');
  fs.writeFileSync(outputPath, html, 'utf-8');

  console.log('✅ 架构文档已生成: ' + outputPath);
  console.log('\n💡 提示: 在浏览器中打开此文件查看完整的架构图表');
}

main().catch(console.error);
