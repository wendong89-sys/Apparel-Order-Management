# 发布检查清单

发布到 GitHub 或打正式版本前，逐项确认。

## 业务

- [ ] 客户订单可以创建。
- [ ] 尺码数量可以录入并自动汇总。
- [ ] 面辅料、辅料、定制内容、技术参数、采购确认可以记录。
- [ ] 订单评分低于 9 分不能下发工厂。
- [ ] 审核后才能进入待分厂。
- [ ] 订单可以分配给 1 号工厂或 2 号工厂。
- [ ] 工厂可以接单并推进生产节点。
- [ ] 点数、质检、照片数量不完整时不能出货。
- [ ] 出货和完成订单会写入日志。

## 工程

- [ ] `npm install` 或 `npm ci` 成功。
- [ ] `npm run test` 通过。
- [ ] `npm run build` 通过。
- [ ] `npm audit --audit-level=moderate` 通过。
- [ ] `npm run score` 达到 9 分以上。
- [ ] `npm run check` 通过。

## 文档

- [ ] `README.md` 说明如何运行。
- [ ] `LOOP.md` 说明业务闭环。
- [ ] `docs/SCORECARD.md` 说明评分规则。
- [ ] `docs/DEVELOPMENT.md` 说明开发流程。
- [ ] `docs/ARCHITECTURE.md` 说明架构。
- [ ] `docs/ROADMAP.md` 说明后续路线。
