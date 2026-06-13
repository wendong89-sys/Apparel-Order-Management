import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import crypto from "node:crypto";

import { factories, formatDate, productionSteps } from "../src/domain.js";

const DATA_DIR = process.env.DATA_DIR || join(process.cwd(), "data");
const ORDERS_FILE = join(DATA_DIR, "orders.json");
const USERS_FILE = join(DATA_DIR, "users.json");

export async function ensureDataStore() {
  await mkdir(DATA_DIR, { recursive: true });
  if (!existsSync(ORDERS_FILE)) {
    await writeJson(ORDERS_FILE, [createDemoOrder()]);
  }
  if (!existsSync(USERS_FILE)) {
    await writeJson(USERS_FILE, [createDefaultAdmin()]);
  }
}

export async function readOrders() {
  await ensureDataStore();
  return readJson(ORDERS_FILE);
}

export async function writeOrders(orders) {
  await ensureDataStore();
  await writeJson(ORDERS_FILE, orders);
  return orders;
}

export async function upsertOrder(order) {
  const orders = await readOrders();
  const index = orders.findIndex((item) => item.id === order.id);
  if (index >= 0) {
    orders[index] = order;
  } else {
    orders.unshift(order);
  }
  await writeOrders(orders);
  return order;
}

export async function findOrder(id) {
  const orders = await readOrders();
  return orders.find((order) => order.id === id);
}

export async function readUsers() {
  await ensureDataStore();
  return readJson(USERS_FILE);
}

export function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password, passwordHash) {
  const [salt, expected] = passwordHash.split(":");
  if (!salt || !expected) return false;
  const hash = crypto.scryptSync(password, salt, 64);
  const expectedBuffer = Buffer.from(expected, "hex");
  return expectedBuffer.length === hash.length && crypto.timingSafeEqual(hash, expectedBuffer);
}

async function readJson(file) {
  const raw = await readFile(file, "utf8");
  return JSON.parse(raw);
}

async function writeJson(file, value) {
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function createDefaultAdmin() {
  return {
    id: "user-admin",
    username: "admin",
    name: "系统管理员",
    role: "管理员",
    passwordHash: hashPassword(process.env.DEFAULT_ADMIN_PASSWORD || "admin123")
  };
}

function createDemoOrder() {
  const today = new Date();
  const due = new Date(Date.now() + 12 * 24 * 60 * 60 * 1000);
  return {
    id: crypto.randomUUID(),
    number: `GD-${formatDate(today).replaceAll("-", "")}-001`,
    customerName: "示例客户-华东物业",
    contactName: "王经理",
    phone: "13800000000",
    salesOwner: "李预红",
    orderDate: formatDate(today),
    dueDate: formatDate(due),
    category: "工作服",
    urgency: "加急",
    source: "微信",
    status: "review",
    factoryId: "",
    assignmentReason: "",
    material: {
      mainColor: "藏青",
      contrastColor: "荧光绿",
      lining: "210T里布",
      filling: "无",
      fabricNote: "涤棉斜纹，耐磨，库存已确认"
    },
    accessories: {
      zipper: "5号树脂拉链",
      accessory: "袖口魔术贴",
      buttonType: "四合扣",
      reflective: "前胸和后背反光条",
      thread: "藏青线",
      elastic: "下摆松紧",
      label: "主标+洗水标",
      hangtag: "需要吊牌"
    },
    customization: {
      type: "刺绣",
      content: "客户公司logo",
      position: "左胸",
      logoReady: true,
      effectReady: true
    },
    technical: {
      owner: "孙昌旭",
      confirmed: true,
      note: "左胸刺绣宽 8cm，反光条按样衣位置，袖口魔术贴统一藏青色。"
    },
    procurement: {
      owner: "江悦",
      confirmed: true,
      note: "面料和辅料均有库存，可立即排产。"
    },
    items: [
      {
        id: crypto.randomUUID(),
        product: "单衣",
        quantities: { "175": 1, "180": 1, "185": 1 }
      }
    ],
    steps: Object.fromEntries(productionSteps.map(([key]) => [key, "未开始"])),
    inspection: { counted: false, passed: false, photoCount: 0, note: "" },
    files: { logoCount: 1, effectCount: 1, technicalCount: 1 },
    risks: [],
    payment: { deposit: 0, final: 0, factoryCost: 0 },
    logs: [{ id: crypto.randomUUID(), actor: "系统", action: "创建示例订单", time: new Date().toLocaleString("zh-CN", { hour12: false }) }]
  };
}

export { factories };
