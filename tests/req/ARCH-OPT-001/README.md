# ARCH-OPT-001: 架构优化测试

## 测试范围

本次架构优化包含以下内容：
1. **Bundle Analyzer** - 包体积分析工具
2. **SQL 白名单验证** - 防止 SQL 注入
3. **DataProvider 重构** - 提取自定义 hooks
4. **文件上传验证** - 文件类型/大小白名单
5. **Props 命名规范** - 统一组件 Props 接口命名

## 运行方式

```bash
# 本地测试
npx vitest run tests/req/ARCH-OPT-001/

# 远程测试
TEST_TARGET=remote npx vitest run tests/req/ARCH-OPT-001/
```

## 测试项清单

| 测试项 | 文件 | 预期基线(R1) | 预期验证(R2) |
|--------|------|-------------|-------------|
| SQL 白名单验证 | sql-validator.test.ts | PASS | PASS |
| 文件上传验证 | file-validator.test.ts | PASS | PASS |
| Props 命名规范 | props-naming.test.ts | PASS | PASS |
| 上游接口稳定性 | upstream.test.ts | PASS | PASS |

## 诊断报告

- R1（基线）：`tests/reports/ARCH-OPT-001-R1.json`
- R2（验证）：`tests/reports/ARCH-OPT-001-R2.json`
