#!/bin/bash
# CoMind 部署脚本
# 用法: ./scripts/deploy.sh [--skip-build]
#
# 部署前请设置环境变量：
#   DEPLOY_SERVER  - 服务器地址（如 user@your-server）
#   DEPLOY_PATH    - 远程部署路径（如 /opt/comind）
#   DEPLOY_NVM_DIR - 服务器 nvm 目录（可选，如 /root/.nvm）

set -e

# 配置
SERVER="${DEPLOY_SERVER:?请设置 DEPLOY_SERVER 环境变量，如: export DEPLOY_SERVER=user@your-server}"
REMOTE_PATH="${DEPLOY_PATH:-/root/comind}"
LOCAL_PATH="$(pwd)"
# 如果服务器使用 nvm，设置 NVM_DIR 以便 ssh 命令中初始化 Node 环境
NVM_INIT="${DEPLOY_NVM_DIR:+source $DEPLOY_NVM_DIR/nvm.sh &&}"

# 解析参数
SKIP_BUILD=false
for arg in "$@"; do
  case $arg in
    --skip-build)
      SKIP_BUILD=true
      shift
      ;;
  esac
done

echo "=========================================="
echo "CoMind 部署脚本"
echo "=========================================="
echo "服务器: $SERVER"
echo "远程路径: $REMOTE_PATH"
echo "跳过构建: $SKIP_BUILD"
echo ""

# 1. 本地构建
if [ "$SKIP_BUILD" = false ]; then
  echo "[1/6] 本地构建..."
  npm run build
  
  if [ $? -ne 0 ]; then
    echo "❌ 构建失败"
    exit 1
  fi
  echo "✓ 构建完成"
else
  echo "[1/6] 跳过本地构建"
fi

# 2. 同步文件到服务器（排除 data/ 目录保护数据库）
echo "[2/6] 同步文件到服务器..."
rsync -avz --delete \
  --exclude='node_modules/' \
  --exclude='.next/' \
  --exclude='data/' \
  --exclude='.env' \
  --exclude='.env.local' \
  --exclude='.env*.local' \
  --exclude='.codebuddy/' \
  --exclude='logs/' \
  --exclude='*.log' \
  --exclude='.DS_Store' \
  "$LOCAL_PATH/" "$SERVER:$REMOTE_PATH/"

if [ $? -ne 0 ]; then
  echo "❌ 同步失败"
  exit 1
fi
echo "✓ 同步完成"

# 3. 服务器端构建
echo "[3/6] 服务器端构建..."
ssh $SERVER "$NVM_INIT cd $REMOTE_PATH && npm install --production=false && npm run build"

if [ $? -ne 0 ]; then
  echo "❌ 服务器构建失败"
  exit 1
fi
echo "✓ 服务器构建完成"

# 4. 复制静态文件（standalone 模式必须）
echo "[4/6] 复制静态文件到 standalone..."
ssh $SERVER "cd $REMOTE_PATH && cp -r .next/static .next/standalone/.next/ && cp .env .next/standalone/.env 2>/dev/null || echo 'No .env file found'"

if [ $? -ne 0 ]; then
  echo "❌ 静态文件复制失败"
  exit 1
fi
echo "✓ 静态文件复制完成"

# 4.5 复制 serverExternalPackages（chokidar 等）到 standalone
echo "[4.5/6] 复制外部依赖到 standalone..."
ssh $SERVER "cd $REMOTE_PATH && mkdir -p .next/standalone/node_modules/chokidar && cp -r node_modules/chokidar/* .next/standalone/node_modules/chokidar/ 2>/dev/null || echo 'chokidar not found'"
# 复制 chokidar 的依赖
ssh $SERVER "cd $REMOTE_PATH && mkdir -p .next/standalone/node_modules/readdirp && cp -r node_modules/readdirp/* .next/standalone/node_modules/readdirp/ 2>/dev/null || echo 'readdirp not found'"

echo "✓ 外部依赖复制完成"

# 5. 确保 public 目录存在
echo "[5/6] 复制 public 目录..."
ssh $SERVER "cd $REMOTE_PATH && cp -r public .next/standalone/ 2>/dev/null || echo 'No public directory'"

# 6. 重启服务
echo "[6/6] 重启服务..."
ssh $SERVER "$NVM_INIT cd $REMOTE_PATH && pm2 restart comind || pm2 start ecosystem.config.cjs"

if [ $? -ne 0 ]; then
  echo "❌ 服务重启失败"
  exit 1
fi
echo "✓ 服务已重启"

# 检查服务状态
echo ""
echo "=========================================="
echo "部署完成！"
echo "=========================================="
ssh $SERVER "$NVM_INIT pm2 status comind"
echo ""
echo "访问方式: ssh -L 8000:localhost:3000 $SERVER"
echo "然后访问: http://localhost:8000"
