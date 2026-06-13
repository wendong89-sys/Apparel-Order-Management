# API 文档

默认服务地址：

```text
http://127.0.0.1:3000
```

## 认证

### 登录

```http
POST /api/auth/login
Content-Type: application/json
```

```json
{
  "username": "admin",
  "password": "admin123"
}
```

返回：

```json
{
  "token": "...",
  "user": {
    "id": "user-admin",
    "username": "admin",
    "name": "系统管理员",
    "role": "管理员"
  }
}
```

后续请求带上：

```http
Authorization: Bearer <token>
```

## 健康检查

```http
GET /api/health
```

## 工厂

```http
GET /api/factories
```

## 订单

### 读取订单列表

```http
GET /api/orders
```

### 批量保存订单

```http
PUT /api/orders
Content-Type: application/json
```

### 创建订单

```http
POST /api/orders
Content-Type: application/json
```

### 读取单个订单

```http
GET /api/orders/:id
```

### 更新单个订单

```http
PATCH /api/orders/:id
Content-Type: application/json
```

### 读取订单评分

```http
GET /api/orders/:id/score
```

## 订单动作

```http
POST /api/orders/:id/actions
Content-Type: application/json
```

支持动作：

| action | 说明 |
| --- | --- |
| submit | 提交审核 |
| approve | 审核通过，进入待分厂 |
| assign | 下发工厂，需要 `factoryId` |
| accept | 工厂接单 |
| inspection | 送检 |
| ship | 出货 |
| complete | 完成订单 |

示例：

```json
{
  "action": "assign",
  "factoryId": "factory-1",
  "reason": "1号工厂产能充足"
}
```

服务端会强制执行核心规则：

- 低于 9 分不能下发工厂。
- 未审核通过不能下发工厂。
- 未完成点数、质检通过和照片记录不能出货。
