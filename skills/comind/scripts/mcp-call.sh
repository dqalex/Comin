#!/bin/bash
# MCP API 调用脚本模板
# 用于验证操作结果和执行可靠请求

# 环境变量（由 Agent 自动注入）
TEAMCLAW_BASE_URL="${TEAMCLAW_BASE_URL:-http://localhost:3000}"
TEAMCLAW_API_TOKEN="${TEAMCLAW_API_TOKEN}"

#######################################
# 基础调用函数
# 用法: mcp_call "tool_name" '{"param": "value"}'
#######################################
mcp_call() {
  local tool="$1"
  local params="$2"
  
  curl -s -X POST "${TEAMCLAW_BASE_URL}/api/mcp/external" \
    -H "Authorization: Bearer ${TEAMCLAW_API_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{\"tool\": \"${tool}\", \"parameters\": ${params}}"
}

#######################################
# 带重试的 MCP 调用
# 用法: mcp_call_with_retry "tool_name" '{"param": "value"}' [max_retries]
#######################################
mcp_call_with_retry() {
  local tool="$1"
  local params="$2"
  local max_retries="${3:-3}"
  local retry=0
  
  while [ $retry -lt $max_retries ]; do
    result=$(mcp_call "$tool" "$params")
    
    if echo "$result" | jq -e '.success == true' > /dev/null; then
      echo "$result"
      return 0
    fi
    
    error=$(echo "$result" | jq -r '.error')
    
    # 限流错误，等待重试
    if echo "$error" | grep -q "rate limit"; then
      sleep $((2 ** retry))
      retry=$((retry + 1))
      continue
    fi
    
    # 其他错误，直接返回
    echo "$result"
    return 1
  done
  
  echo '{"success": false, "error": "Max retries exceeded"}'
  return 1
}

#######################################
# 验证任务创建/更新
# 用法: verify_task "task_id" [expected_status]
#######################################
verify_task() {
  local task_id="$1"
  local expected_status="${2:-todo}"
  
  result=$(mcp_call "get_task" "{\"task_id\": \"${task_id}\"}")
  
  if echo "$result" | jq -e '.success == true' > /dev/null; then
    actual_status=$(echo "$result" | jq -r '.data.status')
    if [ "$actual_status" = "$expected_status" ]; then
      echo "✅ 任务验证成功: $task_id 状态为 $actual_status"
      return 0
    else
      echo "⚠️ 任务状态不符: 期望 $expected_status，实际 $actual_status"
      return 1
    fi
  else
    echo "❌ 任务验证失败: $(echo "$result" | jq -r '.error')"
    return 1
  fi
}

#######################################
# 验证交付记录创建
# 用法: verify_delivery "document_id"
#######################################
verify_delivery() {
  local document_id="$1"
  
  # 先查询该文档关联的交付记录
  result=$(mcp_call "list_my_deliveries" "{\"status\": \"all\"}")
  
  delivery_id=$(echo "$result" | jq -r ".data.deliveries[] | select(.document_id == \"${document_id}\") | .id")
  
  if [ -n "$delivery_id" ]; then
    echo "✅ 交付记录已创建: $delivery_id"
    
    # 获取详情确认
    detail=$(mcp_call "get_delivery" "{\"delivery_id\": \"${delivery_id}\"}")
    echo "交付状态: $(echo "$detail" | jq -r '.data.status')"
    return 0
  else
    echo "❌ 未找到关联的交付记录"
    return 1
  fi
}

#######################################
# 批量操作验证
# 用法: verify_bulk_tasks expected_count [project_id]
#######################################
verify_bulk_tasks() {
  local expected_count="$1"
  local project_id="$2"
  
  result=$(mcp_call "list_my_tasks" "{\"status\": \"todo\"}")
  actual_count=$(echo "$result" | jq '.data.tasks | length')
  
  if [ "$actual_count" -ge "$expected_count" ]; then
    echo "✅ 批量任务验证成功: 创建了 $actual_count 个任务"
    return 0
  else
    echo "⚠️ 任务数量不足: 期望 $expected_count，实际 $actual_count"
    return 1
  fi
}

#######################################
# 状态更新验证（带重试）
# 用法: verify_status_update "task_id" "expected_status" [max_retries]
#######################################
verify_status_update() {
  local task_id="$1"
  local expected_status="$2"
  local max_retries="${3:-3}"
  local retry=0
  
  while [ $retry -lt $max_retries ]; do
    result=$(mcp_call "get_task" "{\"task_id\": \"${task_id}\"}")
    actual_status=$(echo "$result" | jq -r '.data.status // empty')
    
    if [ "$actual_status" = "$expected_status" ]; then
      echo "✅ 状态验证成功: $task_id → $actual_status"
      return 0
    fi
    
    retry=$((retry + 1))
    sleep 1
  done
  
  echo "❌ 状态验证失败: 期望 $expected_status，实际 $actual_status"
  return 1
}

# 使用示例：
# source scripts/mcp-call.sh
# verify_task "task_abc123" "in_progress"
# verify_delivery "doc_xyz"
# verify_bulk_tasks 5
