#!/bin/bash

# ==============================================================================
# TeamClaw 标准测试流程脚本
# 
# 流程:
# a. 关闭所有开发服务器
# b. 清除缓存
# c. 代码构建
# d. 启动开发服务器
# e. 开始测试
# f. 生成报告
# ==============================================================================

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 项目根目录
PROJECT_ROOT="/Users/alex/Documents/alex base/sense/teamclaw-v3"
REPORTS_DIR="$PROJECT_ROOT/tests/reports"

# 时间戳
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# ==============================================================================
# 步骤 A: 关闭所有开发服务器
# ==============================================================================
shutdown_servers() {
    log_info "正在关闭所有开发服务器..."
    
    # 查找并关闭 Next.js 开发服务器
    pkill -f "next dev" 2>/dev/null || true
    
    # 查找并关闭 Node.js 进程（端口 3000）
    lsof -ti:3000 | xargs kill -9 2>/dev/null || true
    
    # 等待进程完全退出
    sleep 2
    
    log_success "开发服务器已关闭"
}

# ==============================================================================
# 步骤 B: 清除缓存
# ==============================================================================
clear_cache() {
    log_info "正在清除缓存..."
    
    cd "$PROJECT_ROOT"
    
    # 清除 Next.js 缓存
    rm -rf .next 2>/dev/null || true
    
    # 清除 node_modules/.cache
    rm -rf node_modules/.cache 2>/dev/null || true
    
    # 清除测试缓存
    rm -rf tests/.cache 2>/dev/null || true
    
    # 清除 Playwright 缓存
    npx playwright test --clear-cache 2>/dev/null || true
    
    # 清除 Vitest 缓存
    rm -rf node_modules/.vitest 2>/dev/null || true
    
    log_success "缓存已清除"
}

# ==============================================================================
# 步骤 C: 代码构建
# ==============================================================================
build_project() {
    log_info "正在构建项目..."
    
    cd "$PROJECT_ROOT"
    
    # 安装依赖（如果需要）
    if [ ! -d "node_modules" ]; then
        log_info "安装依赖..."
        npm install
    fi
    
    # 构建项目
    npm run build
    
    log_success "项目构建完成"
}

# ==============================================================================
# 步骤 D: 启动开发服务器
# ==============================================================================
start_server() {
    log_info "正在启动开发服务器..."
    
    cd "$PROJECT_ROOT"
    
    # 设置测试环境变量
    export PLAYWRIGHT_TEST=true
    export NODE_ENV=development
    
    # 后台启动开发服务器
    npm run dev > /tmp/teamclaw-dev.log 2>&1 &
    SERVER_PID=$!
    
    # 等待服务器启动
    log_info "等待服务器启动..."
    max_wait=60
    waited=0
    
    while [ $waited -lt $max_wait ]; do
        if curl -s http://localhost:3000 > /dev/null 2>&1; then
            log_success "开发服务器已启动 (PID: $SERVER_PID)"
            return 0
        fi
        sleep 1
        waited=$((waited + 1))
        echo -n "."
    done
    
    echo ""
    log_error "服务器启动超时"
    cat /tmp/teamclaw-dev.log
    return 1
}

# ==============================================================================
# 步骤 E: 开始测试
# ==============================================================================
run_tests() {
    local test_type=$1
    
    cd "$PROJECT_ROOT"
    
    export PLAYWRIGHT_TEST=true
    
    case $test_type in
        "e2e")
            log_info "运行 E2E 测试..."
            npx playwright test --reporter=html --output="$REPORTS_DIR/playwright-report"
            ;;
        "stress")
            log_info "运行压力测试..."
            npx playwright test tests/stress/ --reporter=html --output="$REPORTS_DIR/playwright-report"
            ;;
        "security")
            log_info "运行安全测试..."
            npx playwright test tests/security/ --reporter=html --output="$REPORTS_DIR/playwright-report"
            ;;
        "unit")
            log_info "运行单元测试..."
            npm run test:unit
            ;;
        "integration")
            log_info "运行集成测试..."
            npm run test:integration
            ;;
        "all")
            log_info "运行所有测试..."
            
            # 单元测试
            log_info "=== 单元测试 ==="
            npm run test:unit 2>&1 | tee "$REPORTS_DIR/unit-test-$TIMESTAMP.log"
            
            # 集成测试
            log_info "=== 集成测试 ==="
            npm run test:integration 2>&1 | tee "$REPORTS_DIR/integration-test-$TIMESTAMP.log"
            
            # E2E 测试
            log_info "=== E2E 测试 ==="
            npx playwright test --reporter=html 2>&1 | tee "$REPORTS_DIR/e2e-test-$TIMESTAMP.log"
            
            # 压力测试
            log_info "=== 压力测试 ==="
            npx playwright test tests/stress/ --reporter=html 2>&1 | tee "$REPORTS_DIR/stress-test-$TIMESTAMP.log"
            
            # 安全测试
            log_info "=== 安全测试 ==="
            npx playwright test tests/security/ --reporter=html 2>&1 | tee "$REPORTS_DIR/security-test-$TIMESTAMP.log"
            ;;
        *)
            log_error "未知测试类型: $test_type"
            echo "用法: $0 <e2e|stress|security|unit|integration|all>"
            exit 1
            ;;
    esac
}

# ==============================================================================
# 步骤 F: 生成报告
# ==============================================================================
generate_final_report() {
    log_info "正在生成最终测试报告..."
    
    cd "$PROJECT_ROOT"
    
    # 合并所有报告
    local report_file="$REPORTS_DIR/test-summary-$TIMESTAMP.md"
    
    cat > "$report_file" << EOF
# TeamClaw 测试报告汇总

**生成时间**: $(date '+%Y-%m-%d %H:%M:%S')
**测试目标**: ${TEST_TARGET:-local}

---

## 测试统计

EOF

    # 提取单元测试结果
    if [ -f "$REPORTS_DIR/unit-test-$TIMESTAMP.log" ]; then
        echo "### 单元测试" >> "$report_file"
        grep -E "(passed|failed|skipped)" "$REPORTS_DIR/unit-test-$TIMESTAMP.log" | tail -5 >> "$report_file" 2>/dev/null || true
        echo "" >> "$report_file"
    fi
    
    # 提取 E2E 测试结果
    if [ -d "$REPORTS_DIR/playwright-report" ]; then
        echo "### E2E 测试" >> "$report_file"
        echo "查看详细报告: tests/reports/playwright-report/index.html" >> "$report_file"
        echo "" >> "$report_file"
    fi
    
    # 列出所有生成的报告
    echo "### 生成的报告文件" >> "$report_file"
    echo "" >> "$report_file"
    ls -la "$REPORTS_DIR"/*.{md,log} 2>/dev/null >> "$report_file" || true
    
    log_success "最终报告已生成: $report_file"
    echo ""
    cat "$report_file"
}

# ==============================================================================
# 清理函数
# ==============================================================================
cleanup() {
    log_info "清理中..."
    
    # 关闭开发服务器
    pkill -f "next dev" 2>/dev/null || true
    lsof -ti:3000 | xargs kill -9 2>/dev/null || true
    
    log_info "清理完成"
}

# 注册清理函数
trap cleanup EXIT

# ==============================================================================
# 主程序
# ==============================================================================
main() {
    local test_type=${1:-"all"}
    
    echo "========================================"
    echo "  TeamClaw 测试流程"
    echo "========================================"
    echo ""
    log_info "测试类型: $test_type"
    echo ""
    
    # 步骤 A: 关闭服务器
    shutdown_servers
    echo ""
    
    # 步骤 B: 清除缓存
    clear_cache
    echo ""
    
    # 步骤 C: 构建项目
    build_project
    echo ""
    
    # 步骤 D: 启动服务器
    start_server
    echo ""
    
    # 步骤 E: 运行测试
    run_tests "$test_type"
    echo ""
    
    # 步骤 F: 生成报告
    generate_final_report
    echo ""
    
    log_success "测试流程完成!"
}

# 运行主程序
main "$@"
