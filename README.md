# 服装定制订单管理系统

一个面向服装定制厂家、加工厂和生产协同团队的开源订单管理系统。

系统用于管理客户下单后的完整闭环：订单录入、尺码数量、面辅料、logo 和工艺资料、9 分可生产评分、订单审核、分配 1 号工厂或 2 号工厂、生产节点、点数质检、出货和结算。

## 当前版本

当前版本是可直接运行的 Web MVP：

- 不需要后端和数据库
- 使用浏览器 `localStorage` 保存数据
- 默认内置 1 号工厂、2 号工厂和示例订单
- 可以创建真实订单、评分、审核、分厂、推进生产、质检和出货
- 适合先开源、演示、试用和打磨业务流程
- 可选启用 Node 后端 API，把订单保存到服务端 `data/orders.json`

后续版本可以把本地存储替换为 PostgreSQL、MySQL 或 SQLite，并增加多人登录、文件存储和 API 服务。

## 功能

- 订单看板：统计待审核、待分厂、生产中、待质检、待出货订单
- 新建订单：客户信息、交期、尺码数量、面辅料、辅料、定制内容、技术参数、采购确认
- 订单评分：满分 10 分，低于 9 分不能下发工厂
- 审核分厂：管理员审核后分配给 1 号工厂或 2 号工厂
- 工厂工作台：接单、裁剪、上线、下线、后整、包装、出货
- 质检点数：记录点数结果、照片数量、质检结论和返工
- 操作日志：关键动作自动记录
- 数据导出：导出 JSON 备份

## 快速开始

### 方式一：直接打开

双击打开 `index.html` 即可使用。

### 方式二：使用开发服务

```bash
npm install
npm run dev
```

然后访问：

```text
http://127.0.0.1:5173
```

### 方式三：启用服务端 API

开发时可以同时启动前端和后端：

```bash
npm run server
npm run dev
```

后端 API 地址：

```text
http://127.0.0.1:3000
```

默认管理员：

```text
用户名：admin
密码：admin123
```

生产预览可以先构建，再由后端直接托管静态文件：

```bash
npm run start
```

访问：

```text
http://127.0.0.1:3000
```

服务端数据默认保存到 `data/` 目录。可以用环境变量修改：

```bash
DATA_DIR=./data PORT=3000 DEFAULT_ADMIN_PASSWORD=your-password npm run server
```

### 方式四：Docker

```bash
docker compose up -d --build
```

然后访问：

```text
http://127.0.0.1:3000
```

## 开发命令

```bash
npm run dev       # 本地开发
npm run server    # 启动 Node 后端 API
npm run start     # 构建并启动生产预览服务
npm run build     # 打包静态文件
npm run preview   # 预览打包结果
npm run test      # 运行领域规则测试
npm run score     # 运行 9 分项目验收
npm run ui:score  # 运行 UI 专业软件级验收
npm run check     # 测试 + 构建 + 安全审计 + 9 分验收
```

提交到 GitHub 前建议运行：

```bash
npm run check
```

只有 `check` 通过，才说明当前版本达到项目定义的 9 分发布门槛。

## 评分规则

系统采用 10 分制订单评分：

- 9.0 - 10：允许分厂生产
- 8.0 - 8.9：接近可生产，需要补齐扣分项
- 6.0 - 7.9：资料仍不完整，不能下发
- 0 - 5.9：不能提交审核

评分明细见 [LOOP.md](./LOOP.md) 和 [docs/SCORECARD.md](./docs/SCORECARD.md)。

项目本身也有自动化评分脚本：

```bash
npm run score
```

该脚本会检查文档、核心规则、测试结构和关键业务约束。低于 9 分会返回失败状态，提示需要重做短板模块。

## 文档

- [业务 LOOP](./LOOP.md)
- [开发流程](./docs/DEVELOPMENT.md)
- [评分体系](./docs/SCORECARD.md)
- [UI 验收标准](./docs/UI_ACCEPTANCE.md)
- [系统架构](./docs/ARCHITECTURE.md)
- [API 文档](./docs/API.md)
- [部署文档](./docs/DEPLOYMENT.md)
- [路线图](./docs/ROADMAP.md)
- [发布检查清单](./docs/RELEASE_CHECKLIST.md)

## GitHub CI

仓库内置 GitHub Actions：

```text
.github/workflows/ci.yml
```

每次 push 或 pull request 会自动执行 `npm run check`。

## 开源许可

MIT License
