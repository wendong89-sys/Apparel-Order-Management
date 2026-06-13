# 部署文档

## 本地生产预览

```bash
npm install
npm run start
```

访问：

```text
http://127.0.0.1:3000
```

## 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| PORT | 3000 | 服务端口 |
| DATA_DIR | ./data | 服务端 JSON 数据目录 |
| DEFAULT_ADMIN_PASSWORD | admin123 | 首次初始化管理员密码 |
| SESSION_TTL_MS | 43200000 | 登录令牌有效期，默认 12 小时 |

示例：

```bash
PORT=3000 DATA_DIR=./data DEFAULT_ADMIN_PASSWORD=change-me npm run server
```

## 数据文件

首次启动会自动创建：

- `data/orders.json`
- `data/users.json`

生产环境需要定期备份 `data/`。

## 发布前检查

```bash
npm run check
```

只有测试、构建、安全审计和 9 分验收全部通过，才建议发布。

## Docker 部署

```bash
docker compose up -d --build
```

访问：

```text
http://127.0.0.1:3000
```

数据会保存在 Docker volume：

```text
garment_order_data
```

首次部署前建议复制环境变量模板：

```bash
cp .env.example .env
```

然后修改：

```text
DEFAULT_ADMIN_PASSWORD=change-me
```
