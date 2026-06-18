import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

import { canAssignFactory, canShipOrder, scoreOrder } from "../src/domain.js";

const root = process.cwd();
const requiredFiles = [
  "README.md",
  "LOOP.md",
  "docs/DEVELOPMENT.md",
  "docs/SCORECARD.md",
  "docs/ARCHITECTURE.md",
  "docs/ROADMAP.md",
  "docs/API.md",
  "docs/DEPLOYMENT.md",
  "docs/UI_ACCEPTANCE.md",
  "Dockerfile",
  "docker-compose.yml",
  ".env.example",
  "src/app.js",
  "src/domain.js",
  "server/index.js",
  "server/auth.js",
  "server/store.js",
  "tests/domain.test.js",
  "tests/server.test.js",
  "scripts/ui-quality-gate.js",
  ".github/workflows/ci.yml",
  "CONTRIBUTING.md",
  "docs/RELEASE_CHECKLIST.md",
  "LICENSE",
  "package.json"
];

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

function has(path, text) {
  return read(path).includes(text);
}

const sampleOrder = {
  customerName: "华东物业",
  contactName: "王经理",
  phone: "13800000000",
  orderDate: "2026-06-13",
  dueDate: "2026-06-30",
  status: "allocation",
  factoryId: "",
  items: [{ product: "单衣", quantities: { "175": 10, "180": 10 } }],
  material: { mainColor: "藏青", contrastColor: "荧光绿", lining: "210T", filling: "无", fabricNote: "库存已确认" },
  accessories: { zipper: "5号树脂拉链", buttonType: "四合扣", reflective: "反光条", thread: "藏青线", label: "主标", hangtag: "吊牌" },
  customization: { type: "刺绣", content: "客户logo", position: "左胸", logoReady: true, effectReady: true },
  technical: { owner: "孙昌旭", confirmed: true, note: "工艺已确认" },
  procurement: { owner: "江悦", confirmed: true, note: "物料已确认" },
  risks: [],
  inspection: { counted: true, passed: true, photoCount: 2 }
};

const checks = [
  {
    name: "开源文档齐全",
    points: 0.9,
    pass: requiredFiles.every((file) => existsSync(join(root, file)))
  },
  {
    name: "README 包含运行、测试、评分说明",
    points: 1,
    pass: ["npm run dev", "npm run test", "npm run score", "9 分"].every((text) => has("README.md", text))
  },
  {
    name: "LOOP 包含评分系统和低分重做规则",
    points: 1,
    pass: ["9 分订单评分系统", "重做规则", "低于 9 分"].every((text) => has("LOOP.md", text))
  },
  {
    name: "领域规则独立且可测试",
    points: 1.3,
    pass: ["export function scoreOrder", "export function canAssignFactory", "export function canShipOrder"].every((text) => has("src/domain.js", text))
  },
  {
    name: "订单评分达到 9 分以上才能分厂",
    points: 1.4,
    pass: scoreOrder(sampleOrder, new Date("2026-06-13")).score >= 9 && canAssignFactory(sampleOrder)
  },
  {
    name: "低分订单不能分厂",
    points: 1.2,
    pass: !canAssignFactory({ ...sampleOrder, status: "allocation", customerName: "", risks: ["资料缺失"] })
  },
  {
    name: "出货规则包含点数、质检、照片",
    points: 1.1,
    pass: canShipOrder({ ...sampleOrder, status: "ready_ship" }) && !canShipOrder({ ...sampleOrder, status: "ready_ship", inspection: { counted: true, passed: true, photoCount: 0 } })
  },
  {
    name: "项目脚本包含 check 总验收",
    points: 0.8,
    pass: ["\"test\"", "\"build\"", "\"score\"", "\"ui:score\"", "\"check\"", "\"server\"", "\"start\""].every((text) => has("package.json", text))
  },
  {
    name: "GitHub CI 自动执行总验收",
    points: 0.4,
    pass: ["npm ci", "npm run check"].every((text) => has(".github/workflows/ci.yml", text))
  },
  {
    name: "界面包含生产管理关键页面",
    points: 0.2,
    pass: ["订单生产看板", "工厂工作台", "点数质检", "系统设置"].every((text) => has("src/app.js", text))
  },
  {
    name: "轻量后端包含认证、持久化和服务端规则",
    points: 0.7,
    pass: ["POST /api/auth/login", "GET /api/orders", "低于 9 分不能下发工厂"].every((text) => has("docs/API.md", text)) &&
      ["authenticate", "applyAction", "canAssignFactory", "canShipOrder"].every((text) => has("server/index.js", text))
  },
  {
    name: "提供 Docker 部署入口",
    points: 0,
    pass: ["docker compose up", "DEFAULT_ADMIN_PASSWORD"].every((text) => has("docs/DEPLOYMENT.md", text)) &&
      ["FROM node:24-alpine", "server/index.js"].every((text) => has("Dockerfile", text))
  }
];

const total = checks.reduce((sum, check) => sum + (check.pass ? check.points : 0), 0);
const score = Math.round(total * 10) / 10;

for (const check of checks) {
  console.log(`${check.pass ? "PASS" : "FAIL"} ${check.name} (${check.points})`);
}

console.log(`\n项目验收评分：${score}/10`);

if (score < 9) {
  console.error("验收失败：低于 9 分，需要重做短板模块。");
  process.exit(1);
}

console.log("验收通过：达到 9 分发布门槛。");
