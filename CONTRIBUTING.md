# 贡献指南

感谢你参与服装定制订单管理系统。

## 开发前

请先阅读：

- [业务 LOOP](./LOOP.md)
- [开发流程](./docs/DEVELOPMENT.md)
- [评分体系](./docs/SCORECARD.md)
- [系统架构](./docs/ARCHITECTURE.md)

## 本地验证

提交前必须运行：

```bash
npm run check
```

该命令会执行测试、构建、安全审计和 9 分项目验收。

## 业务规则

- 低于 9 分的订单不能下发工厂。
- 质检不通过不能出货。
- 出货前必须完成点数和照片记录。
- 关键操作必须写入日志。
- 新增核心业务规则时，优先修改 `src/domain.js`，并补充 `tests/domain.test.js`。

## Pull Request 要求

PR 描述需要说明：

- 改动的业务节点
- 是否影响订单评分
- 是否影响状态流转
- 是否新增或修改测试
- `npm run check` 是否通过

## 分支命名

- `feature/order-score`
- `feature/factory-board`
- `fix/inspection-ship-gate`
- `docs/readme-flow`
