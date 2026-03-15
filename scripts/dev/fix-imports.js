const fs = require('fs');
const path = require('path');

// schema 表名到导入路径的映射
const schemaImports = {
  'chatSessions': 'chatSessions',
  'chatMessages': 'chatMessages',
  'tasks': 'tasks',
  'projects': 'projects',
  'members': 'members',
  'documents': 'documents',
  'deliveries': 'deliveries',
  'milestones': 'milestones',
  'users': 'users',
  'scheduledTasks': 'scheduledTasks',
  'scheduledTaskHistory': 'scheduledTaskHistory',
  'sopTemplates': 'sopTemplates',
  'renderTemplates': 'renderTemplates',
  'comments': 'comments',
  'openclawFiles': 'openclawFiles',
  'openclawWorkspaces': 'openclawWorkspaces',
  'openclawConflicts': 'openclawConflicts',
  'gatewayConfigs': 'gatewayConfigs',
  'userMcpTokens': 'userMcpTokens',
  'activityLogs': 'activityLogs',
  'landingPages': 'landingPages',
  'taskLogs': 'taskLogs',
};

// 获取所有 API 路由文件
const files = process.argv.slice(2);

for (const file of files) {
  if (!file.endsWith('route.ts')) continue;

  let content = fs.readFileSync(file, 'utf8');
  let modified = false;

  // 检查需要导入的 schema
  const neededImports = [];
  for (const [table, importName] of Object.entries(schemaImports)) {
    // 如果文件使用了表名但没有导入
    if (content.includes(table) && !content.includes(`import.*${table}.*from.*@/db/schema`)) {
      // 检查是否已经在导入语句中
      const importRegex = new RegExp(`import\\s*{[^}]*${table}[^}]*}\\s*from\\s*['"]@/db/schema['"]`, 's');
      if (!importRegex.test(content)) {
        neededImports.push(table);
      }
    }
  }

  if (neededImports.length > 0) {
    // 查找现有的 schema 导入行
    const schemaImportRegex = /import\s*{([^}]*)}\s*from\s*['"]@\/db\/schema['"];/;
    const match = content.match(schemaImportRegex);

    if (match) {
      // 更新现有的导入
      const existingImports = match[1].split(',').map(s => s.trim()).filter(Boolean);
      const allImports = [...new Set([...existingImports, ...neededImports])];
      const newImport = `import { ${allImports.join(', ')} } from '@/db/schema';`;
      content = content.replace(schemaImportRegex, newImport);
    } else {
      // 添加新的导入（在 db 导入之后）
      const dbImportRegex = /import\s*{\s*db\s*}\s*from\s*['"]@\/db['"];/;
      const dbMatch = content.match(dbImportRegex);
      if (dbMatch) {
        const newImport = `import { ${neededImports.join(', ')} } from '@/db/schema';`;
        content = content.replace(dbMatch[0], dbMatch[0] + '\n' + newImport);
      }
    }

    fs.writeFileSync(file, content);
    console.log(`Fixed: ${file} - Added: ${neededImports.join(', ')}`);
  }
}
