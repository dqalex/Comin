/**
 * PM2 ecosystem configuration for CoMind
 */
const fs = require('fs');
const path = require('path');

// 读取 .env 文件并解析环境变量
function loadEnvFile(envPath) {
  const env = {};
  try {
    const content = fs.readFileSync(envPath, 'utf8');
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const eqIndex = trimmed.indexOf('=');
        if (eqIndex > 0) {
          const key = trimmed.substring(0, eqIndex).trim();
          let value = trimmed.substring(eqIndex + 1).trim();
          // 移除引号
          if ((value.startsWith('"') && value.endsWith('"')) || 
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          env[key] = value;
        }
      }
    }
  } catch (e) {
    console.error('Failed to load env file:', e.message);
  }
  return env;
}

// 加载环境变量
const envPath = process.env.NODE_ENV === 'production' 
  ? '/root/teamclaw/.next/standalone/.env'
  : '.env';
const envVars = loadEnvFile(envPath);

module.exports = {
  apps: [
    {
      name: 'teamclaw',
      script: '.next/standalone/server.js',
      cwd: '/root/teamclaw',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        SKILLS_FOLDER_PATH: '/root/teamclaw/skills',
        ...envVars,
      },
    },
  ],
};
